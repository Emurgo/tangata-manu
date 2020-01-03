// @flow

import type { TxType } from '../../blockchain/common'

import UtxoData from './utxo-data'

const INPUT_TYPE = 'input'

class InputData extends UtxoData {
  #isInput: boolean

  constructor(input, index: number, inputUtxo, tx: TxType) {
    super({
      tx_hash: tx.id,
      tx_index: index,
      amount: Number(inputUtxo.value.full),
      receiver: inputUtxo.address,
    })
    this.type = INPUT_TYPE
    this.#isInput = true
  }

  isInput() {
    return this.#isInput
  }
}

export default InputData
