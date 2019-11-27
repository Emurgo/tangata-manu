// @flow

import _ from 'lodash'

import BigNumber from 'bignumber.js'
import { ByronBlock } from '../../blockchain/byron'
import { Block, utils } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
import type { UtxoType } from './utxo-data'
import TxData from './tx-data'

class BlockData extends ElasticData {
  block: Block

  utxos: Array<mixed>

  storedUTxOs: Array<UtxoType>

  allUtxos: { [string]: UtxoType }

  inputsData: [] = []

  resolvedTxs: Array<TxData> = []

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
        .flatMap(inp => this.allUtxos[utils.getUtxoId(inp)])

      this.resolvedTxs = txs.map(tx => new TxData(tx, this.allUtxos, txTrackedState, addressStates))

      this.txsData = this.resolvedTxs.map(tx => ({
        epoch: block.getEpoch(),
        slot: block.getSlot(),
        ...tx.toPlainObject(),
      }))
    }
  }

  // TODO: figure out if we need this for shelley too and handle that there
  static emptySlot(
    epoch: number,
    slot: number,
    networkStartTime: number,
  ) {
    return new BlockData(new ByronBlock({
      hash: null,
      slot,
      epoch,
      height: null,
      txs: [],
      isEBB: false,
      prevHash: null,
      time: ByronBlock.calcSlotTime(epoch, slot, networkStartTime),
      lead: null,
      slotLeaderPk: null,
      size: 0,
    }))
  }

  getResolvedTxs(): Array<TxData> {
    return this.resolvedTxs
  }

  getReceivedAmount(): BigNumber {
    return this.txsData.reduce(
      (sum, { sum_inputs }) => sum.plus(sum_inputs.full), new BigNumber(0))
  }

  getSentAmount(): BigNumber {
    return this.txsData.reduce(
      (sum, { sum_outputs }) => sum.plus(sum_outputs.full), new BigNumber(0))
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
      // this is byron-specific logic to store this PK since it doesn't exist in
      // shelley blocks, need to figure this out
      // $FlowFixMe
      slotLeaderPk: this.block.slotLeaderPk,
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
