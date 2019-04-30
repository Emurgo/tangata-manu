// @flow
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

const QUEUE_MAX_LENGTH = 10000

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #db: any

  #logger: any

  #blockProcessQueue: any

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

    this.#blockProcessQueue = queue(async ({ height }, cb) => {
      await this.processBlock(height)
      cb()
    }, 1)
  }

  async processBlock(height: number) {
    const block = await this.#dataProvider.getBlockByHeight(height)
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
      this.#logger.debug(`Block parsed: ${block.hash} ${block.epoch} ${block.slot} ${block.height}`)
    }
    return block
  }

  async onTick() {
    this.#logger.info('onTick:checking for new blocks...')
    try {
      // local state
      const bestBlockNum = await this.#db.getBestBlockNum()

      // Blocks which already in queue, but not yet processed.
      const notProcessedBlocks = this.#blockProcessQueue.length()
      if (notProcessedBlocks > QUEUE_MAX_LENGTH) {
        this.#logger.info('Too many not yet processed blocks in queue. Skip to add new blocks.')
      }
      const nextBlockHeight = bestBlockNum + notProcessedBlocks + 1

      // cardano-http-bridge state
      const tipStatus = (await this.#dataProvider.getStatus()).tip.local
      if (!tipStatus) {
        this.#logger.info('cardano-http-brdige not yet synced')
        return
      }
      this.#logger.debug(`Last block ${bestBlockNum}. Tip status ${tipStatus.slot}`)
      for (let height = nextBlockHeight, i = 0; (height <= tipStatus.height) && (i < 9000);
        // eslint-disable-next-line no-plusplus
        height++, i++) {
        this.#blockProcessQueue.push({ height })
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
