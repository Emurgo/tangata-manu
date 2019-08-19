// @flow
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */

import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import Block from '../blockchain'

const EPOCH_DOWNLOAD_THRESHOLD = 14400
const MAX_BLOCKS_PER_LOOP = 9000
const LOG_BLOCK_PARSED_THRESHOLD = 30
const BLOCKS_CACHE_SIZE = 800
const ERROR_META = {
  'ECONNREFUSED': {
    msg: 'node is inaccessible',
    sleep: 60000
  }
}

const STATUS_ROLLBACK_REQUIRED = Symbol.for('ROLLBACK_REQUIRED')
const BLOCK_STATUS_PROCESSED = Symbol.for('BLOCK_PROCESSED')

class CronScheduler implements Scheduler {

  #dataProvider: any

  #db: any

  #logger: any

  checkTipMillis: number

  blocksToStore: any

  rollbackBlocksCount: number

  lastBlock: { epoch: number, hash: string }

  constructor(
    dataProvider: RawDataProvider,
    checkTipSeconds: number,
    db: Database,
    logger: Logger,
    rollbackBlocksCount: number,
  ) {
    this.#dataProvider = dataProvider
    this.rollbackBlocksCount = rollbackBlocksCount
    this.checkTipMillis = checkTipSeconds * 1000
    logger.debug('Checking tip every', checkTipSeconds, 'seconds')
    logger.debug('Rollback blocks count', rollbackBlocksCount)
    this.#db = db
    this.#logger = logger
    this.blocksToStore = []
    this.lastBlock = null
  }

  async rollback(atBlockHeight) {
    this.#logger.info(`Rollback at height ${atBlockHeight} to ${this.rollbackBlocksCount} blocks back.`)
    // reset scheduler state
    this.blocksToStore = []
    this.lastBlock = null
    const dbConn = this.#db.getConn()
    try {
      await dbConn.query('BEGIN')
      // Recover database state to newest actual block.
      const { height } = await this.#db.getBestBlockNum()
      const rollBackTo = height - this.rollbackBlocksCount
      this.#logger.info(`Current DB height at rollback time: ${height}. Rolling back to: ${rollBackTo}`)
      await this.resetToBlockHeight(rollBackTo)
      let { epoch, hash } = await this.#db.getBestBlockNum()
      this.lastBlock = { epoch, hash }
      await dbConn.query('COMMIT')
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    }
  }

  async resetToBlockHeight(blockHeight: number) {
    await this.#db.rollBackTransactions(blockHeight)
    await this.#db.rollBackUtxoBackup(blockHeight)
    await this.#db.rollBackBlockHistory(blockHeight)
    await this.#db.updateBestBlockNum(blockHeight)
  }


  async processEpochId(id: number, height: number) {
    this.#logger.info(`processEpochId: ${id}, ${height}`)
    const omitEbb = true
    const blocks = await this.#dataProvider.getParsedEpochById(id, omitEbb)
    // eslint-disable-next-line no-restricted-syntax
    for (const block of blocks) {
      if (block.height > height) {
        await this.processBlock(block)
      }
    }
  }

  async processBlockHeight(height: number) {
    const block = await this.#dataProvider.getBlockByHeight(height)
    const flushCache = true
    return this.processBlock(block, flushCache)
  }

  async processBlock(block: Block, flushCache: boolean = false): Promise<Symbol> {
    const dbConn = this.#db.getConn()
    if (this.lastBlock
      && block.epoch === this.lastBlock.epoch
      && block.prevHash !== this.lastBlock.hash) {
      this.#logger.info(`(${block.epoch}/${block.slot}) block.prevHash (${block.prevHash}) !== lastBlock.hash (${this.lastBlock.hash}). Performing rollback...`)
      return STATUS_ROLLBACK_REQUIRED
    }
    this.lastBlock = {
      epoch: block.epoch,
      hash: block.hash
    }
    const blockHaveTxs = !_.isEmpty(block.txs)
    this.blocksToStore.push(block)
    try {
      if (this.blocksToStore.length > BLOCKS_CACHE_SIZE || blockHaveTxs || flushCache) {
        await dbConn.query('BEGIN')
        if (blockHaveTxs) {
          await this.#db.storeBlockTxs(block)
        }
        await this.#db.storeBlocks(this.blocksToStore)
        await this.#db.updateBestBlockNum(block.height)
        this.blocksToStore = []
        await dbConn.query('COMMIT')
      }
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    } finally {
      if (flushCache || block.height % LOG_BLOCK_PARSED_THRESHOLD === 0) {
        this.#logger.debug(`Block parsed: ${block.hash} ${block.epoch} ${block.slot} ${block.height}`)
      }
    }
    return BLOCK_STATUS_PROCESSED
  }

  async checkTip() {
    this.#logger.info(`checkTip: checking for new blocks...`)
    // local state
    let { height, epoch, slot } = await this.#db.getBestBlockNum()

    // cardano-http-bridge state
    const nodeStatus = await this.#dataProvider.getStatus()
    const { packedEpochs, tip: nodeTip } = nodeStatus
    const tipStatus = nodeTip.local
    const remoteStatus = nodeTip.remote
    if (!tipStatus) {
      this.#logger.info('cardano-http-brdige not yet synced')
      return
    }
    this.#logger.debug(`Last imported block ${height}. Node status: local=${tipStatus.slot} remote=${remoteStatus.slot} packedEpochs=${packedEpochs}`)
    const [remEpoch, remSlot] = remoteStatus.slot
    if (epoch < remEpoch) {
      // If local epoch is lower than the current network tip
      // there's a potential for us to download full epochs, instead of single blocks
      // Calculate latest stable remote epoch
      const lastRemStableEpoch = remEpoch - (remSlot > 2160 ? 1 : 2)
      const thereAreMoreStableEpoch = epoch < lastRemStableEpoch
      const thereAreManyStableSlots = epoch === lastRemStableEpoch
        && slot < EPOCH_DOWNLOAD_THRESHOLD
      // Check if there's any point to bother with whole epochs
      if (thereAreMoreStableEpoch || thereAreManyStableSlots) {
        if (packedEpochs > epoch) {
          for (let epochId = epoch;
               (epochId < packedEpochs); epochId++) {
            const epochStartHeight = (epochId === epoch ? height : 0)
            // Process epoch
            await this.processEpochId(epochId, height)
          }
        } else {
          // Packed epoch is not available yet
          this.#logger.info(`cardano-http-brdige has not yet packed stable epoch: ${epoch} (lastRemStableEpoch=${lastRemStableEpoch})`)
        }
        return
      }
    }
    for (let blockHeight = height + 1, i = 0; (blockHeight <= tipStatus.height) && (i < MAX_BLOCKS_PER_LOOP);
         blockHeight++, i++) {
      const status = await this.processBlockHeight(blockHeight)
      if (status === STATUS_ROLLBACK_REQUIRED) {
        this.#logger.info('Rollback required.')
        await this.rollback(blockHeight)
        return
      }
    }
  }

  async startAsync() {
    this.#logger.info('Scheduler async: starting chain syncing look')
    const currentMillis = () => new Date().getTime()
    const sleep = millis => new Promise(resolve => setTimeout(resolve, millis))
    while (true) {
      const millisStart = currentMillis()
      let errorSleep = 0;
      try {
        await this.checkTip()
        errorSleep = 0
      } catch (e) {
        const meta = ERROR_META[e.code]
        if (meta) {
          errorSleep = meta.sleep
          this.#logger.warn(`Scheduler async: failed to check tip :: ${meta.msg}. Sleeping and retrying (err_sleep=${errorSleep})`)
        } else {
          throw e
        }
      }
      const millisEnd = currentMillis()
      const millisPassed = millisEnd - millisStart
      this.#logger.debug(`Scheduler async: loop finished (millisPassed=${millisPassed})`)
      const millisSleep = errorSleep || (this.checkTipMillis - millisPassed)
      if (millisSleep > 0) {
        this.#logger.debug('Scheduler async: sleeping for', millisSleep)
        await sleep(millisSleep)
      }
    }
  }
}

helpers.annotate(CronScheduler,
  [
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    'checkTipSeconds',
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.LOGGER,
    'rollbackBlocksCount',
  ])

export default CronScheduler
