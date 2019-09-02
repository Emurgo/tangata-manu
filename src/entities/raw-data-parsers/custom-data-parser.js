// @flow

import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { Block, Epoch } from '../../blockchain'
import type { NetworkConfig } from '../../interfaces'

class CustomDataParser implements RawDataParser {
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

  parseEpoch(data: Buffer, options:{omitEbb?: boolean} = {}) {
    const epoch = Epoch.fromCBOR(data, this.networkStartTime)
    return epoch.getBlocksIterator(options)
  }
}

helpers.annotate(CustomDataParser, [
  SERVICE_IDENTIFIER.LOGGER,
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default CustomDataParser
