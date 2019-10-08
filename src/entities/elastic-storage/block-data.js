// @flow

import type { Block } from '../../blockchain'

import ElasticData, { coinFormat } from './elastic-data'

class BlockData extends ElasticData {
  block: Block

  amountSent: number

  fees: number

  constructor(block: Block) {
    super()
    this.block = block
    this.amountSent = this.block.getSentAmount()
    this.fees = this.block.getFees()
  }


  toPlainObject() {
    const time = this.block.getTime().toISOString()
    return {
      epoch: this.block.epoch,
      slot: this.block.slot,
      hash: this.block.hash,
      height: this.block.height,
      time,
      branch: 0,
      tx_num: this.block.txs.length,
      sent: coinFormat(this.amountSent),
      fees: coinFormat(this.fees),
      // lead: this.block.lead,
    }
  }
}

export default BlockData
