// @flow

export type TxInputType = {
    txId: string,
    idx: number
}

export type TxOutputType = {
  address: string,
  value: number,
}

export type TxType = {
  inputs: Array<TxInputType>,
  outputs: Array<TxOutputType>,
  id: string,
  blockNum: ?number,
  blockHash: ?string,
  status?: string,
  txTime: Date,
  txBody: string,
  txOrdinal: ?number,
  witnesses: [],
  isGenesis: ?boolean,
}

export type GenesisTxType = {
  ...TxType,
  genesis: boolean,
}

export const TX_SUCCESS_STATUS = 'Successful'
export const TX_PENDING_STATUS = 'Pending'
export const TX_FAILED_STATUS = 'Failed'
export const TX_STATUS = {
  TX_SUCCESS_STATUS,
  TX_PENDING_STATUS,
  TX_FAILED_STATUS,
}
