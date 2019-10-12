// @flow

//import * as wasm from 'js-chain-libs'
// TODO: is this right?
const SLOTS_IN_EPOCH = 21600

export type HeaderType = Array<any>

export default class Block {
  hash: string

  prevHash: string

  slot: number

  epoch: number

  height: number

  txs: ?any

  constructor({
    hash, slot, epoch, height, txs, prevHash,
  }: {hash: string,
    slot: number,
    epoch: number,
    height: number,
    txs: ?any,
    prevHash: string}) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs
  }

  // what is this for?
  serialize() {
    return {
      block_hash: this.hash,
      epoch: this.epoch,
      slot: this.slot,
      block_height: this.height,
    }
  }

  static parseBlock(blob: Buffer, networkStartTime: number) {
    const wasm = global.jschainlibs

    console.log('SHELLEY Block::parseBlock(' + blob.toString('hex') + ')')
    console.log('wasm = ' + JSON.stringify(wasm))

    const block = wasm.Block.from_bytes(blob)
    console.log("block content =")
    console.log(block)

    const slotId = block.slot()
    const chainLength = block.chain_length()
    // TODO: should these be hex strings or not?
    const contentHash = block.id().as_bytes().toString('hex')
    const parentHash = block.parent_id().as_bytes().toString('hex')
    // TODO: read txs
    let txs = []
    // we probably shouldn't hardcode this? (taken from byron parsing, used for tx creation)
    // const blockTime = new Date(
    //   (networkStartTime
    //   + (epochId * SLOTS_IN_EPOCH + slotId) * 20)
    //   * 1000).toUTCString()
    return new Block(contentHash, slotId, epochId, chainLength, txs, parentHash)
  }
}
