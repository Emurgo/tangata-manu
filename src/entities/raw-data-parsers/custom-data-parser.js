// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import cbor from 'cbor'
import bs58 from 'bs58'
import blake from 'blakejs'

import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import Block from '../../blockchain'
import type { NetworkConfig } from '../../interfaces'

const SLOTS_IN_EPOCH = 21600

const cborDecode = cbor.decode

export type HeaderType = Array<string>

const headerToId = (header, type: number) => {
  const headerData = cbor.encode([type, header])
  const id = blake.blake2bHex(headerData, null, 32)
  return id
}

class CborIndefiniteLengthArray {
  elements: Array<{}>

  constructor(elements) {
    this.elements = elements
  }

  encodeCBOR(encoder) {
    return encoder.push(
      Buffer.concat([
        Buffer.from([0x9f]), // indefinite array prefix
        ...this.elements.map((e) => cbor.encode(e)),
        Buffer.from([0xff]), // end of array
      ]),
    )
  }
}

type TxIdHexType = string
type TxBodyHexType = string

function decodedTxToBase(decodedTx) {
  if (Array.isArray(decodedTx)) {
    // eslint-disable-next-line default-case
    switch (decodedTx.length) {
      case 2: {
        const signed = decodedTx
        return signed[0]
      }
      case 3: {
        const base = decodedTx
        return base
      }
    }
  }
  throw new Error(`Unexpected decoded tx structure! ${JSON.stringify(decodedTx)}`)
}

function packRawTxIdAndBody(decodedTxBody): [TxIdHexType, TxBodyHexType] {
  if (!decodedTxBody) {
    throw new Error('Cannot decode inputs from undefined transaction!')
  }
  try {
    const [inputs, outputs, attributes] = decodedTxToBase(decodedTxBody)
    const enc = cbor.encode([
      new CborIndefiniteLengthArray(inputs),
      new CborIndefiniteLengthArray(outputs),
      attributes,
    ])
    const txId = blake.blake2bHex(enc, null, 32)
    const txBody = enc.toString('hex')
    return [txId, txBody]
  } catch (e) {
    throw new Error(`Failed to convert raw transaction to ID! ${JSON.stringify(e)}`)
  }
}

const getBlockDataByOffset = (blocksList: any, offset: number) => {
  const blockSize = new DataView(blocksList, offset).getUint32(0, false)
  const blob = blocksList.slice(offset + 4, offset + blockSize + 4)
  return [blockSize, new Uint8Array(blob)]
}

class CustomDataParser implements RawDataParser {
  #logger: any

  networkStartTime: number

  constructor(
    logger: any,
    networkConfig: NetworkConfig,
  ) {
    this.#logger = logger
    this.networkStartTime = networkConfig.startTime()
  }

  getNextBlock(blocksList: ArrayBuffer, offset: number) {
    const [blockSize, blob] = getBlockDataByOffset(blocksList, offset)
    const block = this.parseBlock(Buffer.from(blob))
    const bytesToAllign = blockSize % 4
    const nextBlockOffset = blockSize
      + 4 // block size field
      + (bytesToAllign && (4 - bytesToAllign))
    return [block, offset + nextBlockOffset]
  }

  handleEpochBoundaryBlock(header: HeaderType) {
    const [epoch, [chainDifficulty]] = header[3]
    this.#logger.debug('handleEpochBoundaryBlock', epoch, chainDifficulty)
    return {
      epoch,
      height: chainDifficulty,
      isEBB: true,
      slot: null,
    }
  }

  handleRegularBlock(header: HeaderType, body: {}) {
    const consensus = header[3]
    const [epoch, slot] = consensus[0]
    const [chainDifficulty] = consensus[2]
    const txs = body[0]
    const [upd1, upd2] = body[3]
    if (txs.length > 0) {
      this.#logger.debug('hrb', epoch, slot, chainDifficulty, txs.length)
    }
    const blockTime = new Date(
      (this.networkStartTime
      + (epoch * SLOTS_IN_EPOCH + slot) * 20)
      * 1000).toUTCString()
    const res = {
      slot,
      epoch,
      height: chainDifficulty,
      txs: txs.map(tx => {
        const [[inputs, outputs], witnesses] = tx
        const [txId, txBody] = packRawTxIdAndBody(tx)
        return {
          id: txId,
          blockNum: chainDifficulty,
          inputs: inputs.map(inp => {
            const [type, tagged] = inp
            const [inputTxId, idx] = cbor.decode(tagged.value)
            return { type, txId: inputTxId.toString('hex'), idx }
          }),
          outputs: outputs.map(out => {
            const [address, value] = out
            return { address: bs58.encode(cbor.encode(address)), value }
          }),
          witnesses: witnesses.map(w => {
            const [type, tagged] = w
            return { type, sign: cbor.decode(tagged.value) }
          }),
          txBody,
          txTime: blockTime,
        }
      }),
    }
    return (upd1.length || upd2.length) ? { ...res, upd: [upd1, upd2] } : res
  }

  handleEpoch(data: ArrayBuffer) {
    const blocksList = data.slice(16) // header
    const nextBlock = (offset: number) => this.getNextBlock(blocksList, offset)
    const blocks = []

    this.#logger.debug('Start to parse epoch')

    for (let block, offset = 0; offset < blocksList.byteLength;) {
      [block, offset] = nextBlock(offset)
      blocks.push(block)
    }
    this.#logger.debug('Epoch parsed')
    return blocks
  }

  parseBlock(blob: Buffer): Block {
    const [type, [header, body]] = cborDecode(blob)
    const hash = headerToId(header, type)
    const common = {
      hash,
      magic: header[0],
      prevHash: header[1].toString('hex'),
    }
    let blockData
    switch (type) {
      case 0:
        blockData = { ...common, ...this.handleEpochBoundaryBlock(header) }
        break
      case 1:
        blockData = {
          ...common,
          ...this.handleRegularBlock(header, body),
        }
        break
      default:
        throw new Error(`Unexpected block type! ${type}`)
    }
    return new Block(blockData)
  }


  parseEpoch(data: Buffer) {
    const epoch = this.handleEpoch(
      data.buffer.slice(data.byteOffset,
        data.byteOffset + data.byteLength))
    return epoch
  }
}

helpers.annotate(CustomDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default CustomDataParser
