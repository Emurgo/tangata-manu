// @flow
import _ from 'lodash'

import type { TxType } from '../../blockchain'

import ElasticData, { coinFormat } from './elastic-data'
import UtxoData from './utxo-data'
import InputData from './input-data'

class TxData extends ElasticData {
  tx: TxType

  resolvedInputs: Array<InputData>

  resolvedOutputs: Array<UtxoData>

  txTrackedState: { [string]: any }

  addressStates: { [string]: any }

  constructor(
    tx: TxType,
    inputsUtxos: {} = {},
    txTrackedState: { [string]: any } = {},
    addressStates: { [string]: any } = {},
  ) {
    super()
    this.tx = tx

    this.resolvedInputs = tx.inputs.map((inp, idx) => {
      const id = `${inp.txId}${inp.idx}`
      const inputUtxo = inputsUtxos[id]
      if (!inputUtxo) {
        throw new Error(`UTxO '${id}' is not found for tx '${tx.id}'!`)
      }
      return new InputData(inp, idx, inputUtxo, tx)
    })

    this.resolvedOutputs = tx.outputs.map((utxo, idx) => new UtxoData({
      receiver: utxo.address,
      amount: utxo.value,
      tx_index: idx,
      block_hash: tx.blockHash,
      tx_hash: tx.id,
    }))

    if (this.resolvedInputs.length === 1 && this.resolvedOutputs.length === 1) {
      let input: InputData = this.resolvedInputs[0];
      let output: UtxoData = this.resolvedOutputs[0];
      if (input.utxo.amount === output.utxo.amount) {
        // This is a redemption tx that increases the total supply of coin
        txTrackedState.supply_after_this_tx = (txTrackedState.supply_after_this_tx || 0) + input.utxo.amount
      }
    }
    this.txTrackedState = { ...txTrackedState }

    // Aggregate all inputs/outputs into a "diff" object
    const txAddressDiff: { [string]: any } = {}
    for (const { utxo, type } of [...this.resolvedInputs, ...this.resolvedOutputs]) {
      const { receiver, amount } = utxo
      const isInput = type === 'input'
      const balanceDiff = isInput ? -amount : amount
      const {
        addressBalanceDiff = 0,
        isAddressInput = false,
        isAddressOutput = false,
      } = txAddressDiff[receiver] || {}
      txAddressDiff[receiver] = {
        addressBalanceDiff: addressBalanceDiff + balanceDiff,
        isAddressInput: isAddressInput || isInput,
        isAddressOutput: isAddressOutput || !isInput,
      }
    }

    // Apply the aggregated diff to the address state
    const txAddressStates = []
    for (const address of Object.keys(txAddressDiff)) {
      const { addressBalanceDiff, isAddressInput, isAddressOutput } = txAddressDiff[address]
      const {
        balance_after_this_tx = 0,
        tx_num_after_this_tx = 0,
        received_tx_num_after_this_tx = 0,
        sent_tx_num_after_this_tx = 0,
      } = addressStates[address] || {}
      const newState = {
        address,
        balance_after_this_tx: balance_after_this_tx + addressBalanceDiff,
        tx_num_after_this_tx: tx_num_after_this_tx + 1,
        sent_tx_num_after_this_tx: sent_tx_num_after_this_tx + (isAddressInput ? 1 : 0),
        received_tx_num_after_this_tx: received_tx_num_after_this_tx + (isAddressOutput ? 1 : 0),
      }
      addressStates[address] = newState
      txAddressStates.push({ ...newState })
    }

    this.addressStates = txAddressStates
  }

  static fromGenesisUtxo(utxo: any, networkStartTime: number) {
    return new TxData({
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
    return this.resolvedOutputs.map(o => o.toPlainObject())
  }

  getInputsData() {
    return this.resolvedInputs.map(i => i.toPlainObject())
  }

  toPlainObject() {
    const inputsData = this.getInputsData()
    const outputsData = this.getOutputsData()

    const inputsSum = _.sumBy(inputsData, inp => inp.value.full)
    const outputsSum = _.sumBy(outputsData, out => out.value.full)

    return {
      ...TxData.getBaseFields(),
      is_genesis: this.tx.isGenesis || false,
      hash: this.tx.id,
      tx_ordinal: this.tx.txOrdinal,
      block_hash: this.tx.blockHash,
      addresses: this.addressStates.map(s => ({
        ...s,
        balance_after_this_tx: coinFormat(s.balance_after_this_tx),
      })),
      outputs: outputsData,
      inputs: inputsData,
      sum_outputs: coinFormat(outputsSum),
      sum_inputs: coinFormat(inputsSum),
      fees: coinFormat(Math.max(0, inputsSum - outputsSum)),
      time: this.tx.txTime.toISOString(),
      supply_after_this_tx: coinFormat(this.txTrackedState.supply_after_this_tx),
    }
  }
}

export default TxData
