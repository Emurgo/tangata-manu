// @flow
import cbor from 'cbor'
import bs58 from 'bs58'
import { sha3_256 } from 'js-sha3'
import blake from 'blakejs'

import { Request } from 'restify'
import { Controller, Post } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'
import { injectable, decorate, inject } from 'inversify'

import { Logger, RawDataProvider, Database } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import utils from '../blockchain/utils'

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
    try {
      await this.validateTxWitnesses(txObj)
    } catch (e) {
      resp.status(400)
      resp.statusText = 'Transaction failed validation'
      resp.send(`Transaction validation error: ${e}`)
      next()
    }
    const bridgeResp = await this.dataProvider.postSignedTx(req.rawBody)
    resp.status(bridgeResp.status)
    this.logger.debug('TxController.index called', req.params, bridgeResp.status)
    if (bridgeResp.status !== 200) {
      // store tx as pending
      await this.storeTxAsPending(req.body.signedTx)
    }
    // eslint-disable-next-line no-param-reassign
    resp.statusText = bridgeResp.statusText
    resp.send(bridgeResp.data)
    next()
  }

  async storeTxAsPending(txObj) {
    this.logger.debug(`txs.storeTxAsPending ${txObj}`)
  }

  parseRawTx(txPayload: string) {
    this.logger.debug(`txs.parseRawTx ${txPayload}`)
    const tx = cbor.decode(Buffer.from(txPayload, 'base64'))
    const txObj = utils.rawTxToObj(tx, {
      txTime: '11',
      status: 'PENDING',
    })
    this.logger.debug('txObj', txObj)
    return txObj
  }

  async validateTxWitnesses({ id, inputs, witnesses }) {
    this.logger.debug(`Validating witnesses for tx: ${id}`)
    const inp_len = inputs.length
    const wit_len = witnesses.length
    if (inp_len !== wit_len) {
      throw new Error(`Number of inputs (${inp_len}) != the number of witnesses (${wit_len})`)
    }
    const txHashes = inputs.map(({ txId }) => txId)
    const fullOutputs = await this.db.getOutputsForTxHashes(txHashes)
    for (let i = 0; i < inp_len; i++) {
      const { type: inputType, txId: inputTxId, idx: inputIdx } = inputs[i]
      const { type: witnessType, sign } = witnesses[i]
      if (inputType !== 0 || witnessType !== 0) {
        this.logger.debug(`Ignoring non-regular input/witness types: ${
          JSON.stringify({ inputType, witnessType })
        }`)
      }
      this.logger.debug(`Validating witness for input: ${inputTxId}.${inputIdx}`)
      const { address: inputAddress, amount: inputAmount } = fullOutputs[inputTxId][inputIdx]
      this.logger.debug(`Input details: ${inputAmount} from ${inputAddress}`)
      const [addressRoot, addrAttr, addressType] = cbor.decode(cbor.decode(bs58.decode(inputAddress))[0].value)
      if (addressType !== 0) {
        this.logger.debug(`Unsupported address type: ${addressType}. Skipping witness validation for this input.`)
        continue
      }
      this.logger.debug(`Address root: ${addressRoot.toString('hex')}`)
      const expectedStruct = [0, [0, sign[0]], addrAttr]
      const encodedStruct = Buffer.from(sha3_256.update(cbor.encodeCanonical(expectedStruct)).digest());
      const expectedRoot = blake.blake2bHex(encodedStruct, undefined, 28)
      if (addressRoot !== expectedRoot) {
        this.logger.warn(`Witness does not match! ${JSON.stringify({ addressRoot, expectedRoot })}`)
      }
    }
  }
}


decorate(injectable(), TxController)
decorate(Controller('/:network/txs'), TxController)
decorate(Post('/signed'), TxController.prototype, 'signed')

decorate(inject(SERVICE_IDENTIFIER.LOGGER), TxController, 0)
decorate(inject(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER), TxController, 1)
decorate(inject(SERVICE_IDENTIFIER.DATABASE), TxController, 2)

export default TxController
