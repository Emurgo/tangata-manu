// @flow

import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type { Scheduler, RawDataProvider } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { sleep } from '../../utils'

class MempoolChecker implements Scheduler {
  dataProvider: RawDataProvider

  logger: Logger

  checkMempoolSeconds: number

  constructor(
    checkMempoolSeconds: number,
    logger: Logger,
    dataProvider: RawDataProvider,
  ) {
    this.checkMempoolSeconds = checkMempoolSeconds
    this.dataProvider = dataProvider

    logger.debug('[MempoolChecker] Checking mempool every', checkMempoolSeconds, 'seconds')
    this.logger = logger
  }

  async startAsync() {
    this.logger.info('Checking mempool for pending transactions.')
  }
}

helpers.annotate(MempoolChecker,
  [
    'checkMempoolSeconds',
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
  ])

export default MempoolChecker
