// @flow

import { Container } from 'inversify'

import type {
  StorageProcessor,
  Database,
  NetworkConfig,
} from '../interfaces'

import SERVICE_IDENTIFIER from '../constants/identifiers'
import { NETWORK_PROTOCOL } from '../entities/network-config'
import {
  PostgresStorageProcessor,
  ElasticStorageProcessor,
  DB,
  DBShelley,
} from '../entities'

export const SEIZA_ELASTIC = 'seiza-elastic'
export const YOROI_POSTGRES = 'yoroi-postgres'

const initDbProvider = (container: Container): void => {
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  const networkProtocol = networkConfig.networkProtocol()
  let dbProviderClass
  if (networkProtocol === NETWORK_PROTOCOL.BYRON) {
    dbProviderClass = DB
  } else if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
    dbProviderClass = DBShelley
  } else {
    throw new Error(`Protocol: ${networkProtocol} not supported.`)
  }
  container.bind<Database>(SERVICE_IDENTIFIER.DATABASE).to(dbProviderClass).inSingletonScope()
}

const initStorageProcessor = (container: Container): void => {
  const storageName = container.getNamed('storageProcessor')
  const storageBind = container.bind<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  if (storageName === YOROI_POSTGRES) {
    initDbProvider(container)
    storageBind.to(PostgresStorageProcessor).inSingletonScope()
  } else if (storageName === SEIZA_ELASTIC) {
    storageBind.to(ElasticStorageProcessor).inSingletonScope()
  } else {
    throw new Error(`Storage: ${storageName} not supported.`)
  }
}

export default initStorageProcessor
