// @flow

import { Block } from '../common'
import type { EpochIdType, SlotIdType, TxType } from '../common'
import shelleyUtils from './utils'
import { RustModule } from '../../rustLoader'

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
    height:number, txs: any, prevHash: string, slotLeader: ?string) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs

    // FIXME: implement
    this.time = new Date(Date.now())
    this.size = 0
    this.slotLeader = slotLeader
  }

  serialize() {
    return {
      block_hash: this.getHash(),
      epoch: this.getEpoch(),
      slot: this.getSlot(),
      block_height: this.getHeight(),
      slot_leader: this.getSlotLeaderId(),
    }
  }

  getHash(): string {
    return this.hash
  }

  getPrevHash(): string {
    return this.prevHash
  }

  isGenesisBlock(): boolean {
    return this.height === 0
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
    return this.slotLeader == null
      ? null
      : this.slotLeader
  }

  static parseBlock(
    blob: Buffer,
    networkStartTime: number,
    networkDiscrimination: number,
    networkSlotsPerEpoch: number,
    networkSlotDurationSeconds: number,
  ): ShelleyBlock {
    const block = RustModule.WalletV3.Block.from_bytes(blob)

    const epochId = block.epoch()
    const slotId = block.slot()
    const chainLength = block.chain_length()
    // TODO: should these be hex strings or not?
    const blockHash = shelleyUtils.consumeIdToHex(block.id())
    const parentHash = shelleyUtils.consumeIdToHex(block.parent_id())
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
        const fragmentId = shelleyUtils.consumeIdToHex(fragment.id())
        const oldUtxos = fragment.get_old_utxo_declaration()
        const old_utxo_outputs = []
        for (let i = 0; i < oldUtxos.size(); ++i) {
          old_utxo_outputs.push({
            address: oldUtxos.get_address(i),
            value: shelleyUtils.consumeValueToNumber(oldUtxos.get_value(i)),
          })
        }
        oldUtxos.free()
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
      fragment.free()
    }
    fragments.free()

    const slotLeader = shelleyUtils.consumeOptionalValueToString(block.leader_id())
    block.free()
    return new ShelleyBlock(blockHash,
      slotId,
      epochId,
      chainLength,
      txs,
      parentHash,
      slotLeader)
  }
}
