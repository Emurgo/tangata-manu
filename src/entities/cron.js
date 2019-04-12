// @flow
import cron from 'cron'

import { helpers } from 'inversify-vanillajs-helpers'
import queue from 'async/queue'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
  RawDataParser,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class CronScheduler implements Scheduler {
  #job: any

  #dataProvider: any

  #dataParser: any

  #db: any

  #logger: any

  #blockProcessQueue: any

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
    this.#blockProcessQueue = queue(async ({ height }, cb) => {
      const block = await this.processBlock(height)
      this.#logger.debug(`Processed  block ${block.hash} ${block.epoch} ${block.slot} ${block.height}`)
      cb()
    }, 1)
  }

  async processBlock(height: number) {
    const block = await this.#dataProvider.getBlockByHeight(height)
    await this.#db.storeBlock(block)
    await this.#db.updateBestBlockNum(block.height)
    return block
  }

  async onTick() {
    // local state
    const bestBlockNum = await this.#db.getBestBlockNum()

    // cardano-http-bridge state
    const tipStatus = (await this.#dataProvider.getStatus()).tip.local
    if (!tipStatus) {
      this.#logger.info('cardano-http-brdige not yet synced')
      return
    }
    this.#logger.debug(`Last block ${bestBlockNum}. Tip status ${tipStatus.slot}`)
    for (let height = bestBlockNum + 1, i = 0; (height <= tipStatus.height) && (i < 50);
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
    SERVICE_IDENTIFIER.RAW_DATA_PARSER,
    'checkTipCronTime',
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default CronScheduler
