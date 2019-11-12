// @flow

import { Container } from 'inversify'

import SERVICE_IDENTIFIER from '../constants/identifiers'

import {
  ByronValidator,
  CardanoBridgeApi,
  MockBridgeApi,
  MockDataParser,
  CustomDataParser,
  JormungandrApi,
  ShelleyDataParser,
} from '../entities'

import { NETWORK_PROTOCOL } from '../entities/network-config'

import {
  NetworkConfig,
  Validator,
  RawDataProvider,
  RawDataParser,
  Logger,
} from '../interfaces'

const initNetwork = (container: Container) => {
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  container.bind<Validator>(SERVICE_IDENTIFIER.VALIDATOR)
    .to(ByronValidator).inSingletonScope()
  const networkProtocol = networkConfig.networkProtocol()
  let apiClass
  let dataParserClass
  if (process.env.YOROI_IMPORTER_TEST) {
    logger.info('$YOROI_IMPORTER_TEST env var is set. Mocking API and data parser.')
    apiClass = MockBridgeApi
    dataParserClass = MockDataParser
  } else if (networkProtocol === NETWORK_PROTOCOL.BYRON) {
    apiClass = CardanoBridgeApi
    dataParserClass = CustomDataParser
  } else if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
    apiClass = JormungandrApi
    dataParserClass = ShelleyDataParser
  } else {
    throw new Error(`${networkProtocol} network protocol not supported.`)
  }

  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(apiClass).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(dataParserClass).inSingletonScope()
}

export default initNetwork
