// @flow
import crypto from 'crypto'
import cron from 'cron'

import { helpers } from 'inversify-vanillajs-helpers'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
  RawDataParser,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

import Q from '../db-queries'

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #dataParser: any

  #db: any

  #logger: any

  constructor(
    dataProvider: RawDataProvider,
    dataParser: RawDataParser,
    checkTipCronTime: string,
    db: Database,
    logger: Logger,
  ) {
    this.#dataProvider = dataProvider
    this.#dataParser = dataParser
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
    const parsedTip = this.#dataParser.parse(tip.data)
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
    SERVICE_IDENTIFIER.RAW_DATA_PARSER,
    'checkTipCronTime',
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default CronScheduler
