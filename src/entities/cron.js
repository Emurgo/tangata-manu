// @flow
import crypto from 'crypto'
import cron from 'cron'

import { helpers } from 'inversify-vanillajs-helpers'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

import Q from '../db-queries'

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #db: any

  #logger: any

  constructor(
    dataProvider: RawDataProvider,
    checkTipCronTime: string,
    db: Database,
    logger: Logger,
  ) {
    this.#dataProvider = dataProvider
    this.#job = new cron.CronJob({
      cronTime: checkTipCronTime,
      onTick: () => {
        this.onTick()
      },
    })
    this.#db = db
    this.#logger = logger
  }

  async onTick() {
    const db = await this.#db.getConn()
    const tip = await this.#dataProvider.getTip()
    const blockHash = crypto.createHash('md5')
    const hexHash = blockHash.update(tip.data).digest('hex')
    const dbRes = await db.query(Q.upsertBlockHash, [hexHash])
    this.#logger.info(dbRes.rowCount > 0 ? 'New block added' : 'DB is up-to-date')
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
