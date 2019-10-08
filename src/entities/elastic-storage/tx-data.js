// @flow

import type { TxType } from '../../blockchain'

import ElasticData from './elastic-data'
import type UtxoData from './utxo-data'

class TxData extends ElasticData {
  tx: TxType

  constructor(tx: TxType) {
    super()
    this.tx = tx
  }

  static fromGenesisUtxo(utxo: UtxoData, networkStartTime: number) {
    return new TxData({
      isGnesis: true,
      blockHash: null,
      blockNum: null,
      inputs: [],
      isGenesis: true,
      txBody: '',
      txOrdinal: 0,
      txTime: new Date(networkStartTime * 1000),
      witnesses: [],
      id: utxo.getHash(),
      branch: 0,
      outputs: [
        utxo.toPlainObject(),
      ],
    })
  }

  toPlainObject() {
    return {
      ...TxData.getBaseFields(),
      is_genesis: this.tx.isGenesis || false,
      hash: this.tx.id,
      outputs: this.tx.outputs,
      time: this.tx.txTime.toISOString(),
    }
  }
}

export default TxData
