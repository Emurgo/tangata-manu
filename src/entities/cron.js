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
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import Block from '../blockchain'

const EPOCH_DOWNLOAD_THRESHOLD = 14400

const QUEUE_MAX_LENGTH = 10000

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #db: any

  #logger: any

  #blockProcessQueue: any

  #instanceBestBlock: number

  constructor(
    dataProvider: RawDataProvider,
    checkTipCronTime: string,
    db: Database,
    logger: Logger,
  ) {
    this.#dataProvider = dataProvider
    logger.debug('Cron time', checkTipCronTime)
    this.#job = new cron.CronJob({
      cronTime: checkTipCronTime,
      onTick: () => {
        this.onTick()
      },
    })
    this.#db = db
    this.#logger = logger
    this.#instanceBestBlock = -1

    this.#blockProcessQueue = queue(async ({ type, height, epoch }, cb) => {
      if (type === 'block') {
        await this.processBlockHeight(height)
      } else if (type === 'epoch') {
        await this.processEpochId(epoch, height)
      }
      cb()
    }, 1)
  }

  static _filterEbb(blocks: Array<Block>): Array<Block> {
    return !blocks ? blocks : ( blocks[0].isEBB ? blocks.slice(1) : blocks )
  }

  async processEpochId(id: number, height: number) {
    this.#logger.info(`processEpochId: ${id}, ${height}`)
    const blocks = CronScheduler._filterEbb(await this.#dataProvider.getParsedEpochById(id))
    if (!blocks) {
      this.#logger.warn(`empty epoch: ${id}, ${height}`)
      return
    }
    const epochLength = blocks.length
    const blocksBeforeThisEpoch = blocks[0].height - 1
    const continueFromHeight = height > blocksBeforeThisEpoch ? height - blocksBeforeThisEpoch : 0;
    if (height > 0) {
      const params = { epochLength, blocksBeforeThisEpoch, continueFromHeight }
      this.#logger.info(`height continuation math: ${JSON.stringify(params)}`)
    }
    for (let i = continueFromHeight; i < epochLength; i++) {
      const block = blocks[i]
      if (!block) {
        throw new Error(`!block @ ${i} / ${blocks.length}`)
      }
      await this.processBlock(block)
    }
  }

  async processBlockHeight(height: number) {
    const block = await this.#dataProvider.getBlockByHeight(height)
    await this.processBlock(block)
  }

  async processBlock(block: Block) {
    const dbConn = this.#db.getConn()
    try {
      await dbConn.query('BEGIN')
      await this.#db.storeBlock(block)
      if (!_.isEmpty(block.txs)) {
        await this.#db.storeBlockTxs(block)
      }
      await this.#db.updateBestBlockNum(block.height)
      await dbConn.query('COMMIT')
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    } finally {
      this.#logger.trace(`Block processed: ${block.hash} ${block.epoch} ${block.slot} ${block.height}`)
    }
  }

  async onTick() {
    this.#logger.info('onTick:checking for new blocks...')
    try {
      // local state
      const { height, epoch, slot } = await this.#db.getBestBlockNum()
      this.#logger.info(`Tip @ ${height} | Slot: ${epoch} / ${slot}`)

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
            for (let epochId = epoch; (epochId <= packedEpochs); epochId++) {
              this.#blockProcessQueue.push({
                type: 'epoch',
                epoch: epochId,
               height: (epochId === epoch ? height : 0),
              })
            }
          } else {
            // Packed epoch is not available yet
            this.#logger.info(`cardano-http-brdige has not yet packed stable epoch: ${epoch} (lastRemStableEpoch=${lastRemStableEpoch})`)
          }
          return
        }
      }
      for (let blockHeight = height + 1, i = 0; (blockHeight <= tipStatus.height) && (i < 9000);
        blockHeight++, i++) {
        this.#blockProcessQueue.push({ type: 'block', height: blockHeight })
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
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default CronScheduler
