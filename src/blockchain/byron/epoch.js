// @flow

import ByronBlock from './block'

export default class ByronEpoch {
  data: ArrayBuffer

  networkStartTime: number

  constructor(data: Buffer, networkStartTime: number) {
    // strip protocol magic
    this.data = data.buffer.slice(data.byteOffset,
      data.byteOffset + data.byteLength)
    this.networkStartTime = networkStartTime
  }

  static fromCBOR(data: Buffer, networkStartTime: number): ByronEpoch {
    return new ByronEpoch(data, networkStartTime)
  }

  static getBlockDataByOffset(blocksList: ArrayBuffer, offset: number): [number, Uint8Array] {
    const blockSize = new DataView(blocksList, offset).getUint32(0, false)
    const blob = blocksList.slice(offset + 4, offset + blockSize + 4)
    return [blockSize, new Uint8Array(blob)]
  }


  getNextBlock(blocksList: ArrayBuffer, offset: number): [ByronBlock, number] {
    const [blockSize, blob] = ByronEpoch.getBlockDataByOffset(blocksList, offset)
    const block = ByronBlock.fromCBOR(Buffer.from(blob), this.networkStartTime)
    const bytesToAllign = blockSize % 4
    const nextBlockOffset = blockSize
      + 4 // block size field
      + (bytesToAllign > 0
        ? (4 - bytesToAllign)
        : 0
      )
    return [block, offset + nextBlockOffset]
  }


  * getBlocksIterator(
    options: {| omitEbb?: boolean |} = Object.freeze({}),
  ): Generator<ByronBlock, void, void> {
    const blocksList = this.data.slice(16) // header
    const nextBlock = (offset: number) => this.getNextBlock(blocksList, offset)
    let block
    let offset = 0
    if (options.omitEbb === true) {
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
