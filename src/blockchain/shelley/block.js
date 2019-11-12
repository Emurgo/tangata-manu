// @flow

import { Block } from '../common'
import type { EpochId, SlotId, TxType } from '../common'
import { shelleyUtils } from '.'

// TODO: is this right?
const SLOTS_IN_EPOCH = 21600

export type HeaderType = Array<any>

export default class ShelleyBlock implements Block {
  hash: string

  prevHash: string

  slot: number

  epoch: number

  height: number

  txs: Array<TxType>

  constructor(hash: string, slot: number, epoch: number, height:number, txs: any, prevHash: string) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs
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

  getEpoch(): EpochId {
    return this.epoch
  }

  getSlot(): ?SlotId {
    return this.slot
  }

  getHeight(): number {
    return this.height
  }

  getTxs(): Array<any> {
    return this.txs
  }

  getTime(): Date {
    // TODO: implement
    return new Date(Date.now())
  }

  getSize(): number {
    // TODO: implement
    return 0
  }

  getSlotLeaderId(): ?string {
    // TODO: implement
    return null
  }

  static parseBlock(blob: Buffer, networkStartTime: number): ShelleyBlock {
    const wasm = global.jschainlibs

    const block = wasm.Block.from_bytes(blob)

    const epochId = block.epoch()
    const slotId = block.slot()
    console.log(`SHELLEY BLOCK TIME: [${epochId}, ${slotId}]`)
    const chainLength = block.chain_length()
    // TODO: should these be hex strings or not?
    const blockHash = Buffer.from(block.id().as_bytes()).toString('hex')
    const parentHash = Buffer.from(block.parent_id().as_bytes()).toString('hex')
    // we probably shouldn't hardcode this? (taken from byron parsing, used for tx creation)
    // this is definitely not right as we have different epoch lengths for the networking testnet
    const blockTime = new Date(
      (networkStartTime
      + (epochId * SLOTS_IN_EPOCH + slotId) * 20)
      * 1000)
    const fragments = block.fragments()
    const txs = []
    console.log(`\n\nfragments: ${fragments.size()}`)
    for (let index = 0; index < fragments.size(); index += 1) {
      const fragment = fragments.get(index)
      if (fragment.is_transaction()) console.log(`#${index} = TRANSACTION`)
      if (fragment.is_owner_stake_delegation()) console.log(`#${index} = OWNER STAKE DELEG`)
      if (fragment.is_stake_delegation()) console.log(`#${index} = STAKE DELEG`)
      if (fragment.is_pool_registration()) console.log(`#${index} = POOL REG`)
      if (fragment.is_pool_management()) console.log(`#${index} = POOL MANAGE`)
      if (fragment.is_transaction() ||
          fragment.is_owner_stake_delegation() ||
          fragment.is_pool_registration() ||
          fragment.is_pool_management() ||
          fragment.is_stake_delegation()) {
        txs.push(shelleyUtils.fragmentToObj(fragment, {
          txTime: blockTime,
          txOrdinal: index,
          blockNum: chainLength,
          blockHash,
        }))
      } else if (fragment.is_initial()) {
        console.log(`#${index} = INITIAL FRAG`)
      } else if (fragment.is_old_utxo_declaration()) {
        console.log(`#${index} = OLD UTXO`)
      } else {
        // skip updates
        console.log(`#${index} skipped`)
      }
    }
    return new ShelleyBlock(blockHash, slotId, epochId, chainLength, txs, parentHash)
  }
}
