// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type { RawDataProvider, Database } from '../../interfaces'
import { TX_STATUS } from '../../blockchain/common'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import type { ShelleyTxType } from '../../blockchain/shelley/tx'
import { sleep } from '../../utils'

import BaseScheduler from './base-scheduler'

class MempoolChecker extends BaseScheduler {
  dataProvider: RawDataProvider

  checkMempoolMillis: number

  db: Database<ShelleyTxType>

  constructor(
    checkMempoolSeconds: number,
    logger: Logger,
    dataProvider: RawDataProvider,
    db: Database<ShelleyTxType>,
  ) {
    super(logger)
    this.checkMempoolMillis = checkMempoolSeconds * 1000
    this.dataProvider = dataProvider
    this.db = db

    logger.debug('[MempoolChecker] Checking mempool every', checkMempoolSeconds, 'seconds')
  }

  async updateFailedTxs(txHashes: Array<string>): Promise<void> {
    if (_.isEmpty(txHashes)) {
      return
    }
    const pendingOnlyTxHashes = _.map(
      await this.db.selectPendingTxsOnly(txHashes), 'hash')
    await this.db.updateTxsStatus(pendingOnlyTxHashes, TX_STATUS.TX_FAILED_STATUS)
    for (const txHash of pendingOnlyTxHashes) {
      await this.db.addNewTxToTransientSnapshots(txHash, TX_STATUS.TX_FAILED_STATUS)
    }
  }

  async startAsync() {
    this.logger.info(`[${this.name}] starting checking mempool for failed transactions.`)
    for (;;) {
      const failedTxs = (await this.dataProvider.getMessagePoolLogs())
        .filter(msg => msg.status.Rejected !== undefined)
      failedTxs.forEach(tx => {
        this.logger.debug(`[MempoolChecker] TX_REJECTED ${tx.fragment_id}, reason=${tx.status.Rejected.reason}`)
      })

      await this.updateFailedTxs(_.map(failedTxs, 'fragment_id'))
      this.logger.debug(`Rejected txs: ${failedTxs}`)
      this.logger.debug('[MempoolChecker] async: loop finished')
      this.logger.debug('[MempoolChecker] async: sleeping for', this.checkMempoolMillis)
      await sleep(this.checkMempoolMillis)
    }
  }
}

helpers.annotate(MempoolChecker,
  [
    'checkMempoolSeconds',
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    SERVICE_IDENTIFIER.DATABASE,
  ])

export default MempoolChecker
