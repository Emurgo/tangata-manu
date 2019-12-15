// @flow

import { Block } from '../common'
import type { EpochIdType, SlotIdType, TxType } from '../common'
import shelleyUtils from './utils'

export type HeaderType = Array<any>

export default class ShelleyBlock implements Block {
  hash: string

  prevHash: string

  slot: number

  epoch: number

  height: number

  txs: Array<TxType>

  time: Date

  size: number

  slotLeader: ?string

  constructor(hash: string, slot: number, epoch: number,
    height:number, txs: any, prevHash: string) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs

    // FIXME: implement
    this.time = new Date(Date.now())
    this.size = 0
    this.slotLeader = null
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
    return this.prevHash === '0000000000000000000000000000000000000000000000000000000000000000'
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

  getTxs(): Array<any> {
    return this.txs
  }

  getTime(): Date {
    return this.time
  }

  getSize(): number {
    return this.size
  }

  getSlotLeaderId(): ?string {
    return this.slotLeader
  }

  static parseBlock(
    blob: Buffer,
    networkStartTime: number,
    networkDiscrimination: number,
    networkSlotsPerEpoch: number,
    networkSlotDurationSeconds: number,
  ): ShelleyBlock {
    const wasm = global.jschainlibs

    const block = wasm.Block.from_bytes(blob)

    const epochId = block.epoch()
    const slotId = block.slot()
    const chainLength = block.chain_length()
    // TODO: should these be hex strings or not?
    const blockHash = Buffer.from(block.id().as_bytes()).toString('hex')
    const parentHash = Buffer.from(block.parent_id().as_bytes()).toString('hex')
    // we definitely shouldn't hardcode this (taken from byron parsing, used for tx creation)
    // this is definitely not right as we have different epoch lengths for the networking testnet
    // TODO: parse block0's Initial fragment and store that somewhere
    const blockTime = new Date(
      (networkStartTime
      + (epochId * networkSlotsPerEpoch + slotId) * networkSlotDurationSeconds)
      * 1000)
    const fragments = block.fragments()
    const txs = []
    console.log(`\n\nfragments: ${fragments.size()}`)
    for (let index = 0; index < fragments.size(); index += 1) {
      const txCommon = {
        txTime: blockTime,
        txOrdinal: index,
        blockNum: chainLength,
        blockHash,
        epoch: epochId,
        slot: slotId,
      }
      const fragment = fragments.get(index)
      if (fragment.is_transaction()) console.log(`#${index} = TRANSACTION`)
      if (fragment.is_owner_stake_delegation()) console.log(`#${index} = OWNER STAKE DELEG`)
      if (fragment.is_stake_delegation()) console.log(`#${index} = STAKE DELEG`)
      if (fragment.is_pool_retirement()) console.log(`#${index} = POOL MANAGE`)
      if (fragment.is_transaction() || fragment.is_owner_stake_delegation()
        || fragment.is_pool_registration() || fragment.is_stake_delegation()) {
        txs.push(shelleyUtils.fragmentToObj(fragment, networkDiscrimination,
          {
            ...txCommon,
            certOrdinal: 0,
          }))
      } else if (fragment.is_initial()) {
        console.log(`#${index} = INITIAL FRAG`)
      } else if (fragment.is_old_utxo_declaration()) {
        // console.log(`#${index} = OLD UTXO`)
        // done before since the line after consumes the fragment
        const fragmentId = Buffer.from(fragment.id().as_bytes()).toString('hex')
        const oldUtxos = fragment.get_old_utxo_declaration()
        const old_utxo_outputs = []
        for (let i = 0; i < oldUtxos.size(); ++i) {
          old_utxo_outputs.push({
            address: oldUtxos.get_address(i),
            value: parseInt(oldUtxos.get_value(i).to_str(), 10),
          })
        }
        const tx = {
          id: fragmentId,
          inputs: [],
          outputs: old_utxo_outputs,
          ...txCommon,
        }
        txs.push(tx)
      } else {
        // skip updates
        console.log(`#${index} skipped`)
      }
    }
    return new ShelleyBlock(blockHash, slotId, epochId, chainLength, txs, parentHash)
  }
}
