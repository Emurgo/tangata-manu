// @flow

export type EpochId = number

export type SlotId = number

export interface Block {
  // TODO: more documentation on this method
  serialize(): any;
  getHash(): string;
  getPrevHash(): string;
  getEpoch(): EpochId;
  // slot, or null if not applicable (ie Byron EBB)
  getSlot(): ?SlotId;
  getHeight(): number;
  // TODO: Tx should be TxObj or other?
  getTxs(): Array<any>;
  getTime(): Date;
  // size in bytes of block
  getSize(): number;
  // string (Hex) encoding of leader key during slot, or null if it doesn't exist (ie Byron EBB)
  getLeaderKey(): ?string;
}