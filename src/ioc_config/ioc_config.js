// @flow
import 'reflect-metadata'

import { Container } from 'inversify'
import { EagerBinder } from 'inversify-config-injection'

import {
  CardanoBridgeApi,
  CustomDataParser,
  CronScheduler,
  DB,
} from '../entities'
import {
  RawDataProvider,
  RawDataParser,
  Scheduler,
  Database,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import dbModule from './db'
import loggerModule from './logger'

const configBinder = new EagerBinder({
  objects: true,
})
const initIoC = async () => {
  const container = new Container()
  container.load(configBinder.getModule())
  container.load(loggerModule)
  await container.loadAsync(dbModule)

  container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER).to(CardanoBridgeApi)
  container.bind<RawDataParser>(SERVICE_IDENTIFIER.RAW_DATA_PARSER).to(CustomDataParser)
  container.bind<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER).to(CronScheduler)
  container.bind<Database>(SERVICE_IDENTIFIER.DATABASE).to(DB)
  return container
}

export default initIoC
