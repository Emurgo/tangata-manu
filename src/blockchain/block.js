// flow
export default class Block {
  blockHash: number

  slot: number

  epoch: number

  height: number

  constructor(blockHash, slot, epoch, height) {
    this.blockHash = blockHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
  }
}
