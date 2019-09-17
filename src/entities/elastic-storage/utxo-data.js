// @flow

import ElasticData, { coinFormat } from './elastic-data'

const UTXO_OUTPUT_TYPE = 'output'

export const getTxInputUtxoId = (input) => `${UTXO_OUTPUT_TYPE}:${input.txId}:${input.idx}`

export type UtxoType = {
  tx_hash: string,
  tx_index: number,
  receiver: string,
  amount: number,
}

class UtxoData extends ElasticData {
  utxo: UtxoType

  type: string

  constructor(utxo: UtxoType) {
    super()
    this.utxo = utxo
    this.type = UTXO_OUTPUT_TYPE
  }

  getId() {
    return `${this.type}:${this.utxo.tx_hash}:${this.utxo.tx_index}`
  }

  getHash() {
    return this.utxo.tx_hash
  }

  toPlainObject() {
    return {
      id: this.getId(),
      type: this.type,
      tx_hash: this.utxo.tx_hash,
      branch: 0,
      tx_ordinal: 0,
      io_ordinal: 0,
      address: this.utxo.receiver,
      value: coinFormat(Number(this.utxo.amount)),
    }
  }
}

export default UtxoData
