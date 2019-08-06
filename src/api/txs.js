// @flow
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
    const txObj = this.parseRawTx(req.body.signedTx)
    const localValidationError = await this.validateTx(txObj)
    if (localValidationError) {
      this.logger.error(`Local tx validation failed: ${localValidationError}`)
      this.logger.info('Proceeding to send tx to network for double-check')
    }
    const bridgeResp = await this.dataProvider.postSignedTx(req.rawBody)
    this.logger.debug('TxController.index called', req.params, bridgeResp.status, `(${bridgeResp.statusText})`, bridgeResp.data)
    if (bridgeResp.status === 200) {
      // store tx as pending
      await this.storeTxAsPending(txObj)
      if (localValidationError) {
        // Network success but locally we failed validation - log local
        this.logger.warn('Local validation error, but network send succeeded!')
      }
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

  parseRawTx(txPayload: string) {
    this.logger.debug(`txs.parseRawTx ${txPayload}`)
    const now = new Date().toUTCString()
    const tx = cbor.decode(Buffer.from(txPayload, 'base64'))
    const txObj = utils.rawTxToObj(tx, {
      txTime: now,
      status: TX_STATUS.TX_PENDING_STATUS,
      blockNum: null,
      blockHash: null,
    })
    return txObj
  }

  async storeTxAsPending(tx) {
    this.logger.debug(`txs.storeTxAsPending ${JSON.stringify(tx)}`)
    await this.db.storeTx(tx)
  }

  async validateTx(txObj) {
    try {
      await this.validateTxWitnesses(txObj)
      // TODO: more validation
      return null
    } catch (e) {
      return e
    }
  }

  async validateTxWitnesses({ id, inputs, witnesses }) {
    const inpLen = inputs.length
    const witLen = witnesses.length
    this.logger.debug(`Validating witnesses for tx: ${id} (${inpLen} inputs)`)
    if (inpLen !== witLen) {
      throw new Error(`Number of inputs (${inpLen}) != the number of witnesses (${witLen})`)
    }
    const txHashes = inputs.map(({ txId }) => txId)
    const fullOutputs = await this.db.getOutputsForTxHashes(txHashes)

    _.zip(inputs, witnesses, fullOutputs).forEach(([input, witness, fullOutput]) => {
      const { type: inputType, txId: inputTxId, idx: inputIdx } = input
      const { type: witnessType, sign } = witness
      if (inputType !== 0 || witnessType !== 0) {
        this.logger.debug(`Ignoring non-regular input/witness types: ${
          JSON.stringify({ inputType, witnessType })
        }`)
      }
      const { address: inputAddress, amount: inputAmount } = fullOutput[inputIdx]
      this.logger.debug(`Validating witness for input: ${inputTxId}.${inputIdx} (${inputAmount} coin from ${inputAddress})`)
      const [addressRoot, addrAttr, addressType] = cbor.decode(
        cbor.decode(bs58.decode(inputAddress))[0].value)
      if (addressType !== 0) {
        this.logger.debug(`Unsupported address type: ${addressType}. Skipping witness validation for this input.`)
        return
      }
      const addressRootHex = addressRoot.toString('hex')
      const expectedStruct = [0, [0, sign[0]], addrAttr]
      const encodedStruct = Buffer.from(sha3_256.update(
        cbor.encodeCanonical(expectedStruct)).digest())
      const expectedRootHex = blake.blake2bHex(encodedStruct, undefined, 28)
      if (addressRootHex !== expectedRootHex) {
        throw new Error(`Witness does not match! ${JSON.stringify({ addressRootHex, expectedRoot: expectedRootHex })}`)
      }
    })
  }
}


decorate(injectable(), TxController)
decorate(Controller('/api/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

decorate(inject(SERVICE_IDENTIFIER.LOGGER), TxController, 0)
decorate(inject(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER), TxController, 1)
decorate(inject(SERVICE_IDENTIFIER.DATABASE), TxController, 2)

export default TxController
