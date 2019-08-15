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

  async rollbackTo(height: number) {
    await this.db.rollBackTransactions(height)
    await this.db.rollBackUtxoBackup(height)
    await this.db.rollBackBlockHistory(height)
    await this.db.updateBestBlockNum(height)
  }

  async getBestBlockNum() {
    return this.db.getBestBlockNum()
  }

  async updateBestBlockNum(height: number) {
    return this.db.updateBestBlockNum(height)
  }

  async storeBlockTxs(block) {
    return this.db.storeBlockTxs(block)
  }

  async beginTransaction() {
    const dbConn = this.db.getConn()
    await dbConn.query('BEGIN')
  }

  async commitTransaction() {
    const dbConn = this.db.getConn()
    await dbConn.query('COMMIT')
  }

  async rollbackTransaction() {
    const dbConn = this.db.getConn()
    await dbConn.query('ROLLBACK')
  }

}

helpers.annotate(PostgresStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
  ])


export default PostgresStorageProcessor
