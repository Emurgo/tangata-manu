// flow
import cbor from 'cbor'
import bs58 from 'bs58'
import blake from 'blakejs'

type TxIdHexType = string
type TxBodyHexType = string

const structUtxo = (
  receiver,
  amount,
  utxoHash,
  txIndex = 0,
  blockNum = 0,
) => ({
  utxo_id: `${utxoHash}${txIndex}`,
  tx_hash: utxoHash,
  tx_index: txIndex,
  receiver,
  amount,
  block_num: blockNum,
})

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

class CborIndefiniteLengthArray {
  elements: Array<{}>

  constructor(elements) {
    this.elements = elements
  }

  encodeCBOR(encoder) {
    return encoder.push(
      Buffer.concat([
        Buffer.from([0x9f]), // indefinite array prefix
        ...this.elements.map((e) => cbor.encode(e)),
        Buffer.from([0xff]), // end of array
      ]),
    )
  }
}

const packRawTxIdAndBody = (decodedTxBody): [TxIdHexType, TxBodyHexType] => {
  if (!decodedTxBody) {
    throw new Error('Cannot decode inputs from undefined transaction!')
  }
  try {
    const [inputs, outputs, attributes] = decodedTxToBase(decodedTxBody)
    const enc = cbor.encode([
      new CborIndefiniteLengthArray(inputs),
      new CborIndefiniteLengthArray(outputs),
      attributes,
    ])
    const txId = blake.blake2bHex(enc, null, 32)
    const txBody = enc.toString('hex')
    return [txId, txBody]
  } catch (e) {
    throw new Error(`Failed to convert raw transaction to ID! ${JSON.stringify(e)}`)
  }
}

const rawTxToObj = (tx: Array<any>, extraData: {}) => {
  const [[inputs, outputs], witnesses] = tx
  const [txId, txBody] = packRawTxIdAndBody(tx)
  return {
    id: txId,
    inputs: inputs.map(inp => {
      const [type, tagged] = inp
      const [inputTxId, idx] = cbor.decode(tagged.value)
      return { type, txId: inputTxId.toString('hex'), idx }
    }),
    outputs: outputs.map(out => {
      const [address, value] = out
      return { address: bs58.encode(cbor.encode(address)), value }
    }),
    witnesses: witnesses.map(w => {
      const [type, tagged] = w
      return { type, sign: cbor.decode(tagged.value) }
    }),
    txBody,
    ...extraData,
  }
}

export default {
  structUtxo,
  rawTxToObj,
}
