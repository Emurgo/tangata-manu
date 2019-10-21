// @flow

import type { Block } from '../blockchain/common'

export type BlockInfoType = {
  height: number,
  epoch: number,
  slot?: number,
  hash?: string,
}

export interface StorageProcessor {
  getBestBlockNum(): Promise<BlockInfoType>;

  onLaunch(): Promise<void>;

  storeBlocksData(blocks: Array<Block>): Promise<void>;

  rollbackTo(height: number): Promise<void>
}
