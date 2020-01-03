// @flow

import ElasticData, { coinFormat } from './elastic-data'
import type { AccountInputType, TxType } from '../../blockchain/common'

const ACCOUNT_INPUT_TYPE = 'account_input'

class AccountInputData extends ElasticData {
  input: AccountInputType

  type: string

  id: string

  blockHash: string

  txOrdinal: number

  ioOrdinal: number

  #isInput: boolean

  #isAccount: boolean

  constructor(input: AccountInputType, tx: TxType, index: number) {
    super()
    this.input = input
    this.type = ACCOUNT_INPUT_TYPE
    this.id = `${this.type}:${tx.id}:${index}`
    this.blockHash = tx.blockHash
    this.txOrdinal = tx.txOrdinal
    this.ioOrdinal = index
    this.#isAccount = true
    this.#isInput = true
  }

  getId() {
    return this.id
  }

  getRelatedAddress(): string {
    return this.input.account_id
  }

  getAmount(): number {
    return this.input.value
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
      address: this.input.account_id,
      value: coinFormat(Number(this.input.value)),
    }
  }
}

export default AccountInputData
