// @flow

import _ from 'lodash'

import type { Block } from '../../blockchain'

import ElasticData, { coinFormat } from './elastic-data'
import type { UtxoType } from './utxo-data'
import TxData from './tx-data'

class BlockData extends ElasticData {
  block: Block

  utxos: Array<mixed>

  storedUTxOs: Array<UtxoType>

  allUtxos: { [string]: UtxoType }

  inputsData: [] = []

  txsData: Array<mixed> = []

  constructor(
    block: Block,
    storedUTxOs: Array<UtxoType> = [],
    txTrackedState: { [string]: any } = {},
    addressStates: { [string]: any } = {},
  ) {
    super()
    this.block = block
    this.storedUTxOs = storedUTxOs
    const txs = block.getTxs()

    this.allUtxos = _.keyBy([
      ...this.storedUTxOs,
    ], u => `${u.tx_hash}${u.io_ordinal}`)

    if (!_.isEmpty(txs)) {
      this.inputsData = _.flatMap(txs, 'inputs')
        .flatMap(inp => this.allUtxos[`${inp.txId}${inp.idx}`])

      this.txsData = txs.map(tx => ({
        epoch: block.epoch,
        slot: block.slot,
        ...(new TxData(tx, this.allUtxos, txTrackedState, addressStates)).toPlainObject(),
      }))
    }
  }

  getReceivedAmount(): number {
    const received = _.sumBy(this.inputsData, inp => inp.value.full)
    return received
  }

  getSentAmount(): number {
    const blockUtxos = Object.values(this.allUtxos)
      .filter(utxo => utxo.block_hash === this.block.hash)
    const sent = _.sumBy(blockUtxos, u => u.value.full)
    return sent
  }

  getTxsData() {
    return this.txsData
  }

  getFees(): number {
    const sentAmount = this.getSentAmount()
    const receivedAmount = this.getReceivedAmount()
    return Math.max(0, sentAmount - receivedAmount)
  }

  toPlainObject() {
    const time = this.block.getTime().toISOString()
    let sent = 0
    let fees = 0
    const txs = this.block.getTxs()
    if (txs.length > 0) {
      sent = this.getSentAmount()
      fees = this.getFees()
    }
    return {
      epoch: this.block.epoch,
      slot: this.block.slot,
      hash: this.block.hash,
      size: this.block.size,
      height: this.block.height,
      lead: this.block.lead,
      time,
      branch: 0,
      tx_num: txs.length,
      tx: this.getTxsData(),
      sent: coinFormat(sent),
      fees: coinFormat(fees),
    }
  }
}

export default BlockData
