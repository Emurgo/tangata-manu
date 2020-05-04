// @flow

import cbor from 'cbor'
import borc from 'borc'
import bs58 from 'bs58'
import blake from 'blakejs'

import type { TxType } from '../common'

type TxIdHexType = string
type TxBodyHexType = string

const decodedTxToBase = (decodedTx) => {
  if (Array.isArray(decodedTx)) {
    // eslint-disable-next-line default-case
    switch (decodedTx.length) {
      case 2: {
        const signed = decodedTx
        return signed[0]
      }
      case 3: {
        const base = decodedTx
        return base
      }
    }
  }
  throw new Error(`Unexpected decoded tx structure! ${JSON.stringify(decodedTx)}`)
}

type CborEncoderType = {
  encode: Function
}

class CborIndefiniteLengthArray {
  elements: Array<{...}>

  cborEncoder: CborEncoderType

  constructor(elements, cborEncoder) {
    this.elements = elements
    this.cborEncoder = cborEncoder
  }

  encodeCBOR(encoder) {
    return encoder.push(
      Buffer.concat([
        Buffer.from([0x9f]), // indefinite array prefix
        ...this.elements.map((e) => this.cborEncoder.encode(e)),
        Buffer.from([0xff]), // end of array
      ]),
    )
  }
}

const selectCborEncoder = (outputs): CborEncoderType => {
  const maxAddressLen = Math.max(...outputs.map(([[taggedAddress]]) => taggedAddress.value.length))
  if (maxAddressLen > 5000) {
    return borc
  }
  return cbor
}

const packRawTxIdAndBody = (decodedTxBody): [TxIdHexType, TxBodyHexType] => {
  if (!decodedTxBody) {
    throw new Error('Cannot decode inputs from undefined transaction!')
  }
  try {
    const [inputs, outputs, attributes] = decodedTxToBase(decodedTxBody)
    const cborEncoder: CborEncoderType = selectCborEncoder(outputs)
    const enc = cborEncoder.encode([
      new CborIndefiniteLengthArray(inputs, cborEncoder),
      new CborIndefiniteLengthArray(outputs, cborEncoder),
      attributes,
    ])
    const txId = blake.blake2bHex(enc, null, 32)
    const txBody = enc.toString('hex')
    return [txId, txBody]
  } catch (e) {
    throw new Error(`Failed to convert raw transaction to ID! ${JSON.stringify(e)}`)
  }
}

const rawTxToObj = (tx: Array<any>, extraData: {
  blockHash: ?string,
  blockNum: ?number,
  txOrdinal: ?number,
  txTime: Date,
  ...
}): TxType => {
  const [[inputs, outputs], witnesses] = tx
  const [txId, txBody] = packRawTxIdAndBody(tx)
  return {
    ...extraData,
    isGenesis: false,
    id: txId,
    inputs: inputs.map(inp => {
      const [type, tagged] = inp
      const [inputTxId, idx] = cbor.decode(tagged.value)
      // While not stored in the DB, we keep the input type (0 = utxo, 1 = script, 2 = redeem)
      // available here if needed. It is used in tx validation for the tx send endpoint
      return {
        byronInputType: type,
        type: 'utxo',
        txId: inputTxId.toString('hex'),
        idx,
      }
    }),
    outputs: outputs.map(out => {
      const [address, value] = out
      return { address: bs58.encode(cbor.encode(address)), value }
    }),
    // witnesses are also not stored in the DB, but we keep them here for similar
    // reasons as input types
    witnesses: witnesses.map(w => {
      const [type, tagged] = w
      return { type, sign: cbor.decode(tagged.value) }
    }),
    txBody,
  }
}

const headerToId: (string, number) => string = (header, type) => {
  const headerData = cbor.encode([type, header])
  const id = blake.blake2bHex(headerData, null, 32)
  return id
}

export default {
  rawTxToObj,
  headerToId,
}
