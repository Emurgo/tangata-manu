// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import type { Logger } from 'bunyan'

import { RawDataParser, NetworkConfig } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { ShelleyBlock, shelleyUtils } from '../../blockchain/shelley'
import type { TxType } from '../../blockchain/common'

class ShelleyDataParser implements RawDataParser {
  logger: Logger

  networkStartTime: number

  networkDiscrimination: number

  networkSlotsPerEpoch: number

  networkSlotDurationSeconds: number

  constructor(
    logger: any,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.networkStartTime = networkConfig.startTime()
    this.networkDiscrimination = networkConfig.networkDiscrimination()
    this.networkSlotsPerEpoch = networkConfig.slotsPerEpoch()
    this.networkSlotDurationSeconds = networkConfig.slotDurationSeconds()
  }

  parseBlock(blob: Buffer) {
    return ShelleyBlock.parseBlock(blob,
      this.networkStartTime, this.networkDiscrimination,
      this.networkSlotsPerEpoch, this.networkSlotDurationSeconds)
  }

  parseEpoch(data: Buffer, options:{} = {}) {
    this.logger.debug('ShelleyDataParser.parseEpoch', data, options)
    throw new Error('ShelleyDataParser::parseEpoch() is not implemented')
  }

  parseTx(data: Buffer, extraData: {
    blockHash: ?string,
    blockNum: ?number,
    epoch: ?number,
    slot: ?number,
    txOrdinal: ?number,
    txTime: Date,
  }): TxType {
    this.logger.debug('ShelleyDataParser.parseTx')
    return shelleyUtils.rawTxToObj(data, this.networkDiscrimination, extraData)
  }
}

helpers.annotate(ShelleyDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default ShelleyDataParser
