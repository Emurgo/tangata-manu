// @flow
import type { Block } from '../blockchain'

export type BlockInfoType = {
  height: number,
  epoch?: number,
  slot?: number,
  hash?: string }

export interface StorageProcessor {
  getBestBlockNum(): Promise<BlockInfoType>;

  storeBlockData(block: Block, cachedBlocks: []): Promise<void>
}
