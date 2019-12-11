// @flow

import { Container } from 'inversify'

import SERVICE_IDENTIFIER from '../constants/identifiers'

import {
  ByronValidator,
  ShelleyValidator,
  CardanoBridgeApi,
  MockBridgeApi,
  MockDataParser,
  ByronDataParser,
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
  const networkProtocol = networkConfig.networkProtocol()
  let validatorClass
  let apiClass
  let dataParserClass
  if (process.env.YOROI_IMPORTER_TEST) {
    logger.info('$YOROI_IMPORTER_TEST env var is set. Mocking API and data parser.')
    validatorClass = ByronValidator
    apiClass = MockBridgeApi
    dataParserClass = MockDataParser
  } else if (networkProtocol === NETWORK_PROTOCOL.BYRON) {
    validatorClass = ByronValidator
    apiClass = CardanoBridgeApi
    dataParserClass = ByronDataParser
  } else if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
    validatorClass = ShelleyValidator
    apiClass = JormungandrApi
    dataParserClass = ShelleyDataParser
  } else {
    throw new Error(`${networkProtocol} network protocol not supported.`)
  }

  container.bind<Validator>(SERVICE_IDENTIFIER.VALIDATOR)
    .to(validatorClass).inSingletonScope()
  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(apiClass).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(dataParserClass).inSingletonScope()
}

export default initNetwork
