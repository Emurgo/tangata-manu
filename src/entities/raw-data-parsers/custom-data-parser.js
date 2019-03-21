// @flow
import util from 'util'
import { helpers } from 'inversify-vanillajs-helpers'

import cbor from 'borc'
import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

class CustomDataParser implements RawDataParser {
  #logger: any

  constructor(
    logger: any,
  ) {
    this.#logger = logger
  }

  getNextBlock(blocksList: ArrayBuffer, offset: number): [any, number] {
    const blockSize = new DataView(blocksList).getUint32(0, false)
    const blob = blocksList.slice(4, blockSize+4)
    const blobBytes = new Uint8Array(blob)
    this.#logger.debug('blockSize', blob.byteLength, blockSize, blobBytes[0], blobBytes[blockSize-1])

    const [blockType, [header, body]] = cbor.decode(blobBytes)
    this.#logger.debug('bt', blockType)
    /*const block = {}
    const nextBlockOffset = blockSize + dataOffset
    return [block, nextBlockOffset]*/
  }


  handleEpoch(data: ArrayBuffer) {
    let epochData = data
    epochData = epochData.slice(16) // header
    const epochDataArray = new Uint8Array(epochData)

    const blockData = this.getNextBlock(epochData, 0)
    
    //for (let nextBlockOffset = 0; nextBlockOffset < blocksList.byteLength;) {
   //   const blockData = this.getNextBlock(blocksList, nextBlockOffset)
    //  nextBlockOffset = blockData[1]
    //}

    /*
    if (magic !== '\xfeCARDANO') {
      throw new Error('Unexpected magic! ' + magic);
    }
    const fileType = Buffer.from(getBytes(4)).toString('hex');
    if (fileType !== '5041434b') {
      throw new Error('Unexpected pack file type! ' + fileType);
    }
    const fileVersion = getInt32();
    if (fileVersion !== 1) {
      throw new Error('Unexpected pack file version! ' + JSON.stringify(fileVersion));
    }
    while (arr.length > 0) {
      callback(handleBlock(getBlob()))
    } */
    this.#logger.debug('handleEpoc:')
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
