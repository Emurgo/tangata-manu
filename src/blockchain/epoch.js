// @flow

import Block from './block'

export default class Epoch {
  data: any

  networkStartTime: number

  constructor(data: any, networkStartTime: number) {
    // stip protocol magic
    this.data = data.buffer.slice(data.byteOffset,
      data.byteOffset + data.byteLength)
    this.networkStartTime = networkStartTime
  }

  static fromCBOR(data: Buffer, networkStartTime: number) {
    return new Epoch(data, networkStartTime)
  }

  static getBlockDataByOffset(blocksList: any, offset: number) {
    const blockSize = new DataView(blocksList, offset).getUint32(0, false)
    const blob = blocksList.slice(offset + 4, offset + blockSize + 4)
    return [blockSize, new Uint8Array(blob)]
  }


  getNextBlock(blocksList: ArrayBuffer, offset: number) {
    const [blockSize, blob] = Epoch.getBlockDataByOffset(blocksList, offset)
    const block = Block.fromCBOR(Buffer.from(blob), this.networkStartTime)
    const bytesToAllign = blockSize % 4
    const nextBlockOffset = blockSize
      + 4 // block size field
      + (bytesToAllign && (4 - bytesToAllign))
    return [block, offset + nextBlockOffset]
  }


  * getBlocksIterator(options: {omitEbb?: boolean} = {}): Generator<Block, void, void> {
    const blocksList = this.data.slice(16) // header
    const nextBlock = (offset: number) => this.getNextBlock(blocksList, offset)
    let block
    let offset = 0
    if (options.omitEbb) {
      [block, offset] = nextBlock(offset)
      if (!block.isEBB) {
        yield block
      }
    }

    for (;offset < blocksList.byteLength;) {
      [block, offset] = nextBlock(offset)
      yield block
    }
  }
}
