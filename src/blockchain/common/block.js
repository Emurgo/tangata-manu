// @flow

export type EpochId = number

export type SlotId = number

export interface Block {
  serialize(): any;
  getHash(): string;
  getPrevHash(): String;
  getEpoch(): EpochId;
  getSlot(): SlotId;
  getHeight(): number;
  getTxs(): Array<any>;
}