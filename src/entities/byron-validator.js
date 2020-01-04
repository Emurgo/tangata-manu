// @flow

import type { Logger } from 'bunyan'
import _ from 'lodash'
import cbor from 'cbor'
import bs58 from 'bs58'
import blake from 'blakejs'
// eslint-disable-next-line camelcase
import { sha3_256 } from 'js-sha3'
import { helpers } from 'inversify-vanillajs-helpers'


import type { TxType, UtxoInput } from '../blockchain/common'
import {
  Database, NetworkConfig, Validator,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'


class ByronValidator implements Validator {
  logger: Logger

  db: Database<TxType>

  expectedNetworkMagic: number

  constructor(
    logger: Logger,
    db: Database<TxType>,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.db = db
    this.expectedNetworkMagic = networkConfig.networkMagic()
  }

  async validateTx(txObj: TxType) {
    try {
      await this.validateDuplicates(txObj)
      await this.validateInputs(txObj)
      await this.validateTxWitnesses(txObj)
      this.validateDestinationNetwork(txObj)
      return null
    } catch (e) {
      return e
    }
  }

  async validateInputs({ id, inputs }: TxType) {
    const allUtxosForInputsExists = await this.db.utxosForInputsExists(inputs)
    if (!allUtxosForInputsExists) {
      const txsForInputsExists = await this.db.txsForInputsExists(inputs)
      if (txsForInputsExists) {
        throw new Error(`UTxOs for tx ${id} already spent`)
      }
    }
  }

  async validateDuplicates(tx: TxType) {
    const txExists = this.db.isTxExists(tx.id)
    if (txExists) {
      throw new Error(`Tx ${tx.id} already exists.`)
    }
  }

  async validateTxWitnesses({ id, inputs, witnesses }: TxType) {
    const inpLen = inputs.length
    const witLen = witnesses.length
    this.logger.debug(`Validating witnesses for tx: ${id} (inputs: ${inpLen})`)
    if (inpLen !== witLen) {
      throw new Error(`Number of inputs (${inpLen}) != the number of witnesses (${witLen})`)
    }
    const utxoInputs: Array<UtxoInput> = inputs.map(inp => {
      switch (inp.type) {
        case 'utxo':
          return inp
        default:
          throw new Error(`non-UTXO input found: ${JSON.stringify(inp)}`)
      }
    })

    const txHashes = _.uniq(utxoInputs.map(({ txId }) => txId))
    const fullOutputs = await this.db.getOutputsForTxHashes(txHashes)

    _.zip(utxoInputs, witnesses).forEach(([input, witness]) => {
      const { byronInputType: inputType, txId: inputTxId, idx: inputIdx } = input
      const { type: witnessType, sign } = witness
      if (inputType !== 0 || witnessType !== 0) {
        this.logger.debug(`Ignoring non-regular input/witness types: ${
          JSON.stringify({ inputType, witnessType })
        }`)
      }
      const txOutputs = fullOutputs[inputTxId]
      if (!txOutputs) {
        throw new Error(`No UTxO is found for tx ${inputTxId}! Maybe the blockchain is still syncing? If not - something is wrong.`)
      }
      const { address: inputAddress, amount: inputAmount } = txOutputs[inputIdx]
      this.logger.debug(`Validating witness for input: ${inputTxId}.${inputIdx} (${inputAmount} coin from ${inputAddress})`)
      const { addressRoot, addrAttr, addressType } = ByronValidator.deconstructAddress(inputAddress)
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

  validateDestinationNetwork({ outputs }: TxType) {
    this.logger.debug(`Validating output network (outputs: ${outputs.length})`)
    outputs.forEach(({ address }, i) => {
      this.logger.debug(`Validating network for ${address}`)
      const { addrAttr } = ByronValidator.deconstructAddress(address)
      const networkAttr: Buffer = addrAttr && addrAttr.get && addrAttr.get(2)
      const networkMagic = networkAttr && networkAttr.readInt32BE(1)
      if (networkMagic !== this.expectedNetworkMagic) {
        throw new Error(`Output #${i} network magic is ${networkMagic}, expected ${this.expectedNetworkMagic}`)
      }
    })
  }

  static deconstructAddress(address: string) {
    const [addressRoot, addrAttr, addressType] = cbor.decode(
      cbor.decode(bs58.decode(address))[0].value,
    )
    return { addressRoot, addrAttr, addressType }
  }
}

helpers.annotate(ByronValidator, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.DATABASE,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default ByronValidator
