// @flow

import type { Logger } from 'bunyan'

import _ from 'lodash'

import { Request, Response } from 'restify'
import { Controller, Post } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'
import { decorate } from 'inversify'
import { helpers } from 'inversify-vanillajs-helpers'

import {
  RawDataParser, RawDataProvider, Database, Validator,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import { TX_STATUS } from '../blockchain/common'

import type { TxType } from '../blockchain/common'

class TxController implements IController {
  logger: Logger

  dataProvider: RawDataProvider

  parser: RawDataParser

  db: Database

  validator: Validator

  constructor(
    logger: Logger,
    dataProvider: RawDataProvider,
    parser: RawDataParser,
    db: Database,
    validator: Validator,
  ) {
    this.logger = logger
    this.dataProvider = dataProvider
    this.parser = parser
    this.db = db
    this.validator = validator
  }

  async signed(req: Request, resp: Response, next: Function) {
    const txObj = this.parseRawTx(req.body.signedTx)
    const localValidationError = await this.validator.validateTx(txObj)
    if (localValidationError) {
      this.logger.error(`Local tx validation failed: ${localValidationError}`)
      this.logger.info('Proceeding to send tx to network for double-check')
    }
    const bridgeResp = await this.dataProvider.postSignedTx(req.rawBody)
    this.logger.debug('TxController.index called', req.params, bridgeResp.status, `(${bridgeResp.statusText})`, bridgeResp.data)
    try {
      if (bridgeResp.status === 200) {
        // store tx as pending
        await this.storeTxAsPending(txObj)
        if (localValidationError) {
          // Network success but locally we failed validation - log local
          this.logger.warn('Local validation error, but network send succeeded!')
        }
      } else {
        await this.storeTxAsFailed(txObj)
      }
    } catch (err) {
      this.logger.error('Failed to store tx', err)
      throw new Error('Internal DB fail in the importer!')
    }
    let statusText
    let status
    let respBody
    if (localValidationError && bridgeResp.status !== 200) {
      // We have local validation error and network failed too
      // We send specific local response with network response attached
      status = 400
      statusText = `Transaction failed local validation (Network status: ${bridgeResp.statusText})`
      respBody = `Transaction validation error: ${localValidationError} (Network response: ${bridgeResp.data})`
    } else {
      // Locally we have no validation errors - proxy the network response
      ({ status, statusText } = bridgeResp)
      respBody = bridgeResp.data
    }
    resp.status(status)
    // eslint-disable-next-line no-param-reassign
    resp.statusText = statusText
    resp.send(respBody)
    next()
  }

  parseRawTx(txPayload: string): TxType {
    this.logger.debug(`txs.parseRawTx ${txPayload}`)
    const txRaw = Buffer.from(txPayload, 'base64')
    const now = new Date()
    const txObj = this.parser.parseTx(txRaw, {
      txTime: now,
      txOrdinal: null,
      status: TX_STATUS.TX_PENDING_STATUS,
      blockNum: null,
      blockHash: null,
    })
    return txObj
  }

  async storeTxAsPending(tx: TxType) {
    this.logger.debug(`txs.storeTxAsPending ${JSON.stringify(tx)}`)
    return this.db.storeTx(tx)
  }

  async storeTxAsFailed(tx: TxType) {
    const failedTx = {
      ...tx,
      status: TX_STATUS.TX_FAILED_STATUS,
    }
    this.logger.debug(`txs.storeTxAsFailed ${JSON.stringify(tx)}`)
    return this.db.storeTx(failedTx, [], false)
  }

}

helpers.annotate(TxController, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
  SERVICE_IDENTIFIER.RAW_DATA_PARSER,
  SERVICE_IDENTIFIER.DATABASE,
  SERVICE_IDENTIFIER.VALIDATOR,
])

decorate(Controller('/api/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

export default TxController
