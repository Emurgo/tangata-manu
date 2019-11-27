// @flow

import 'reflect-metadata'

import { Container } from 'inversify'
import { EagerBinder } from 'inversify-config-injection'

import {
  CronScheduler,
  GenesisProvider,
} from '../entities'
import {
  Scheduler,
  Genesis,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import dbModule from './db'
import loggerModule from './logger'
import networkConfigModule from './network-config'
import initRoutes from './routes'
import initNetwork from './network'
import initStorageProcessor, { YOROI_POSTGRES } from './storage-processor'

const configBinder = new EagerBinder({
  objects: true,
})
const initIoC = async () => {
  const container = new Container()
  container.load(configBinder.getModule())
  container.load(loggerModule)
  container.load(networkConfigModule)
  await container.loadAsync(dbModule)

  initNetwork(container)

  container.bind<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER).to(CronScheduler).inSingletonScope()
  container.bind<Genesis>(SERVICE_IDENTIFIER.GENESIS).to(GenesisProvider).inSingletonScope()

  initStorageProcessor(container)
  const storageName = container.getNamed('storageProcessor')
  if (storageName === YOROI_POSTGRES) {
    initRoutes(container)
  }
  return container
}

export default initIoC
