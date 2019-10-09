// @flow

import ElasticData, { coinFormat } from './elastic-data'
import type { TxInputType } from '../../blockchain/tx'

const UTXO_OUTPUT_TYPE = 'output'

export type UtxoType = {
  tx_hash: string,
  tx_index: number,
  receiver: string,
  amount: number,
}

export const getTxInputUtxoId = (input: TxInputType) => `${UTXO_OUTPUT_TYPE}:${input.txId}:${input.idx}`

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
      io_ordinal: this.utxo.tx_index,
      address: this.utxo.receiver,
      value: coinFormat(Number(this.utxo.amount)),
    }
  }
}

export default UtxoData
