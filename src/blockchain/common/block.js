// @flow

export type EpochIdType = number

export type SlotIdType = number

export interface Block {
  // TODO: more documentation on this method
  serialize(): any;
  getHash(): string;
  getPrevHash(): string;
  getEpoch(): EpochIdType;
  // slot, or null if not applicable (ie Byron EBB)
  getSlot(): ?SlotIdType;
  getHeight(): number;
  // TODO: Tx should be TxObj or other?
  getTxs(): Array<any>;
  getTime(): Date;
  // size in bytes of block
  getSize(): number;
  // string (Hex) encoding of leader id (not key!) during slot (Byron),
  // or null if it doesn't exist (ie Byron EBB, or Byron but PK not resolved yet).
  // in Shelley this will be a (hex) encoded pool id of the slot leader
  getSlotLeaderId(): ?string;
}
