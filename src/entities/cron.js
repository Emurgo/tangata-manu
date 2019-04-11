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
      await this.processBlock(height)
      this.#logger.debug(`Processing block ${height}`)
      cb()
    })
  }

  async processBlock(height: number) {
  }

  async onTick() {
    // local state
    const bestBlockNum = await this.#db.getBestBlockNum()
    // const lastBlock = await this.#db.getLastBlock()
    const block = await this.#db.getBlock(bestBlockNum)

    // cardano-http-bridge state
    const tipStatus = (await this.#dataProvider.getStatus()).tip.local
    this.#logger.debug(`Last block ${bestBlockNum}. Tip status ${tipStatus.slot}`)

    for (let { height } = block, i = 0; height <= tipStatus.height && i < 500; height++, i++) {
      this.#blockProcessQueue.push({ height })
    }

    //if (lastBlock.older())
    // const nextBlock = bestBlockNum + 1

    // cardano-http-bridge state

    /*
    // get next block
    const block = await this.#dataProvider.getBlockByHeight(nextBlock)
    // check status of next block
    if (!block) return

    const dbRes = await this.#db.storeBlock(block)
    this.#logger.debug(dbRes)
    */

    // check difference.
    // 1 get last processed block.
    // 2 get it
    // process bestBlockNum + 1
    /*
    const epoch = 3

    this.#logger.debug('Retrieving epoch', epoch)
    const data = await this.#dataProvider.getEpoch(epoch)

    this.#logger.debug('Parsing blocks in epoch', epoch)
    const epochParsed = this.#dataParser.parseEpoch(data)

    this.#logger.debug('Store transactions in epoch', epoch)
    const dbRes = await this.#db.storeEpoch(epochParsed)
    this.#logger.debug('Epoch stored with status', dbRes)
    */
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
