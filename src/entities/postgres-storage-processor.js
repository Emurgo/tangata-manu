// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { StorageProcessor, Logger, Database } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class PostgresStorageProcessor implements StorageProcessor {
  logger: Logger

  db: Database

  constructor(
    logger: Logger,
    db: Database,
  ) {
    this.logger = logger
    this.db = db
  }

  async storeBlocks(blocks: []) {
    const dbRes = await this.db.storeBlocks(blocks)
    return dbRes
  }

  rollbackTo(height: number) {

  }

}

helpers.annotate(PostgresStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
  ])


export default PostgresStorageProcessor
