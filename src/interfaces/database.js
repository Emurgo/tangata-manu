// @flow

export interface Database {
  getBestBlockNum(): any;
  storeUtxos(utxos: Array<mixed>): Promise<any>;

  getConn(): any;

}

export interface DBConnection {

}
