// @flow

import { helpers } from 'inversify-vanillajs-helpers'

import type { RawDataProvider, RawDataParser, NetworkConfig } from '../../../interfaces'
import SERVICE_IDENTIFIER from '../../../constants/identifiers'

class CardanoExplorerApi implements RawDataProvider {
  parser: RawDataParser

  constructor(
    networkConfig: NetworkConfig,
  ) {
  }

  getStatus() {
    console.log('Get status called.')
  }
}

helpers.annotate(CardanoExplorerApi, [
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
])

export default CardanoExplorerApi
