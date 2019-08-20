// @flow
import _ from 'lodash'

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

  async storeBlocksData(block, cachedBlocks) {
    const dbConn = this.db.getConn()
    const blockHaveTxs = !_.isEmpty(block.txs)
    try {
      await dbConn.query('BEGIN')
      if (blockHaveTxs) {
        await this.db.storeBlockTxs(block)
      }
      await this.db.storeBlocks(cachedBlocks)
      await this.db.updateBestBlockNum(block.height)
      await dbConn.query('COMMIT')
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    }
  }

  async rollbackTo(height: number) {
    const dbConn = this.db.getConn()
    try {
      await dbConn.query('BEGIN')
      await this.db.rollBackTransactions(height)
      await this.db.rollBackUtxoBackup(height)
      await this.db.rollBackBlockHistory(height)
      await this.db.updateBestBlockNum(height)
      await dbConn.query('COMMIT')
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    }
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

}

helpers.annotate(PostgresStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
  ])


export default PostgresStorageProcessor
