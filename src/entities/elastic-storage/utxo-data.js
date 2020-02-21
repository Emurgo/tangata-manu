// @flow

import type { CoinDataType } from './elastic-data'
import ElasticData, { coinFormat } from './elastic-data'
import type { TxInputType } from '../../blockchain/common'

const UTXO_OUTPUT_TYPE = 'output'

export type UtxoType = {
  tx_hash: string,
  tx_index: number,
  receiver: string,
  amount: number,
}

export type UtxoPlainObjectType = {
  id: string,
  type: string,
  tx_hash: string,
  block_hash: string,
  branch: number,
  tx_ordinal: number,
  io_ordinal: number,
  address: string,
  value: CoinDataType,
}

export const getTxInputUtxoId = (input: TxInputType) => {
  switch (input.type) {
    case 'utxo':
      return `${UTXO_OUTPUT_TYPE}:${input.txId}:${input.idx}`
    // TODO: implement for accounts
    default:
      throw Error(`getTxInputUtxoId(): unsupported TxInputType ${input.type}`)
  }
}

class UtxoData extends ElasticData {
  utxo: UtxoType

  type: string

  #isInput: boolean

  #isAccount: boolean

  constructor(utxo: UtxoType) {
    super()
    this.utxo = utxo
    this.type = UTXO_OUTPUT_TYPE
    this.#isInput = false
    this.#isAccount = false
  }

  getId() {
    return `${this.type}:${this.utxo.tx_hash}:${this.utxo.tx_index}`
  }

  getHash() {
    return this.utxo.tx_hash
  }

  getRelatedAddress(): string {
    return this.utxo.receiver
  }

  getAmount(): number {
    return this.utxo.amount
  }

  isInput() {
    return this.#isInput
  }

  isAccount() {
    return this.#isAccount
  }

  toPlainObject(): UtxoPlainObjectType {
    return {
      id: this.getId(),
      type: this.type,
      tx_hash: this.utxo.tx_hash,
      block_hash: this.utxo.block_hash,
      branch: 0,
      tx_ordinal: 0,
      io_ordinal: this.utxo.tx_index,
      address: this.utxo.receiver,
      value: coinFormat(Number(this.utxo.amount)),
    }
  }
}

export default UtxoData
