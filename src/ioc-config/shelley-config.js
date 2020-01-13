// @flow

import { Container } from 'inversify'

import type {
  Validator,
  RawDataProvider,
  RawDataParser,
  Scheduler,
} from '../interfaces'

import SERVICE_IDENTIFIER from '../constants/identifiers'
import {
  ShelleyValidator,
  JormungandrApi,
  ShelleyDataParser,
  GitHubLoader,
  GitHubApi,
} from '../entities'


const initShelley = (container: Container) => {
  container.bind<Validator>(SERVICE_IDENTIFIER.VALIDATOR)
    .to(ShelleyValidator).inSingletonScope()
  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(JormungandrApi).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(ShelleyDataParser).inSingletonScope()
  container.bind<Scheduler>(SERVICE_IDENTIFIER.GITHUB_LOADER)
    .to(GitHubLoader).inSingletonScope()
  container.bind<Scheduler>(SERVICE_IDENTIFIER.GITHUB_API)
    .to(GitHubApi).inSingletonScope()
}

export default initShelley
