// @flow

import type { TxType } from '../../blockchain'

import ElasticData from './elastic-data'
import UtxoData from './utxo-data'
import InputData from './input-data'

class TxData extends ElasticData {
  tx: TxType

  inputsUtxos: {}

  constructor(tx: TxType, inputsUtxos: {} = {}) {
    super()
    this.tx = tx
    this.inputsUtxos = inputsUtxos
  }

  static fromGenesisUtxo(utxo: any, networkStartTime: number) {
    return new TxData({
      isGnesis: true,
      blockHash: null,
      blockNum: null,
      inputs: [],
      isGenesis: true,
      txBody: '',
      txOrdinal: 0,
      txTime: new Date(networkStartTime * 1000),
      witnesses: [],
      id: utxo.tx_hash,
      branch: 0,
      outputs: [
        utxo,
      ],
    })
  }

  getOutputsData() {
    return this.tx.outputs.map((utxo, idx) => (new UtxoData({
      address: utxo.address,
      amount: utxo.value,
      tx_index: idx,
      tx_hash: this.tx.id,
    })).toPlainObject())
  }

  getInputsData() {
    return this.tx.inputs.map((inp, idx) => {
      const inputUtxo = this.inputsUtxos[`${inp.txId}${inp.idx}`]
      return (new InputData(inp, idx, inputUtxo, this.tx)).toPlainObject()
    })
  }

  toPlainObject() {
    return {
      ...TxData.getBaseFields(),
      is_genesis: this.tx.isGenesis || false,
      hash: this.tx.id,
      outputs: this.getOutputsData(),
      inputs: this.getInputsData(),
      time: this.tx.txTime.toISOString(),
    }
  }
}

export default TxData
