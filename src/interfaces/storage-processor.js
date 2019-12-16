// @flow

import type { Block } from '../blockchain/common'

export type BlockInfoType = {
  height: number,
  epoch: number,
  slot?: number,
  hash: ?string,
}

export type GenesisLeaderType = {
  slotLeaderPk: string, // The public key used to sign blocks
  leadId: string, // Id of the leader entity
  name: string,
  description: string,
  ordinal: number
}

export type PoolOwnerInfoEntry = {
  owner: string,
  hash: string,
  info: any,
  sig: string,
  meta: any,
}

export interface StorageProcessor {

  genesisLoaded(): Promise<boolean>;

  storeGenesisLeaders(leaders: Array<GenesisLeaderType>): Promise<void>;

  storeGenesisUtxos(utxos: Array<mixed>): Promise<void>;

  getBestBlockNum(): Promise<BlockInfoType>;

  onLaunch(): Promise<void>;

  storeBlocksData(blocks: Array<Block>): Promise<void>;

  rollbackTo(height: number): Promise<void>;

  storePoolOwnersInfo(entries: Array<PoolOwnerInfoEntry>): Promise<void>;

  /**
   * Returns a map from owner keys to latest info hashes
   */
  getLatestPoolOwnerHashes(): Promise<{ [owner: string]: string }>;
}
