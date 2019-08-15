// @flow
export interface StorageProcessor {
  storeBlocks([]): void;

  rollbackTo(height: number): void;

}
