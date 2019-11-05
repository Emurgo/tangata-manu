// @flow

import { Container } from 'inversify'

import type { StorageProcessor, Database } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import { PostgresStorageProcessor, ElasticStorageProcessor, DB } from '../entities'

export const SEIZA_ELASTIC = 'seiza-elastic'
export const YOROI_POSTGRES = 'yoroi-postgres'

const initStorageProcessor = (container: Container) => {
  const storageName = container.getNamed('storageProcessor')
  const storageBind = container.bind<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  if (storageName === YOROI_POSTGRES) {
    container.bind<Database>(SERVICE_IDENTIFIER.DATABASE).to(DB).inSingletonScope()
    storageBind.to(PostgresStorageProcessor).inSingletonScope()
  } else if (storageName === SEIZA_ELASTIC) {
    storageBind.to(ElasticStorageProcessor).inSingletonScope()
  } else {
    throw new Error(`Storage: ${storageName} not supported.`)
  }
}

export default initStorageProcessor
