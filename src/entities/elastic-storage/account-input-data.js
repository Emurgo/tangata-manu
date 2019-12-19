// @flow

import ElasticData, { coinFormat } from './elastic-data'
import type {AccountInputType, TxInputType, TxType} from '../../blockchain/common'

const ACCOUNT_INPUT_TYPE = 'account_input'

class AccountInputData extends ElasticData {

  input: AccountInputType

  type: string

  id: string

  blockHash: string

  txOrdinal: number

  ioOrdinal: number

  constructor(input: AccountInputType, tx: TxType, index: number) {
    super()
    this.input = input
    this.type = ACCOUNT_INPUT_TYPE
    this.id = `${this.type}:${tx.id}:${index}`
    this.blockHash = tx.blockHash
    this.txOrdinal = tx.txOrdinal
    this.ioOrdinal = index
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
    return true
  }

  isAccount() {
    return true
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
