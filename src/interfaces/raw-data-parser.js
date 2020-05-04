// @flow

import type { Block, TxType } from '../blockchain/common'

export interface RawDataParser {
  parseBlock(data: Buffer): Block;
  parseEpoch(data: Buffer): any;
  parseTx(data: Buffer, extraData: {
    blockHash: ?string,
    blockNum: ?number,
    txOrdinal: ?number,
    txTime: Date,
    ...,
  }): TxType;
}
