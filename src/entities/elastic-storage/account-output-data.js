// @flow

import ElasticData, { coinFormat } from './elastic-data'
import type { TxType } from '../../blockchain/common'
import type { TxOutputType } from '../../blockchain/common/tx'

const ACCOUNT_OUTPUT_TYPE = 'account_output'

class AccountOutputData extends ElasticData {
  output: TxOutputType

  type: string

  id: string

  blockHash: string

  txOrdinal: number

  ioOrdinal: number

  #isInput: boolean

  #isAccount: boolean

  constructor(output: TxOutputType, tx: TxType, index: number) {
    super()
    if (output.type !== 'account') {
      throw new Error(`AccountOutputType expects output of type 'account', but got: ${output}`)
    }
    this.output = output
    this.type = ACCOUNT_OUTPUT_TYPE
    this.id = `${this.type}:${tx.id}:${index}`
    this.blockHash = tx.blockHash
    this.txOrdinal = tx.txOrdinal
    this.ioOrdinal = index

    this.#isInput = false
    this.#isAccount = true
  }

  getId() {
    return this.id
  }

  getRelatedAddress(): string {
    return this.output.address
  }

  getAmount(): number {
    return this.output.value
  }

  isInput() {
    return this.#isInput
  }

  isAccount() {
    return this.#isAccount
  }

  toPlainObject() {
    return {
      id: this.getId(),
      type: this.type,
      block_hash: this.blockHash,
      branch: 0,
      tx_ordinal: this.txOrdinal,
      io_ordinal: this.ioOrdinal,
      address: this.output.address,
      value: coinFormat(Number(this.output.value)),
    }
  }
}

export default AccountOutputData
