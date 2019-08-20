// @flow
export interface StorageProcessor {
  storeBlocksData([]): void;

  rollbackTo(height: number): void;

}
