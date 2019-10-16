// @flow

import UtxoData from './utxo-data'

const INPUT_TYPE = 'input'

class InputData extends UtxoData {
  constructor(input, index, inputUtxo, tx) {
    super({
      tx_hash: tx.id,
      tx_index: index,
      amount: inputUtxo.value.full,
      receiver: inputUtxo.address,
    })
    this.type = INPUT_TYPE
  }
}

export default InputData
