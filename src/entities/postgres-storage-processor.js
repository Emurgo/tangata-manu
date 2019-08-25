// @flow
import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'

import type { StorageProcessor, Logger, Database } from '../interfaces'
import type { BlockInfoType } from '../interfaces/storage-processor'
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

  async storeBlockData(block, cachedBlocks) {
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

  async getBestBlockNum(): Promise<BlockInfoType> {
    return this.db.getBestBlockNum()
  }

  async updateBestBlockNum(height: number) {
    return this.db.updateBestBlockNum(height)
  }

  async genesisLoaded() {
    return this.db.genesisLoaded()
  }

  async storeUtxos(utxos) {
    return this.db.storeUtxos(utxos)
  }

  async storeBlockTxs(block) {
    return this.db.storeBlockTxs(block)
  }

  async storeTx(tx) {
    return this.db.storeTx(tx)
  }

  async getOutputsForTxHashes(txHashes) {
    return this.db.getOutputsForTxHashes(txHashes)
  }

}

helpers.annotate(PostgresStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
  ])


export default PostgresStorageProcessor
