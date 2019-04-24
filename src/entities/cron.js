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

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #db: any

  #logger: any

  #blockProcessQueue: any

  #isAlreadyRun: boolean

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
      onComplete: () => {
        this.setRunningState(false)
      },
    })
    this.#db = db
    this.#logger = logger

    // Prevent to run several jobs simultaneously.
    this.#isAlreadyRun = false
    this.#blockProcessQueue = queue(async ({ height }, cb) => {
      await this.processBlock(height)
      cb()
    }, 1)
  }

  setRunningState(value) {
    this.#isAlreadyRun = value
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
    if (this.#isAlreadyRun) return
    this.setRunningState(true)
    // local state
    const bestBlockNum = await this.#db.getBestBlockNum()

    // cardano-http-bridge state
    const tipStatus = (await this.#dataProvider.getStatus()).tip.local
    if (!tipStatus) {
      this.#logger.info('cardano-http-brdige not yet synced')
      return
    }
    this.#logger.debug(`Last block ${bestBlockNum}. Tip status ${tipStatus.slot}`)
    for (let height = bestBlockNum + 1, i = 0; (height <= tipStatus.height) && (i < 9000);
      // eslint-disable-next-line no-plusplus
      height++, i++) {
      this.#blockProcessQueue.push({ height })
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
