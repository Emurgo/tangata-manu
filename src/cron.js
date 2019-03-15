// @flow

import crypto from 'crypto'
import cron from 'cron'

import Q from './db-queries'

/* eslint class-methods-use-this: ["error", { "exceptMethods": ["onTick"] }] */
export class YoroiBaseJob {
  context: any

  job: any

  constructor(config: any) {
    this.context = { ...config.context }
    this.job = new cron.CronJob({
      ...config,
      onTick: () => this.onTick(),
    })
  }

  onTick() {
    throw new Error('You have to implement the method onTick!')
  }

  start() {
    this.job.start()
  }
}

export class CheckBlockchainTipJob extends YoroiBaseJob {
  async onTick() {
    /*  Check blockchain tip block and store it to database if it is not yet stored.
    */
    const { db, logger, dataProvider } = this.context
    const tip = await dataProvider.getTip()
    const blockHash = crypto.createHash('md5')
    const hexHash = blockHash.update(tip.data).digest('hex')
    const dbRes = await db.query(Q.upsertBlockHash, [hexHash])
    logger.info(dbRes.rowCount > 0 ? 'New block added' : 'DB is up-to-date')
  }
}

const jobs = [
  CheckBlockchainTipJob,
]

export default jobs
