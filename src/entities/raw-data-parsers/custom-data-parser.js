// @flow
import util from 'util'
import { helpers } from 'inversify-vanillajs-helpers'

import cbor from 'borc'
import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

const cborDecode = cbor.decode

class CustomDataParser implements RawDataParser {
  #logger: any

  constructor(
    logger: any,
  ) {
    this.#logger = logger
  }

  // eslint-disable-next-line class-methods-use-this
  getBlockData(blocksList, offset) {
    const blockSize = new DataView(blocksList, offset).getUint32(0, false)
    const blob = blocksList.slice(offset + 4, offset + blockSize + 4)
    return [blockSize, new Uint8Array(blob)]
  }

  getNextBlock(blocksList: ArrayBuffer, offset: number) {
    const [blockSize, blob] = this.getBlockData(blocksList, offset)
    const [blockType, [header, body]] = cborDecode(blob)
    const block = {
      type: blockType,
    }
    const bytesToAllign = blockSize % 4
    const nextBlockOffset = blockSize
      + 4 // block size field
      + (bytesToAllign && (4 - bytesToAllign))
    return [block, offset + nextBlockOffset]
  }


  handleEpoch(data: ArrayBuffer) {
    const blocksList = data.slice(16) // header
    const nextBlock = (offset: number) => this.getNextBlock(blocksList, offset)

    this.#logger.debug('Start to parse epoch')
    for (
      let [block, offset] = nextBlock(0);
      offset < blocksList.byteLength;
      [block, offset] = nextBlock(offset)) {
    }
    this.#logger.debug('Epoch parsed')
  }

  parseBlock(data: string) {
    const block = {}
    return block
  }

  handleEpoch2(buffer: string) {
    this.#logger.debug('handleEpoch2')
    const arr = buffer
    const getBytes = n => arr.splice(0, n)
    const getInt32 = () => getBytes(4).reduce((a, x, i) => a + (x << ((3 - i) * 8)), 0)
    const getBlob = () => {
      const len = getInt32()
      const blob = Buffer.from(getBytes(len))
      if (len % 4 > 0) {
        getBytes(4 - (len % 4)) // remove the padding
      }
      return blob
    }
    const magic = String.fromCharCode(...getBytes(8))
    console.log('cardano', magic)
    const fileType = Buffer.from(getBytes(4)).toString('hex')
    if (fileType !== '5041434b') {
      throw new Error('Unexpected pack file type! ' + fileType)
    }
    const fileVersion = getInt32()
    if (fileVersion !== 1) {
      throw new Error('Unexpected pack file version! ' + JSON.stringify(fileVersion))
    }
    while (arr.length > 0) {
      console.log('arr.length')
      this.handleBlock2(getBlob())
    }
  }


  parseEpoch(data: Buffer) {
    const epoch = this.handleEpoch(
      data.buffer.slice(data.byteOffset,
        data.byteOffset + data.byteLength))
    return epoch
  }

  parse(data: string) {
    const parsedData = {}
    this.#logger.info('Parsed data:', data.length)
    return parsedData
  }
}

helpers.annotate(CustomDataParser, [SERVICE_IDENTIFIER.LOGGER])

export default CustomDataParser
