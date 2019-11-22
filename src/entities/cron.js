// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type {
  Scheduler,
  RawDataProvider,
  StorageProcessor,
  NetworkConfig,
} from '../interfaces'
import { NETWORK_PROTOCOL } from './network-config'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import type { Block } from '../blockchain/common'

const EPOCH_DOWNLOAD_THRESHOLD = 14400
const MAX_BLOCKS_PER_LOOP = 9000
const LOG_BLOCK_PARSED_THRESHOLD = 30
const ERROR_META = {
  NODE_INACCESSIBLE: {
    msg: 'node is inaccessible',
    sleep: 60000,
  },
  ECONNREFUSED: {

    msg: 'some unidentified network service is inaccessible',
    sleep: 60000,
  },
}

const STATUS_ROLLBACK_REQUIRED = Symbol.for('ROLLBACK_REQUIRED')
const BLOCK_STATUS_PROCESSED = Symbol.for('BLOCK_PROCESSED')

class CronScheduler implements Scheduler {
  #dataProvider: any

  storageProcessor: StorageProcessor

  logger: Logger

  checkTipMillis: number

  blocksToStore: any

  rollbackBlocksCount: number

  maxBlockBatchSize: number

  lastBlock: ?{ epoch: number, hash: string }

  #genesisHash: string

  networkProtocol: string

  constructor(
    dataProvider: RawDataProvider,
    checkTipSeconds: number,
    storageProcessor: StorageProcessor,
    logger: Logger,
    rollbackBlocksCount: number,
    maxBlockBatchSize: number,
    networkConfig: NetworkConfig,
  ) {
    this.#dataProvider = dataProvider
    this.storageProcessor = storageProcessor
    this.rollbackBlocksCount = rollbackBlocksCount
    this.checkTipMillis = checkTipSeconds * 1000
    this.maxBlockBatchSize = maxBlockBatchSize
    logger.debug('Checking tip every', checkTipSeconds, 'seconds')
    logger.debug('Rollback blocks count', rollbackBlocksCount)
    this.logger = logger
    this.blocksToStore = []
    this.lastBlock = null
    // TODO: this can't be the best way, can it? (for jormungandr next_id syncing)
    this.#genesisHash = networkConfig.genesisHash()
    this.networkProtocol = networkConfig.networkProtocol()
    logger.debug(`genesisHash = ${this.#genesisHash}`)
  }

  async rollback(atBlockHeight: number) {
    this.logger.info(`Rollback at height ${atBlockHeight} to ${this.rollbackBlocksCount} blocks back.`)
    // reset scheduler state
    this.blocksToStore = []
    this.lastBlock = null

    // Recover database state to newest actual block.
    const { height } = await this.storageProcessor.getBestBlockNum()
    const rollBackTo = height - this.rollbackBlocksCount
    this.logger.info(`Current DB height at rollback time: ${height}. Rolling back to: ${rollBackTo}`)
    await this.storageProcessor.rollbackTo(rollBackTo)
    const { epoch, hash } = await this.storageProcessor.getBestBlockNum()
    this.lastBlock = { epoch, hash }
  }


  async processEpochId(id: number, height: number) {
    this.logger.info(`processEpochId: ${id}, ${height}`)
    const omitEbb = true
    const blocks = await this.#dataProvider.getParsedEpochById(id, omitEbb)
    for (const block of blocks) {
      if (block.getHeight() > height) {
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
    if (this.lastBlock
      && block.getEpoch() === this.lastBlock.epoch
      && block.getPrevHash() !== this.lastBlock.hash) {
      const lastBlockHash = this.lastBlock ? this.lastBlock.hash : ''
      this.logger.info(`(${block.getEpoch()}/${String(block.getSlot())}) block.getPrevHash() (${block.getPrevHash()}) !== lastBlock.hash (${lastBlockHash}). Performing rollback...`)
      return STATUS_ROLLBACK_REQUIRED
    }
    this.lastBlock = {
      epoch: block.getEpoch(),
      hash: block.getHash(),
    }
    this.blocksToStore.push(block)
    if (this.blocksToStore.length > this.maxBlockBatchSize
      || flushCache
      || !_.isEmpty(block.getTxs())) {
      await this.pushCachedBlocksToStorage()
    }

    if (flushCache || block.getHeight() % LOG_BLOCK_PARSED_THRESHOLD === 0) {
      this.logger.debug(`Block parsed: ${block.getHash()} ${block.getEpoch()} ${String(block.getSlot())} ${block.getHeight()}`)
    }
    return BLOCK_STATUS_PROCESSED
  }

  async pushCachedBlocksToStorage() {
    if (this.blocksToStore.length > 0) {
      await this.storageProcessor.storeBlocksData(this.blocksToStore)
      this.blocksToStore = []
    }
  }

  async checkTip() {
    this.logger.info('checkTip: checking for new blocks...')
    // local state
    const { height, epoch, slot } = await this.storageProcessor.getBestBlockNum()

    // cardano-http-bridge state
    const nodeStatus = await this.#dataProvider.getStatus()
    const { packedEpochs, tip: nodeTip } = nodeStatus
    const tipStatus = nodeTip.local
    const remoteStatus = nodeTip.remote
    if (!tipStatus || !remoteStatus) {
      this.logger.info('cardano-http-brdige not yet synced')
      return
    }
    this.logger.debug(`Last imported block ${height}. Node status: local=${tipStatus.slot} remote=${remoteStatus.slot} packedEpochs=${packedEpochs}`)
    const [remEpoch, remSlot] = remoteStatus.slot
    if (epoch < remEpoch) {
      // If local epoch is lower than the current network tip
      // there's a potential for us to download full epochs, instead of single blocks
      // Calculate latest stable remote epoch
      const lastRemStableEpoch = remEpoch - (remSlot > 2160 ? 1 : 2)
      const thereAreMoreStableEpoch = epoch < lastRemStableEpoch
      const thereAreManyStableSlots = epoch === lastRemStableEpoch
        && (slot || 0) < EPOCH_DOWNLOAD_THRESHOLD
      // Check if there's any point to bother with whole epochs
      if (thereAreMoreStableEpoch || thereAreManyStableSlots) {
        // TODO: remove this once jormungandr supports epoch downloading
        if ('getParsedEpochById' in this.#dataProvider) {
          if (packedEpochs > epoch) {
            for (const epochId of _.range(epoch, packedEpochs)) {
              // Process epoch
              await this.processEpochId(epochId, height)
              this.logger.debug(`Epoch parsed: ${epochId}, ${height}`)
            }
            this.logger.debug('Finished loop for stable epochs. Pushing any cached blocks to storage.')
            await this.pushCachedBlocksToStorage()
          } else {
            // Packed epoch is not available yet
            this.logger.info(`cardano-http-brdige has not yet packed stable epoch: ${epoch} (lastRemStableEpoch=${lastRemStableEpoch})`)
          }
        } else {
          // Packed epoch is not available yet
          this.logger.info(`cardano-http-brdige has not yet packed stable epoch: ${epoch} (lastRemStableEpoch=${lastRemStableEpoch})`)
        }
        return
      }
    }
    // this is all temporary stuff that will either be removed if a height endpoint is added,
    // or will be refactored into an API like so:
    // this.#dataProvider.streamBlocks() within the data provider API.
    // For now this temporary change to cron.js is breaking with respect to Byron
    for (let blockHeight = height + 1, i = 0;
      (blockHeight <= tipStatus.height) && (i < MAX_BLOCKS_PER_LOOP);
      blockHeight++, i++) {
      this.logger.info(`requesting block at height ${blockHeight}`)
      let status
      if (this.networkProtocol === NETWORK_PROTOCOL.BYRON) {
        status = await this.processBlockHeight(blockHeight)
      } else {
        // TODO: remove this once jormungandr supports blocks by height, just querying consecutive
        // blocks here temporarily instead
        // const nextBlockId = (this.lastBlock == null) ? this.#genesisHash :
        // (await this.#dataProvider.getNextBlockId(this.lastBlock.hash).toString('hex'))
        let nextBlockId
        if (this.lastBlock == null) {
          nextBlockId = this.#genesisHash
        } else {
          const nextBlockIdRaw = await this.#dataProvider.getNextBlockId(this.lastBlock.hash)
          nextBlockId = nextBlockIdRaw.toString('hex')
        }
        this.logger.debug(`nextBlockId: ${nextBlockId}`)
        status = await this.processBlockById(nextBlockId)
      }

      if (status === STATUS_ROLLBACK_REQUIRED) {
        this.logger.info('Rollback required.')
        await this.rollback(blockHeight)
        return
      }
    }
  }

  async processBlockById(id: string) {
    const blockRaw = await this.#dataProvider.getBlock(id)
    this.logger.debug('blockRaw aquired.')
    const block = await this.#dataProvider.parseBlock(blockRaw)
    this.logger.debug(`block parsed: ${JSON.stringify(block)}`)
    const status = await this.processBlock(block, true)
    return status
  }

  async startAsync() {
    this.logger.info('Scheduler async: starting chain syncing loop')
    const currentMillis = () => new Date().getTime()
    const sleep = millis => new Promise(resolve => setTimeout(resolve, millis))
    for (;;) {
      const millisStart = currentMillis()
      let errorSleep = 0
      try {
        await this.checkTip()
      } catch (e) {
        const meta = ERROR_META[e.name]
        if (meta) {
          errorSleep = meta.sleep
          this.logger.warn(`Scheduler async: failed to check tip :: ${meta.msg}. Sleeping and retrying (err_sleep=${errorSleep})`)
        } else {
          throw e
        }
      }
      const millisEnd = currentMillis()
      const millisPassed = millisEnd - millisStart
      this.logger.debug(`Scheduler async: loop finished (millisPassed=${millisPassed})`)
      const millisSleep = errorSleep || (this.checkTipMillis - millisPassed)
      if (millisSleep > 0) {
        this.logger.debug('Scheduler async: sleeping for', millisSleep)
        await sleep(millisSleep)
      }
    }
  }
}

helpers.annotate(CronScheduler,
  [
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    'checkTipSeconds',
    SERVICE_IDENTIFIER.STORAGE_PROCESSOR,
    SERVICE_IDENTIFIER.LOGGER,
    'rollbackBlocksCount',
    'maxBlockBatchSize',
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])

export default CronScheduler
