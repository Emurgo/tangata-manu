// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import type { Logger } from 'bunyan'

import cbor from 'cbor'

import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import type { TxType } from '../../blockchain/common'
import { Block } from '../../blockchain/common'
import { ByronBlock, ByronEpoch, byronUtils } from '../../blockchain/byron'
import type { NetworkConfig } from '../../interfaces'

class ByronDataParser implements RawDataParser {
  logger: Logger

  networkStartTime: number

  constructor(
    logger: any,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.networkStartTime = networkConfig.startTime()
  }

  parseBlock(blob: Buffer): Block {
    return ByronBlock.fromCBOR(blob, this.networkStartTime)
  }

  parseEpoch(data: Buffer, options:{omitEbb?: boolean} = {}) {
    const epoch = ByronEpoch.fromCBOR(data, this.networkStartTime)
    return epoch.getBlocksIterator(options)
  }

  parseTx(data: Buffer, extraData: {
    blockHash: ?string,
    blockNum: ?number,
    txOrdinal: ?number,
    txTime: Date,
  }): TxType {
    this.logger.debug('ByronDataParser.parse')
    const txCbor = cbor.decode(data)
    const txObj = byronUtils.rawTxToObj(txCbor, extraData)
    return txObj
  }
}

helpers.annotate(ByronDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default ByronDataParser
