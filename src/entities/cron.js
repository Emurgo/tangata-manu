// @flow
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */

import cron from 'cron'
import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'
import queue from 'async/queue'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
  StorageProcessor,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import Block from '../blockchain'

const EPOCH_DOWNLOAD_THRESHOLD = 14400
const QUEUE_MAX_LENGTH = 10000
const LOG_BLOCK_PARSED_THRESHOLD = 30
const BLOCKS_CACHE_SIZE = 800

const STATUS_ROLLBACK_REQUIRED = Symbol.for('ROLLBACK_REQUIRED')
const BLOCK_STATUS_PROCESSED = Symbol.for('BLOCK_PROCESSED')

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #db: any

  #storageProcessor: any

  #logger: any

  #blockProcessQueue: any

  #epochProcessQueue: any


  #epochsInQueue: any

  blocksToStore: any

  rollbackBlocksCount: number

  lastBlock: ?Block

  constructor(
    dataProvider: RawDataProvider,
    checkTipCronTime: string,
    db: Database,
    storageProcessor: StorageProcessor,
    logger: Logger,
    rollbackBlocksCount: number,
  ) {
    this.#dataProvider = dataProvider
    this.#storageProcessor = storageProcessor
    this.rollbackBlocksCount = rollbackBlocksCount
    logger.debug('Cron time', checkTipCronTime)
    logger.debug('Rollback blocks count', rollbackBlocksCount)
    this.#job = new cron.CronJob({
      cronTime: checkTipCronTime,
      onTick: () => {
        this.onTick()
      },
    })
    this.#db = db
    this.#logger = logger
    this.#epochsInQueue = []

    this.#blockProcessQueue = queue(async ({ height }, cb) => {
      const status = await this.processBlockHeight(height)
      if (status === STATUS_ROLLBACK_REQUIRED) {
        this.#logger.info('Rollback required.')
        await this.rollback()
      }
      cb()
    }, 1)

    this.#epochProcessQueue = queue(async ({ epoch, height }, cb) => {
      await this.processEpochId(epoch, height)
      cb()
    }, 1)
    this.blocksToStore = []
    this.resetBlockProcessor()
  }

  resetBlockProcessor() {
    this.lastBlock = null
    this.#blockProcessQueue.remove(() => true)
  }

  async rollback() {
    this.#logger.info(`Rollback to ${this.rollbackBlocksCount} back.`)
    // reset scheduler state
    this.blocksToStore = []
    this.resetBlockProcessor()


    // Recover database state to newest actual block.
    const { height } = await this.#db.getBestBlockNum()
    await this.resetToBlockHeight(height - this.rollbackBlocksCount)
  }

  async resetToBlockHeight(blockHeight: number) {
    await this.#db.rollBackTransactions(blockHeight)
    await this.#db.rollBackUtxoBackup(blockHeight)
    await this.#db.rollBackBlockHistory(blockHeight)
    await this.#db.updateBestBlockNum(blockHeight)
  }


  async processEpochId(id: number, height: number) {
    this.#logger.info(`processEpochId: ${id}, ${height}`)
    this.resetBlockProcessor()
    const omitEbb = true
    const blocks = await this.#dataProvider.getParsedEpochById(id, omitEbb)

    // get first epoch block and process it
    const firstBlock = blocks.next().value
    if (firstBlock.height > height) {
      await this.processBlock(firstBlock)
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const block of blocks) {
      if (block.height > height) {
        await this.processBlock(block)
      }
    }
  }

  async processBlockHeight(height: number) {
    this.#logger.info(`processBlockHeight: ${height}`)
    const block = await this.#dataProvider.getBlockByHeight(height)
    const flushCache = true
    return this.processBlock(block, flushCache)
  }

  async processBlock(block: Block, flushCache: boolean = false): Promise<Symbol> {
    const dbConn = this.#db.getConn()
    if (this.lastBlock
      && block.epoch === this.lastBlock.epoch
      && block.prevHash !== this.lastBlock.hash) {
      this.#logger.info(`block.prevHash(${block.prevHash})!== lastBlock.hash(${this.lastBlock.hash}). Performing rollback...`)
      return STATUS_ROLLBACK_REQUIRED
    }
    this.lastBlock = block
    const blockHaveTxs = !_.isEmpty(block.txs)
    this.blocksToStore.push(block)
    try {
      if (this.blocksToStore.length > BLOCKS_CACHE_SIZE || blockHaveTxs || flushCache) {
        await dbConn.query('BEGIN')
        if (blockHaveTxs) {
          await this.#db.storeBlockTxs(block)
        }
        await this.#storageProcessor.storeBlocks(this.blocksToStore)
        await this.#db.updateBestBlockNum(block.height)
        this.blocksToStore = []
        await dbConn.query('COMMIT')
      }
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    } finally {
      if (block.height % LOG_BLOCK_PARSED_THRESHOLD === 0) {
        this.#logger.debug(`Block parsed: ${block.hash} ${block.epoch} ${block.slot} ${block.height}`)
      }
    }
    return BLOCK_STATUS_PROCESSED
  }

  async onTick() {
    this.#logger.info('onTick:checking for new blocks...')
    try {
      // local state
      let { height, epoch, slot } = await this.#db.getBestBlockNum()
      const lastCachedBlock = _.last(this.blocksToStore)
      if (lastCachedBlock && lastCachedBlock.height > height) {
        ({ height, epoch, slot } = lastCachedBlock)
      }

      // Blocks which already in queue, but not yet processed.
      const notProcessedBlocks = this.#blockProcessQueue.length()
      if (notProcessedBlocks > QUEUE_MAX_LENGTH) {
        this.#logger.info('Too many not yet processed blocks in queue. Skip to add new blocks.')
      }

      // cardano-http-bridge state
      const nodeStatus = await this.#dataProvider.getStatus()
      const { packedEpochs } = nodeStatus
      const tipStatus = nodeStatus.tip.local
      const remoteStatus = nodeStatus.tip.remote
      if (!tipStatus) {
        this.#logger.info('cardano-http-brdige not yet synced')
        return
      }
      this.#logger.debug(`Last block ${height}. Node status local=${tipStatus.slot} remote=${remoteStatus.slot} packedEpochs=${packedEpochs}`)
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

              const lastEpochInQueue = _.last(this.#epochsInQueue)
              if (!lastEpochInQueue || lastEpochInQueue < epochId) {
                if (lastEpochInQueue && epochId - lastEpochInQueue > 1) {
                  throw new Error('There are some missing epochs numbers for the queue')
                }
                // add epoch to queue
                this.#epochProcessQueue.push({
                  epoch: epochId,
                  height: epochStartHeight,
                })
                this.#logger.debug(`Pushed to queue: ${epochId} ${epochStartHeight}`)
                this.#epochsInQueue.push(epochId)
              }
            }
          } else {
            // Packed epoch is not available yet
            this.#logger.info(`cardano-http-brdige has not yet packed stable epoch: ${epoch} (lastRemStableEpoch=${lastRemStableEpoch})`)
          }
          return
        }
      }
      const notYetProcessedEpochsCount = this.#epochProcessQueue.length()
      if (notYetProcessedEpochsCount === 0) {
        for (let blockHeight = height + 1, i = 0; (blockHeight <= tipStatus.height) && (i < 9000);
          blockHeight++, i++) {
          this.#blockProcessQueue.push({ height: blockHeight })
        }
      } else {
        this.#logger.debug('There are still not processed epochs.', notYetProcessedEpochsCount)
      }
    } catch (e) {
      this.#logger.debug('Error occured:', e)
      throw e
    }
  }

  start() {
    this.#job.start()
  }
}

helpers.annotate(CronScheduler,
  [
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    'checkTipCronTime',
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.STORAGE_PROCESSOR,
    SERVICE_IDENTIFIER.LOGGER,
    'rollbackBlocksCount',
  ])

export default CronScheduler
