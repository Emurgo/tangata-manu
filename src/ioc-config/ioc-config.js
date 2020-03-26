// @flow

import 'reflect-metadata'

import { Container } from 'inversify'
import { EagerBinder } from 'inversify-config-injection'

import { NETWORK_PROTOCOL } from '../entities/network-config'
import {
  CronScheduler,
  GenesisProvider,
  MempoolChecker,
} from '../entities'
import {
  Scheduler,
  Genesis,
  NetworkConfig,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import dbModule from './db'
import cardanoExplorerDbModule from './cardano-explorer-db'
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
  await container.loadAsync(cardanoExplorerDbModule)

  initNetwork(container)

  container.bind<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER).to(CronScheduler).inSingletonScope()
  container.bind<Genesis>(SERVICE_IDENTIFIER.GENESIS).to(GenesisProvider).inSingletonScope()

  initStorageProcessor(container)
  const storageName = container.getNamed('storageProcessor')
  if (storageName === YOROI_POSTGRES) {
    initRoutes(container)
    const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
    const networkProtocol = networkConfig.networkProtocol()
    if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
      container.bind<Scheduler>(
        SERVICE_IDENTIFIER.MEMPOOL_CHECKER).to(MempoolChecker).inSingletonScope()
    }
  }
  return container
}

export default initIoC
