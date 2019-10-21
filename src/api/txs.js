// @flow

import type { Logger } from 'bunyan'

import cbor from 'cbor'
import bs58 from 'bs58'
import blake from 'blakejs'
import _ from 'lodash'
// eslint-disable-next-line camelcase
import { sha3_256 } from 'js-sha3'

import { Request, Response } from 'restify'
import { Controller, Post } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'
import { injectable, decorate, inject } from 'inversify'

import {
  RawDataProvider, StorageProcessor, NetworkConfig, Validator,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import utils from '../blockchain/utils'
import { TX_STATUS } from '../blockchain'

import type { TxType } from '../blockchain'

class TxController implements IController {
  logger: Logger

  dataProvider: RawDataProvider

  storageProcessor: StorageProcessor

  validator: Validator

  constructor(
    logger: Logger,
    dataProvider: RawDataProvider,
    storageProcessor: StorageProcessor,
    validator: Validator,
  ) {
    this.logger = logger
    this.dataProvider = dataProvider
    this.storageProcessor = storageProcessor
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
      }
    } catch (err) {
      this.logger.error('Failed to store tx as pending!', err)
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
    const now = new Date()
    const tx = cbor.decode(Buffer.from(txPayload, 'base64'))
    const txObj = utils.rawTxToObj(tx, {
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
    await this.storageProcessor.storeTx(tx)
  }
}


decorate(injectable(), TxController)
decorate(Controller('/api/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

decorate(inject(SERVICE_IDENTIFIER.LOGGER), TxController, 0)
decorate(inject(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER), TxController, 1)
decorate(inject(SERVICE_IDENTIFIER.STORAGE_PROCESSOR), TxController, 2)
decorate(inject(SERVICE_IDENTIFIER.VALIDATOR), TxController, 3)

export default TxController
