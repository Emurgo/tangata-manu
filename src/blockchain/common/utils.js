// @flow

import type { TxInputType, TxType } from '../common/tx'

const getUtxoId = (input: TxInputType) => {
  switch (input.type) {
    case 'utxo':
      return `${input.txId}${input.idx}`
    // TODO: implement for accounts
    default:
      throw Error('getUtxoId(): unsupported TxInputType ' + input.type)
  }
}

const structUtxo = (
  receiver: string,
  amount: number,
  utxoHash: string,
  txIndex: number = 0,
  blockNum: ?number = 0,
) => ({
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
const fixLongAddress = (address: string): string => (address && address.length > 1000
  ? `${address.substr(0, 497)}...${address.substr(address.length - 500, 500)}`
  : address)


const getTxsUtxos = (txs: Array<TxType>) => txs.reduce((res, tx) => {
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
