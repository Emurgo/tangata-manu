// @flow

import { Container } from 'inversify'

import SERVICE_IDENTIFIER from '../constants/identifiers'

import { DATA_PROVIDER } from '../entities/network-config'

import {
  ByronValidator,
  CardanoBridgeApi,
  ByronDataParser,
  CardanoExplorerApi,
} from '../entities'
import {
  Validator,
  RawDataProvider,
  RawDataParser,
  NetworkConfig,
} from '../interfaces'

const initByron = (container: Container) => {
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  const dataProviderClass = networkConfig.dataProvider() === DATA_PROVIDER.CARDANO_EXPLORER
    ? CardanoExplorerApi : CardanoBridgeApi
  container.bind<Validator>(SERVICE_IDENTIFIER.VALIDATOR)
    .to(ByronValidator).inSingletonScope()
  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(dataProviderClass).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(ByronDataParser).inSingletonScope()
}

export default initByron
