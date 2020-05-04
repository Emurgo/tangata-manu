// @flow

import type { TxInputType, TxType } from './tx'

const getUtxoId: TxInputType => string = (input) => {
  switch (input.type) {
    case 'utxo':
      return `${input.txId}${input.idx}`
    case 'account':
      return `account:${input.account_id}${input.value}`
    default:
      throw Error(`getUtxoId(): unsupported TxInputType ${input.type}`)
  }
}

export type UtxoType = {|
  tx_hash: string,
  tx_index: number,
  receiver: string,
  amount: number,
|};

type StructUtxoType = {|
  ...UtxoType,
  utxo_id: string,
  block_num: ?number,
|};

const structUtxo = (
  receiver: string,
  amount: number,
  utxoHash: string,
  txIndex: number = 0,
  blockNum: ?number = 0,
): StructUtxoType => ({
  utxo_id: `${utxoHash}${txIndex}`,
  tx_hash: utxoHash,
  tx_index: txIndex,
  receiver,
  amount,
  block_num: blockNum,
})

/**
   * We need to use this function cuz there are some extra-long addresses
   * existing on Cardano mainnet. Some of them exceed 10K characters in length,
   * and Postgres can't store it.
   * We don't care about making these non-standard addresses spendable, so any address
   * over 1K characters is just truncated.
*/
const fixLongAddress: string => string = (address) => (address && address.length > 1000
  ? `${address.substr(0, 497)}...${address.substr(address.length - 500, 500)}`
  : address)


const getTxsUtxos: Array<TxType> => { [key: string]: StructUtxoType, ... } = (
  txs,
) => txs.reduce((res, tx) => {
  const { id, outputs, blockNum } = tx
  outputs.forEach((output, index) => {
    const utxo = structUtxo(
      fixLongAddress(output.address), output.value, id, index, blockNum)
    res[`${id}${index}`] = utxo
  })
  return res
}, {})

export default {
  structUtxo,
  getUtxoId,
  fixLongAddress,
  getTxsUtxos,
}
