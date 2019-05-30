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

  async storeUtxos(utxos: [{}]) {
    const conn = this.getConn()
    this.#logger.debug('storeUtxos', utxos)
    const dbRes = await conn.query(
      Q.UTXOS_INSERT.setFieldsRows(utxos).toString())
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


  async rollBackUtxoBackup(blockHeight: number) {
    const conn = this.getConn()
    const sql = Q.sql.insert()
      .into('utxos')
      .with('moved_utxos',
        Q.sql.delete()
          .from('utxos_backup')
          .where('block_num > ?', blockHeight)
          .returning('*'))
      .fromQuery(['utxo_id', 'tx_hash', 'tx_index', 'receiver', 'amount', 'block_num'],
        Q.sql.select().from('moved_utxos'))
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async rollBackBlockHistory(blockHeight: number) {
    const conn = this.getConn()
    const sql = Q.sql.delete()
      .from('blocks')
      .where('block_height > ?', blockHeight)
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async decreaseBestBlockNum(blocksCount: number) {
    const conn = this.getConn()
    const sql = Q.BEST_BLOCK_UPDATE.set('best_block_num', `best_block_num - ${blocksCount}`,
      { dontQuote: true }).toString()
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

  async storeOutputs(tx: {id: string, outputs: []}) {
    const { id, outputs } = tx
    const utxosData = _.map(outputs, (output, index) => utils.structUtxo(
      output.address, output.value, id, index))
    await this.storeUtxos(utxosData)
  }

  async deleteUtxos(utxoIds: Array<string>) {
    const conn = this.getConn()
    const query = Q.sql.delete().from('utxos')
      .where('utxo_id IN ?', utxoIds).toString()
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

  async storeTx(block: Block, tx: TxType) {
    const conn = this.getConn()
    const { inputs, outputs, id } = tx

    await this.storeOutputs(tx)
    const inputUtxoIds = inputs.map((input) => (`${input.txId}${input.idx}`))
    const inputUtxos = await this.getUtxos(inputUtxoIds)

    assert.equal(inputUtxos.length, inputUtxoIds.length, 'Database corrupted.')

    await this.deleteUtxos(inputUtxoIds)
    const inputAddresses = _.map(inputUtxos, 'address')
    const outputAddresses = _.map(outputs, 'address')
    const inputAmmounts = _.map(inputUtxos, (item) => Number.parseInt(item.amount, 10))
    const outputAmmounts = _.map(outputs, (item) => Number.parseInt(item.value, 10))
    const query = Q.TX_INSERT.setFields({
      hash: id,
      inputs_address: inputAddresses,
      inputs_amount: inputAmmounts,
      outputs_address: outputAddresses,
      outputs_amount: outputAmmounts,
      block_num: block.height,
      block_hash: block.hash,
      tx_state: TX_STATUS.TX_SUCCESS_STATUS,
      tx_body: tx.txBody,
      time: tx.txTime,
      last_update: tx.txTime,
    }).toString()
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
      await this.storeTx(block, txs[index])
    }
  }
}


helpers.annotate(DB, [
  SERVICE_IDENTIFIER.DB_CONNECTION,
  SERVICE_IDENTIFIER.LOGGER,
])

export default DB
