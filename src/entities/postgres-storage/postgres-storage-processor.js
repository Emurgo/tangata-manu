// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type { StorageProcessor, Database } from '../../interfaces'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import type { Block, TxType } from '../../blockchain/common'

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

  async storeBlocksData(blocks: Array<Block>) {
    return this.doInTransaction(async () => {
      await this.db.storeBlocks(blocks)
      for (const block of blocks) {
        const blockHaveTxs = !_.isEmpty(block.getTxs())
        if (blockHaveTxs) {
          await this.db.storeBlockTxs(block)
          await this.db.storeNewSnapshot(block)
        }
      }
      await this.db.updateBestBlockNum(_.last(blocks).getHeight())
    })
  }

  async rollbackTo(height: number) {
    return this.doInTransaction(async () => {
      await this.db.rollBackTransactions(height)
      await this.db.rollbackTransientSnapshots(height)
      await this.db.rollBackUtxoBackup(height)
      await this.db.rollBackBlockHistory(height)
      await this.db.updateBestBlockNum(height)
    })
  }

  async doInTransaction(callback) {
    const dbConn = this.db.getConn()
    try {
      await dbConn.query('BEGIN')
      await callback()
      await dbConn.query('COMMIT')
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    }
  }

  async utxosForInputsExists(inputs) {
    return this.db.utxosForInputsExists(inputs)
  }

  async txsForInputsExists(inputs) {
    return this.db.txsForInputsExists(inputs)
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    return this.db.getBestBlockNum()
  }

  async updateBestBlockNum(height: number) {
    return this.db.updateBestBlockNum(height)
  }

  async onLaunch() {
    this.logger.debug('Launched PostgresStorageProcessor storage processor.')
  }

  async genesisLoaded() {
    return this.db.genesisLoaded()
  }

  async storeGenesisLeaders(leaders: Array<mixed>) {
    // ignored
  }

  async storeGenesisUtxos(utxos: Array<mixed>) {
    return this.db.storeUtxos(utxos)
  }

  async storeUtxos(utxos: Array<mixed>) {
    return this.db.storeUtxos(utxos)
  }

  async storeBlockTxs(block: Block) {
    return this.db.storeBlockTxs(block)
  }

  async storeTx(tx: TxType) {
    return this.db.storeTx(tx)
  }

  async getOutputsForTxHashes(txHashes: Array<string>) {
    return this.db.getOutputsForTxHashes(txHashes)
  }
}

helpers.annotate(PostgresStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
  ])


export default PostgresStorageProcessor
