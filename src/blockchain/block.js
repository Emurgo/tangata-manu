// @flow

import cbor from 'borc'

import utils from './utils'

const SLOTS_IN_EPOCH = 21600

export type HeaderType = Array<any>

export default class Block {
  hash: string

  prevHash: string

  slot: ?number

  epoch: number

  height: number

  txs: ?any

  isEBB: boolean

  constructor({
    hash, slot, epoch, height, txs, isEBB, prevHash,
  }: {hash: string,
    slot: ?number,
    epoch: number,
    height: number,
    txs: ?any,
    isEBB: boolean,
    prevHash: string}) {
    this.hash = hash
    this.prevHash = prevHash
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

  static handleEpochBoundaryBlock(header: HeaderType) {
    const [epoch, [chainDifficulty]] = header[3]
    return {
      epoch,
      height: chainDifficulty,
      isEBB: true,
      slot: null,
      txs: null,
    }
  }

  static handleRegularBlock(header: HeaderType, body: {}, blockHash: string,
    networkStartTime: number) {
    const consensus = header[3]
    const [epoch, slot] = consensus[0]
    const [chainDifficulty] = consensus[2]
    const txs = body[0]
    const [upd1, upd2] = body[3]
    const blockTime = new Date(
      (networkStartTime
      + (epoch * SLOTS_IN_EPOCH + slot) * 20)
      * 1000).toUTCString()
    const res = {
      slot,
      epoch,
      isEBB: false,
      upd: (upd1.length || upd2.length) ? [upd1, upd2] : null,
      height: chainDifficulty,
      txs: txs.map(tx => utils.rawTxToObj(tx, {
        txTime: blockTime,
        blockNum: chainDifficulty,
        blockHash,
      })),
    }
    return res
  }

  static parseBlock(blob: Buffer, handleRegularBlock: number): Block {
    const [type, [header, body]] = cbor.decode(blob)
    const hash = utils.headerToId(header, type)
    const common = {
      hash,
      magic: header[0],
      prevHash: header[1].toString('hex'),
    }
    let blockData
    switch (type) {
      case 0:
        blockData = { ...common, ...Block.handleEpochBoundaryBlock(header) }
        break
      case 1:
        blockData = {
          ...common,
          ...Block.handleRegularBlock(header, body, hash, handleRegularBlock),
        }
        break
      default:
        throw new Error(`Unexpected block type! ${type}`)
    }
    return new Block(blockData)
  }

  static fromCBOR(data: Buffer, handleRegularBlock: number) {
    const block = Block.parseBlock(data, handleRegularBlock)
    return block
  }
}
