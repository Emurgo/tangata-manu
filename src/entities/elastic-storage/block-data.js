// @flow

import _ from 'lodash'

import type { Block } from '../../blockchain'

import ElasticData, { coinFormat } from './elastic-data'
import type { UtxoType } from './utxo-data'
import UtxoData from './utxo-data'

class BlockData extends ElasticData {
  block: Block

  utxos: Array<mixed>

  blockUtxos: Array<mixed>

  storedUTxOs: Array<UtxoType>

  allUtxos: {}

  inputsData: []

  constructor(block: Block, storedUTxOs: Array<UtxoType> = []) {
    super()
    this.block = block
    this.storedUTxOs = storedUTxOs
    this.blockUtxos = block.getTxs().flatMap(tx => tx.outputs.map(
      (out, idx) => (new UtxoData({
        tx_hash: tx.id,
        tx_index: idx,
        receiver: out.address,
        amount: out.value,
      })).toPlainObject(),
    ))
    this.allUtxos = _.keyBy([
      ...this.storedUTxOs,
      ...this.blockUtxos,
    ], u => `${u.tx_hash}${u.io_ordinal}`)

    this.inputsData = _.flatMap(_.flatMap(this.block.getTxs(), 'inputs'), inp => {
      return this.allUtxos[`${inp.txId}${inp.idx}`]
    })
  }

  getBlockUtxos() {
    return this.blockUtxos
  }

  getReceivedAmount(): number {
    // TODO: reduce number of iterations
    const received = _.sumBy(this.inputsData, inp => inp.value.full)
    return received
  }

  getSentAmount(): number {
    const sent = _.sumBy(this.inputsData, u => u.value.full)
    return sent
  }

  getFees(): number {
    const sentAmount = this.getSentAmount()
    const receivedAmount = this.getReceivedAmount()
    return sentAmount - receivedAmount
  }

  toPlainObject() {
    const time = this.block.getTime().toISOString()
    let sent = 0
    let fees = 0
    if (this.block.getTxs().length > 0) {
      sent = this.getSentAmount()
      fees = this.getFees()
    }
    return {
      epoch: this.block.epoch,
      slot: this.block.slot,
      hash: this.block.hash,
      height: this.block.height,
      time,
      branch: 0,
      tx_num: this.block.txs.length,
      sent: coinFormat(sent),
      fees: coinFormat(fees),
    }
  }
}

export default BlockData
