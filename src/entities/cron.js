// @flow
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
    logger.debug('Cron time', checkTipCronTime)
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
    const epoch = 3

    this.#logger.debug('Retrieving epoch', epoch)
    const data = await this.#dataProvider.getEpoch(epoch)

    this.#logger.debug('Parsing blocks in epoch', epoch)
    const epochParsed = this.#dataParser.parseEpoch(data)

    this.#logger.debug('Store transactions in epoch', epoch)
    const dbRes = await this.#db.storeEpoch(epochParsed)
    this.#logger.debug('Epoch stored with status', dbRes)
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
