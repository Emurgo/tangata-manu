// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataParser, NetworkConfig } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { ShelleyBlock, shelleyUtils } from '../../blockchain/shelley'
import type { TxType } from '../../blockchain/common'

class ShelleyDataParser implements RawDataParser {
  #logger: any

  networkStartTime: number

  constructor(
    logger: any,
    networkConfig: NetworkConfig,
  ) {
    this.#logger = logger
    this.networkStartTime = networkConfig.startTime()
  }

  parseBlock(blob: Buffer) {
    this.#logger.debug('this.networkStartTime = ' + this.networkStartTime + '; this = ' + JSON.stringify(this))
    return ShelleyBlock.parseBlock(blob, this.networkStartTime)
  }

  parseEpoch(data: Buffer, options:{} = {}) {
    throw new Error('ShelleyDataParser::parseEpoch() is not implemented')
  }

  parseTx(data: Buffer, extraData: {
    blockHash: ?string,
    blockNum: ?number,
    txOrdinal: ?number,
    txTime: Date,
  }): TxType {
    return shelleyUtils.rawTxToObj(data, extraData)
  }
}

helpers.annotate(ShelleyDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default ShelleyDataParser