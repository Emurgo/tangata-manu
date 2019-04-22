// flow
export default class Block {
  hash: number

  slot: number

  epoch: number

  height: number

  constructor({
    hash, slot, epoch, height,
  }) {
    this.hash = hash
    this.slot = slot
    this.epoch = epoch
    this.height = height
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
