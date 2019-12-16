// @flow

import type { Block, TxInputType } from '../blockchain/common'

export interface Database<TxType> {
  getBestBlockNum(): any;
  storeUtxos(utxos: Array<mixed>): Promise<any>;
  storeBlockTxs(block: any): Promise<void>;
  storeTx(tx: TxType, txUtxos?:Array<mixed>, upsert?:boolean): Promise<void>;
  genesisLoaded(): Promise<boolean>;
  updateBestBlockNum(height: number): Promise<void>;
  getConn(): any;
  getOutputsForTxHashes(hashes: Array<string>): Promise<Array<{}>>;
  isTxExists(txId: string): Promise<boolean>;
  getTxStatus(txId: string): Promise<string>;
  storeBlocks(blocks: Array<Block>): Promise<void>;
  storeNewSnapshot(block: Block): Promise<void>;
  addNewTxToTransientSnapshots(txHash: string, txStatus: string): Promise<void>;
  rollBackTransactions(blockHeight: number): Promise<void>;
  rollbackTransientSnapshots(blockHeight: number): Promise<void>;
  rollBackUtxoBackup(blockHeight: number): Promise<void>;
  rollBackBlockHistory(blockHeight: number): Promise<void>;
  txsForInputsExists(inputs: Array<TxInputType>): Promise<boolean>;

  storePoolOwnersInfo(inputs: Array<TxInputType>): Promise<boolean>;
  getLatestPoolOwnerHashes(): Promise<{}>;

  doInTransaction(callback: Function): Promise<any>;
}

export interface DBConnection {

}
