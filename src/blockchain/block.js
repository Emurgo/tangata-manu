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

  toArray() {
    return [this.hash, this.epoch, this.slot, this.height]
  }
}
