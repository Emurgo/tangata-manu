// @flow

import type { TxType } from '../../blockchain/common'

import UtxoData from './utxo-data'

const INPUT_TYPE = 'input'

class InputData extends UtxoData {
  constructor(input, index: number, inputUtxo, tx: TxType) {
    super({
      tx_hash: tx.id,
      tx_index: index,
      amount: Number(inputUtxo.value.full),
      receiver: inputUtxo.address,
    })
    this.type = INPUT_TYPE
  }

  isInput() {
    return true
  }
}

export default InputData
