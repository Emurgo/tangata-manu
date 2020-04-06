// @flow

import cbor from 'cbor'

import byronUtils from './utils'
import type { EpochIdType, SlotIdType, TxType } from '../common'
import { Block } from '../common'


const SLOTS_IN_EPOCH = 21600

export type HeaderType = Array<any>

export default class ByronBlock implements Block {
  hash: string

  prevHash: string

  slot: ?number

  epoch: number

  size: number

  height: number

  txs: Array<TxType>

  isEBB: boolean

  time: Date

  // slot leader ID (needs resolving with genesis file, looked up using slotLeaderPk)
  lead: ?string

  slotLeaderPk: ?string

  isGenesis: boolean

  constructor({
    hash, slot, epoch, height, txs, isEBB, prevHash,
    time, lead, slotLeaderPk, size, isGenesis,
  }: {hash: string,
    slot: ?number,
    epoch: number,
    size: number,
    height: number,
    txs: Array<TxType>,
    isEBB: boolean,
    prevHash: string,
    time: Date,
    lead: ?string,
    slotLeaderPk: ?string,
    isGenesis: ?boolean,
  }) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs
    this.isEBB = isEBB
    this.time = time
    this.lead = lead
    this.slotLeaderPk = slotLeaderPk
    this.size = size
    this.isGenesis = isGenesis || false
  }

  serialize() {
    return {
      block_hash: this.hash,
      epoch: this.epoch,
      slot: this.slot,
      block_height: this.height,
    }
  }

  getHash(): string {
    return this.hash
  }

  getPrevHash(): string {
    return this.prevHash
  }

  isGenesisBlock() {
    return this.isGenesis
  }

  getEpoch(): EpochIdType {
    return this.epoch
  }

  getSlot(): ?SlotIdType {
    return this.slot
  }

  getHeight(): number {
    return this.height
  }

  getTxs(): Array<TxType> {
    return this.txs
  }

  getTime(): Date {
    return this.time
  }

  getSize(): number {
    return this.size
  }

  getSlotLeaderId(): ?string {
    return this.lead
  }

  static handleEpochBoundaryBlock(header: HeaderType) {
    const [epoch, [chainDifficulty]] = header[3]
    return {
      epoch,
      time: new Date(),
      lead: null,
      slotLeaderPk: null,
      height: chainDifficulty,
      isEBB: true,
      slot: null,
      txs: [],
    }
  }

  static handleRegularBlock(
    header: HeaderType,
    body: {},
    blockHash: string,
    networkStartTime: number,
  ) {
    const consensus = header[3]
    const [epoch, slot] = consensus[0]
    const slotLeaderPk = consensus[1].toString('hex')
    const [chainDifficulty] = consensus[2]
    const txs = body[0]
    const [upd1, upd2] = body[3]
    const blockTime = this.calcSlotTime(epoch, slot, networkStartTime)

    const res = {
      slot,
      epoch,
      // we need to resolve lead later on via slotLeaderPk
      lead: null,
      slotLeaderPk,
      time: blockTime,
      isEBB: false,
      upd: (upd1.length || upd2.length) ? [upd1, upd2] : null,
      height: chainDifficulty,
      txs: txs.map((tx, index) => byronUtils.rawTxToObj(tx, {
        txTime: blockTime,
        txOrdinal: index,
        blockNum: chainDifficulty,
        blockHash,
      })),
    }
    return res
  }

  static parseBlock(blob: Buffer, networkStartTime: number): ByronBlock {
    const [type, [header, body]] = cbor.decode(blob)
    const hash = byronUtils.headerToId(header, type)
    const common = {
      hash,
      size: blob.length,
      magic: header[0],
      prevHash: header[1].toString('hex'),
    }
    let blockData
    switch (type) {
      case 0:
        blockData = { ...common, ...ByronBlock.handleEpochBoundaryBlock(header) }
        break
      case 1:
        blockData = {
          ...common,
          ...ByronBlock.handleRegularBlock(header, body, hash, networkStartTime),
        }
        break
      default:
        throw new Error(`Unexpected block type! ${type}`)
    }
    return new ByronBlock(blockData)
  }

  static fromCBOR(data: Buffer, networkStartTime: number) {
    const block = ByronBlock.parseBlock(data, networkStartTime)
    return block
  }

  static calcSlotTime(epoch: number, slot: number, networkStartTime: number): Date {
    const globalSlot = epoch * SLOTS_IN_EPOCH + slot
    const secondsFromStart = globalSlot * 20
    const slotUnitSeconds = networkStartTime + secondsFromStart
    return new Date(slotUnitSeconds * 1000)
  }
}
