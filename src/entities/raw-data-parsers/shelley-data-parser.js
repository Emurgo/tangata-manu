// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { Block, Epoch } from '../../blockchain-shelley'
import type { NetworkConfig } from '../../interfaces'

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

  parseBlock(blob: Buffer): Block {
    return Block.fromCBOR(blob, this.networkStartTime)
  }

  parseEpoch(data: Buffer, options:{} = {}) {
    const epoch = Epoch.fromCBOR(data, this.networkStartTime)
    return epoch.getBlocksIterator(options)
  }
}

helpers.annotate(ShelleyDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default ShelleyDataParser
