// @flow
import 'reflect-metadata'

import { Container } from 'inversify'
import { EagerBinder } from 'inversify-config-injection'

import {
  CardanoBridgeApi,
  CustomDataParser,
  CronScheduler,
  DB,
  GenesisProvider,
  MockBridgeApi,
  MockDataParser,
} from '../entities'
import {
  RawDataProvider,
  RawDataParser,
  Scheduler,
  Database,
  Genesis,
  Logger,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import dbModule from './db'
import loggerModule from './logger'
import networkConfigModule from './network-config'
import initRoutes from './routes'

const configBinder = new EagerBinder({
  objects: true,
})
const initIoC = async () => {
  const container = new Container()
  container.load(configBinder.getModule())
  container.load(loggerModule)
  container.load(networkConfigModule)
  await container.loadAsync(dbModule)

  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)

  let apiClass = CardanoBridgeApi
  let dataParserClass = CustomDataParser
  if (process.env.YOROI_IMPORTER_TEST) {
    logger.info('$YOROI_IMPORTER_TEST env var is set. Mocking API and data parser.')
    apiClass = MockBridgeApi
    dataParserClass = MockDataParser
  }

  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
    .to(apiClass).inSingletonScope()
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER)
    .to(dataParserClass).inSingletonScope()
  container.bind<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER).to(CronScheduler).inSingletonScope()
  container.bind<Database>(SERVICE_IDENTIFIER.DATABASE).to(DB).inSingletonScope()
  container.bind<Genesis>(SERVICE_IDENTIFIER.GENESIS).to(GenesisProvider).inSingletonScope()

  initRoutes(container)

  return container
}

export default initIoC
