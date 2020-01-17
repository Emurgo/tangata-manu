// @flow

import { Container } from 'inversify'

import SERVICE_IDENTIFIER from '../constants/identifiers'

import {
  ByronValidator,
  CardanoBridgeApi,
  ByronDataParser,
} from '../entities'
import {
  Validator,
  RawDataProvider,
  RawDataParser,
} from '../interfaces'

const initByron = (container: Container) => {
  container.bind<Validator>(SERVICE_IDENTIFIER.VALIDATOR)
    .to(ByronValidator).inSingletonScope()
  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(CardanoBridgeApi).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(ByronDataParser).inSingletonScope()
}

export default initByron
