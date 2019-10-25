// @flow

import _ from 'lodash'

import { Block } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
import type { UtxoType } from './utxo-data'
import TxData from './tx-data'
import BigNumber from "bignumber.js"

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

  static emptySlot(
    epoch: number,
    slot: number,
    networkStartTime: number,
  ) {
    return new BlockData(new Block({
      hash: null,
      slot: slot,
      epoch: epoch,
      height: null,
      txs: [],
      isEBB: false,
      prevHash: null,
      time: Block.calcSlotTime(epoch, slot, networkStartTime),
      lead: null,
      slotLeaderPk: null,
      size: 0
    }))
  }

  getReceivedAmount(): BigNumber {
    return this.txsData.reduce((sum, { sum_inputs }) => sum.plus(sum_inputs.full), new BigNumber(0))
  }

  getSentAmount(): BigNumber {
    return this.txsData.reduce((sum, { sum_outputs }) => sum.plus(sum_outputs.full), new BigNumber(0))
  }

  getTxsData() {
    return this.txsData
  }

  getFees(): BigNumber {
    return this.txsData.reduce((sum, { fees }) => sum.plus(fees.full), new BigNumber(0))
  }

  getNewAddresses(): number {
    return this.txsData.reduce((sum, { new_addresses }) => sum + new_addresses, 0)
  }

  toPlainObject() {
    const time = this.block.getTime().toISOString()
    let sent = 0
    let fees = 0
    let newAddresses = 0
    const txs = this.block.getTxs()
    if (txs.length > 0) {
      sent = this.getSentAmount()
      fees = this.getFees()
      newAddresses = this.getNewAddresses()
    }
    return {
      epoch: this.block.getEpoch(),
      slot: this.block.getSlot(),
      hash: this.block.getHash(),
      size: this.block.getSize(),
      height: this.block.getHeight(),
      lead: this.block.getSlotLeaderId(),
      slotLeaderPk: this.block.getSlotLeaderPk(),
      time,
      branch: 0,
      tx_num: txs.length,
      tx: this.getTxsData(),
      sent: coinFormat(sent),
      fees: coinFormat(fees),
      new_addresses: newAddresses,
    }
  }
}

export default BlockData
