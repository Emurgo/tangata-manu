// flow
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

export default {
  structUtxo,
}
