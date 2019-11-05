// @flow
import _ from 'lodash'

import BigNumber from 'bignumber.js'
import type { TxType } from '../../blockchain/common'
import { utils } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
import UtxoData from './utxo-data'
import InputData from './input-data'

class TxData extends ElasticData {
  tx: TxType

  resolvedInputs: Array<InputData>

  resolvedOutputs: Array<UtxoData>

  sumInputs: number

  sumOutputs: number

  fee: number

  newAddresses: number

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
      const id = utils.getUtxoId(inp)
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

    const prevSupply: BigNumber = txTrackedState.supply_after_this_tx

    if (this.resolvedInputs.length === 1
     && this.resolvedOutputs.length === 1
     && this.resolvedInputs[0].utxo.amount === this.resolvedOutputs[0].utxo.amount) {
      const value = this.resolvedInputs[0].utxo.amount

      this.sumInputs = value
      this.sumOutputs = value
      this.fee = 0

      // This is a redemption tx that increases the total supply of coin
      txTrackedState.supply_after_this_tx = prevSupply.plus(value)
    } else {
      this.sumInputs = _.sumBy(this.resolvedInputs, x => x.utxo.amount)
      this.sumOutputs = _.sumBy(this.resolvedOutputs, x => x.utxo.amount)
      this.fee = Math.max(0, this.sumInputs - this.sumOutputs)

      if (!tx.isGenesis) {
        // This is a regular tx - fees are burned from the total supply
        txTrackedState.supply_after_this_tx = prevSupply.minus(this.fee)
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
    let newAddresses = 0
    for (const address of Object.keys(txAddressDiff)) {
      const { addressBalanceDiff, isAddressInput, isAddressOutput } = txAddressDiff[address]
      const {
        balance_after_this_tx = 0,
        tx_num_after_this_tx = 0,
        received_tx_num_after_this_tx = 0,
        sent_tx_num_after_this_tx = 0,
        isNewAddress = false,
      } = addressStates[address] || {
        isNewAddress: true,
      }
      if (isNewAddress) {
        newAddresses += 1
      }
      const newState = {
        address,
        balance_after_this_tx: balance_after_this_tx + addressBalanceDiff,
        tx_num_after_this_tx: tx_num_after_this_tx + 1,
        sent_tx_num_after_this_tx: sent_tx_num_after_this_tx + (isAddressInput ? 1 : 0),
        received_tx_num_after_this_tx: received_tx_num_after_this_tx + (isAddressOutput ? 1 : 0),
      }
      addressStates[address] = newState
      txAddressStates.push({
        ...newState,
        ...(isNewAddress ? { new_address: true } : {}),
      })
    }

    this.addressStates = txAddressStates
    this.newAddresses = newAddresses
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
      outputs: this.getOutputsData(),
      inputs: this.getInputsData(),
      sum_inputs: coinFormat(this.sumInputs),
      sum_outputs: coinFormat(this.sumOutputs),
      fees: coinFormat(this.fee),
      new_addresses: this.newAddresses,
      time: this.tx.txTime.toISOString(),
      ...(this.tx.isGenesis ? {} : {
        supply_after_this_tx: coinFormat(this.txTrackedState.supply_after_this_tx),
      }),
    }
  }
}

export default TxData
