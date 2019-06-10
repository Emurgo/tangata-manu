// @flow
import { Request } from 'restify'
import { Controller, Post } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'
import { injectable, decorate, inject } from 'inversify'

import { Logger, RawDataProvider } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class TxController implements IController {
  logger: Logger

  dataProvider: RawDataProvider

  constructor(logger: Logger, dataProvider: RawDataProvider) {
    this.logger = logger
    this.dataProvider = dataProvider
  }

  async signed(req: Request) {
    const payload = req.read().toString()
    this.logger.debug('TxController.index called', req.params, payload)
    this.dataProvider.postSignedTx(payload)
    return 'OK'
  }
}


decorate(injectable(), TxController)
decorate(Controller('/:network/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

decorate(inject(SERVICE_IDENTIFIER.LOGGER), TxController, 0)
decorate(inject(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER), TxController, 1)

export default TxController
