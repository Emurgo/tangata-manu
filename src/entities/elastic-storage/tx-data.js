// @flow
import _ from 'lodash'

import type { TxType } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
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
        {
          address: utxo.receiver,
          value: utxo.amount,
          ...utxo,
        },
      ],
    })
  }

  getOutputsData() {
    return this.tx.outputs.map((utxo, idx) => (new UtxoData({
      receiver: utxo.address,
      amount: utxo.value,
      tx_index: idx,
      block_hash: this.tx.blockHash,
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
    const inputsData = this.getInputsData()
    const outputsData = this.getOutputsData()
    const addresses = [...inputsData, ...outputsData].map(io => ({ address: io.address }))

    const inputsSum = _.sumBy(inputsData, inp => inp.value.full)
    const outputsSum = _.sumBy(outputsData, out => out.value.full)

    return {
      ...TxData.getBaseFields(),
      is_genesis: this.tx.isGenesis || false,
      hash: this.tx.id,
      tx_ordinal: this.tx.txOrdinal,
      block_hash: this.tx.blockHash,
      addresses,
      outputs: outputsData,
      inputs: inputsData,
      sum_outputs: coinFormat(outputsSum),
      sum_inputs: coinFormat(inputsSum),
      fees: coinFormat(Math.max(0, inputsSum - outputsSum)),
      time: this.tx.txTime.toISOString(),
    }
  }
}

export default TxData
