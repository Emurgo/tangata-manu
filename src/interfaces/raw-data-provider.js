// @flow

export interface RawDataProvider {
  postSignedTx(txPayload: string): Promise<any>;
  getBlock(id: string): Promise<string>;
  getEpoch(id: number): Promise<string>;
  getGenesis(hash: string): Promise<Object>;
  getStatus(): Promise<any>;
}
