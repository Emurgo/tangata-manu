// @flow

import { Container } from 'inversify'

import type {
  Validator,
  RawDataProvider,
  RawDataParser,
  Scheduler,
  RewardsLoader,
} from '../interfaces'

import SERVICE_IDENTIFIER from '../constants/identifiers'
import {
  ShelleyValidator,
  JormungandrApi,
  ShelleyDataParser,
  GitHubLoader,
  GitHubApi,
  RewardsLoaderImpl,
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
  container.bind<RewardsLoader>(SERVICE_IDENTIFIER.REWARDS_LOADER)
    .to(RewardsLoaderImpl).inSingletonScope()
}

export default initShelley
