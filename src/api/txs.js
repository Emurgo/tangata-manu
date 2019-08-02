// @flow
import cbor from 'cbor'

import { Request, Response } from 'restify'
import { Controller, Post } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'
import { injectable, decorate, inject } from 'inversify'

import { Logger, RawDataProvider, Database } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import utils from '../blockchain/utils'
import { TX_STATUS } from '../blockchain'

class TxController implements IController {
  logger: Logger

  dataProvider: RawDataProvider

  db: Database

  constructor(logger: Logger, dataProvider: RawDataProvider, db: Database) {
    this.logger = logger
    this.dataProvider = dataProvider
    this.db = db
  }

  async signed(req: Request, resp: Response, next: Function) {
    const bridgeResp = await this.dataProvider.postSignedTx(req.rawBody)
    resp.status(bridgeResp.status)
    this.logger.debug('TxController.index called', req.params, bridgeResp.status)
    if (bridgeResp.status === 200) {
      // store tx as pending
      await this.storeTxAsPending(req.body.signedTx)
    }
    // eslint-disable-next-line no-param-reassign
    resp.statusText = bridgeResp.statusText
    resp.send(bridgeResp.data)
    next()
  }

  async storeTxAsPending(txPayload: string) {
    this.logger.debug(`txs.storeTxAsPending ${txPayload}`)
    const now = new Date().toUTCString()
    const tx = cbor.decode(Buffer.from(txPayload, 'base64'))
    const txObj = utils.rawTxToObj(tx, {
      txTime: now,
      status: TX_STATUS.TX_PENDING_STATUS,
      blockNum: null,
      blockHash: null,
    })
    await this.db.storeTx(txObj)
    this.logger.debug('txObj', txObj)
  }
}


decorate(injectable(), TxController)
decorate(Controller('/api/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

decorate(inject(SERVICE_IDENTIFIER.LOGGER), TxController, 0)
decorate(inject(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER), TxController, 1)
decorate(inject(SERVICE_IDENTIFIER.DATABASE), TxController, 2)

export default TxController
