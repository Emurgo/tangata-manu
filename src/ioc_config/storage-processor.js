// @flow
import { Container } from 'inversify'

import type { StorageProcessor, Database } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import { PostgresStorageProcessor, DB } from '../entities'

const SEIZA_ELASTIC = 'seiza-elastic'
const YOROI_POSTGRES = 'yoroi-postgres'

const initStorageProcessor = (container: Container) => {
  const storageName = container.getNamed('storageProcessor')
  if (storageName === YOROI_POSTGRES) {
    container.bind<Database>(SERVICE_IDENTIFIER.DATABASE).to(DB).inSingletonScope()
    container.bind<StorageProcessor>(
      SERVICE_IDENTIFIER.STORAGE_PROCESSOR).to(PostgresStorageProcessor).inSingletonScope()
  } else if (storageName === SEIZA_ELASTIC) {
    throw new Error(`Storage: ${storageName} not yet implemented.`)
  } else {
    throw new Error(`Storage: ${storageName} not supported.`)
  }
}

export default initStorageProcessor
