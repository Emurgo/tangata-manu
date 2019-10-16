// @flow

export interface Database {
  getBestBlockNum(): any;
  storeUtxos(utxos: Array<mixed>): Promise<any>;
  storeBlockTxs(block: any): Promise<void>;
  genesisLoaded(): Promise<boolean>;
  updateBestBlockNum(height: number): Promise<void>;
  getConn(): any;

}

export interface DBConnection {

}
