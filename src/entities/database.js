// @flow
import { helpers } from 'inversify-vanillajs-helpers'
import _ from 'lodash'
import assert from 'assert'

import { Database, DBConnection, Logger } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import utils from '../blockchain/utils'
import Block, { TxType, TX_STATUS } from '../blockchain'
import Q from '../db-queries'


class DB implements Database {
  #conn: any

  #logger: any

  constructor(
    dbConn: DBConnection,
    logger: Logger,
  ) {
    this.#conn = dbConn
    this.#logger = logger
  }

  getConn() {
    return this.#conn
  }

  /**
   * We need to use this function cuz there are some extra-long addresses existing on Cardano mainnet.
   * Some of them exceed 10K characters in length, and Postgres can't store it.
   * We don't care about making these non-standard addresses spendable, so any address over 1K characters is just truncated.
   */
  static fixUtxoReceiver = (utxo) => {
    let { receiver } = utxo;
    if (receiver && receiver.length > 1000) {
      receiver = `${receiver.substr(0, 497)}...${receiver.substr(receiver.length - 500, 500)}`
    }
    return {...utxo, receiver};
  }

  async storeUtxos(utxos: [{}]) {
    const conn = this.getConn()
    const fixed_utxos = utxos.map(DB.fixUtxoReceiver)
    const query = Q.UTXOS_INSERT.setFieldsRows(fixed_utxos).toString()
    this.#logger.debug('storeUtxos', fixed_utxos, query)
    const dbRes = await conn.query(query)
    this.#logger.debug('storeUtxos', dbRes)
    return dbRes
  }

  async getBestBlockNum(): Promise<{ height: number, epoch?: number, slot?: number }> {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BEST_BLOCK_NUM.toString())
    if (dbRes.rowCount > 0) {
      const row = dbRes.rows[0]
      return {
        height: Number(row.block_height),
        epoch: Number(row.epoch),
        slot: Number(row.slot),
      }
    }
    return { height: 0, epoch: 0 }
  }

  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.BEST_BLOCK_UPDATE.set('best_block_num', bestBlockNum).toString())
    return dbRes
  }

  async rollBackTransactions(blockHeight: number) {
    this.#logger.info(`rollBackTransactions to block ${blockHeight}`)
    const conn = this.getConn()
    const sql = Q.sql.update()
      .table('txs')
      .set('tx_state', TX_STATUS.TX_PENDING_STATUS)
      .set('block_num', null)
      .set('block_hash', null)
      .set('time', null)
      .set('last_update', 'NOW()', { dontQuote: true })
      .where('block_num > ?', blockHeight)
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async deleteInvalidUtxos(blockHeight: number) {
    this.#logger.info(`deleteInvalidUtxos to block ${blockHeight}`)
    const conn = this.getConn()
    const utxosSql = Q.sql.delete().from('utxos')
      .where('block_num > ?', blockHeight).toString()
    const utxosBackupSql = Q.sql.delete().from('utxos_backup')
      .where('block_num > ?', blockHeight).toString()
    await conn.query(utxosSql)
    await conn.query(utxosBackupSql)
  }

  async rollBackUtxoBackup(blockHeight: number) {
    this.#logger.info(`rollBackUtxoBackup to block ${blockHeight}`)
    await this.deleteInvalidUtxos(blockHeight)
    const conn = this.getConn()
    const sql = Q.sql.insert()
      .into('utxos')
      .with('moved_utxos',
        Q.sql.delete()
          .from('utxos_backup')
          .where('block_num < ?', blockHeight)
          .where('deleted_block_num > ?', blockHeight)
          .returning('*'))
      .fromQuery(['utxo_id', 'tx_hash', 'tx_index', 'receiver', 'amount', 'block_num'],
        Q.sql.select().from('moved_utxos')
          .field('utxo_id')
          .field('tx_hash')
          .field('tx_index')
          .field('receiver')
          .field('amount')
          .field('block_num'))
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async rollBackBlockHistory(blockHeight: number) {
    this.#logger.info(`rollBackBlockHistory to block ${blockHeight}`)
    const conn = this.getConn()
    const sql = Q.sql.delete()
      .from('blocks')
      .where('block_height > ?', blockHeight)
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async storeBlock(block: Block) {
    const conn = this.getConn()
    try {
      await conn.query(Q.BLOCK_INSERT.setFields(block.serialize()).toString())
    } catch (e) {
      this.#logger.debug('Error occur on block', block.serialize())
      throw e
    }
  }

  async storeBlocks(blocks: Array<Block>) {
    const conn = this.getConn()
    const blocksData = _.map(blocks, (block) => block.serialize())
    try {
      await conn.query(Q.BLOCK_INSERT.setFieldsRows(blocksData).toString())
    } catch (e) {
      this.#logger.debug('Error occur on block', blocks)
      throw e
    }
  }

  async storeTxAddresses(txId: string, addresses: Array<string>) {
    const conn = this.getConn()
    const dbFields = _.map(addresses, (address) => ({
      tx_hash: txId,
      address,
    }))
    const query = Q.TX_ADDRESSES_INSERT.setFieldsRows(dbFields).toString()
    try {
      await conn.query(query)
    } catch (e) {
      this.#logger.debug(e)
      this.#logger.debug(`Addresses for ${txId} already stored`)
    }
  }

  async storeOutputs(tx: {id: string, blockNum: number, outputs: []}) {
    const { id, outputs, blockNum } = tx
    const utxosData = _.map(outputs, (output, index) => utils.structUtxo(
      output.address, output.value, id, index, blockNum))
    await this.storeUtxos(utxosData)
  }

  async backupAndRemoveUtxos(utxoIds: Array<string>, deletedBlockNum: number) {
    const conn = this.getConn()
    const query = Q.sql.insert()
      .into('utxos_backup')
      .with('moved_utxos',
        Q.sql.delete()
          .from('utxos')
          .where('utxo_id IN ?', utxoIds)
          .returning('*'))
      .fromQuery([
        'utxo_id',
        'tx_hash',
        'tx_index',
        'receiver',
        'amount',
        'block_num',
        'deleted_block_num',
      ],
      Q.sql.select().from('moved_utxos')
        .field('utxo_id')
        .field('tx_hash')
        .field('tx_index')
        .field('receiver')
        .field('amount')
        .field('block_num')
        .field(`${deletedBlockNum}`, 'deleted_block_num'))
      .toString()
    this.#logger.debug(`backupAndRemoveUtxos ${query}`)
    const dbRes = await conn.query(query)
    return dbRes
  }

  async getUtxos(utxoIds: Array<string>): Promise<Array<{}>> {
    const conn = this.getConn()
    const query = Q.sql.select().from('utxos').where('utxo_id in ?', utxoIds).toString()
    const dbRes = await conn.query(query)
    return dbRes.rows.map((row) => ({
      address: row.receiver,
      amount: row.amount,
    }))
  }

  async genesisLoaded(): Promise<boolean> {
    /* Check whether utxo and blocks tables are empty.
    */
    const conn = this.getConn()
    const query = Q.GET_UTXOS_BLOCKS_COUNT
    const dbRes = await conn.query(query.toString())
    return !!Number.parseInt(dbRes.rows[0].cnt, 10)
  }

  async storeTx(tx: TxType) {
    const conn = this.getConn()
    const {
      inputs,
      outputs,
      id,
      blockNum,
      blockHash,
    } = tx
    const txStatus = tx.status || TX_STATUS.TX_SUCCESS_STATUS
    const inputUtxoIds = inputs.map((input) => (`${input.txId}${input.idx}`))
    const inputUtxos = await this.getUtxos(inputUtxoIds)

    assert.equal(inputUtxos.length, inputUtxoIds.length, 'Database corrupted.')
    if (txStatus === TX_STATUS.TX_SUCCESS_STATUS) {
      // if transaction is successful, store outputs to `utxos`
      // and remove transaction inputs from `utxos`
      await this.storeOutputs(tx)
      await this.backupAndRemoveUtxos(inputUtxoIds, blockNum)
    }

    const inputAddresses = _.map(inputUtxos, 'address')
    const outputAddresses = _.map(outputs, 'address')
    const inputAmmounts = _.map(inputUtxos, (item) => Number.parseInt(item.amount, 10))
    const outputAmmounts = _.map(outputs, (item) => Number.parseInt(item.value, 10))
    const txDbFields = {
      hash: id,
      inputs_address: inputAddresses,
      inputs_amount: inputAmmounts,
      outputs_address: outputAddresses,
      outputs_amount: outputAmmounts,
      block_num: blockNum,
      block_hash: blockHash,
      tx_state: txStatus,
      tx_body: tx.txBody,
      time: tx.txTime,
      last_update: tx.txTime,
    }
    const now = new Date().toUTCString()
    const query = Q.TX_INSERT.setFields(txDbFields)
      .onConflict('hash', {
        block_num: blockNum,
        block_hash: blockHash,
        time: tx.txTime,
        tx_state: txStatus,
        last_update: now,
      })
      .toString()
    this.#logger.debug('Insert TX:', query, inputAddresses, inputAmmounts)
    await conn.query(query)
    await this.storeTxAddresses(
      id,
      [...new Set([...inputAddresses, ...outputAddresses])],
    )
  }

  async storeBlockTxs(block: Block) {
    const { txs } = block
    /* eslint-disable no-plusplus */
    for (let index = 0; index < txs.length; index++) {
      /* eslint-disable no-await-in-loop */
      await this.storeTx(txs[index])
    }
  }
}


helpers.annotate(DB, [
  SERVICE_IDENTIFIER.DB_CONNECTION,
  SERVICE_IDENTIFIER.LOGGER,
])

export default DB
