// flow
export default class Block {
  hash: number

  slot: number

  epoch: number

  height: number

  txs: any

  isEBB: boolean

  constructor({
    hash, slot, epoch, height, txs, isEBB,
  }) {
    this.hash = hash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs
    this.isEBB = isEBB
  }

  serialize() {
    return {
      block_hash: this.hash,
      epoch: this.epoch,
      slot: this.slot,
      block_height: this.height,
    }
  }
}
