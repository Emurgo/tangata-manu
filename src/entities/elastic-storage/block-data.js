// @flow

import _ from 'lodash'

import { Block } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
import type { UtxoType } from './utxo-data'
import TxData from './tx-data'

class BlockData extends ElasticData {
  block: Block

  utxos: Array<mixed>

  storedUTxOs: Array<UtxoType>

  allUtxos: {}

  inputsData: []

  constructor(block: Block, storedUTxOs: Array<UtxoType> = []) {
    super()
    this.inputsData = []
    this.block = block
    this.storedUTxOs = storedUTxOs
    const txs = block.getTxs()

    this.allUtxos = _.keyBy([
      ...this.storedUTxOs,
    ], u => `${u.tx_hash}${u.io_ordinal}`)

    if (!_.isEmpty(txs)) {
      this.inputsData = _.flatMap(txs, 'inputs')
        .flatMap(inp => this.allUtxos[`${inp.txId}${inp.idx}`])
    }
  }

  getReceivedAmount(): number {
    const received = _.sumBy(this.inputsData, inp => inp.value.full)
    return received
  }

  getSentAmount(): number {
    const blockUtxos = Object.values(this.allUtxos)
      .filter(utxo => utxo.block_hash === this.block.getHash())
    const sent = _.sumBy(blockUtxos, u => u.value.full)
    return sent
  }

  getTxsData() {
    const txs = this.block.getTxs()
    return txs.map(tx => ({
      epoch: this.block.getEpoch(),
      slot: this.block.getSlot(),
      ...(new TxData(tx, this.allUtxos)).toPlainObject(),
    }))
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
      epoch: this.block.getEpoch(),
      slot: this.block.getSlot(),
      hash: this.block.getHash(),
      size: this.block.getSize(),
      height: this.block.getHeight(),
      lead: this.block.getLeaderKey(),
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
