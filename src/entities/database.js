// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { Database, DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import Block from '../blockchain'
import Q from '../db-queries'

class DB implements Database {
  #conn: any

  constructor(
    dbConn: DBConnection,
  ) {
    this.#conn = dbConn
  }

  getConn() {
    return this.#conn
  }

  async storeUtxos(utxos) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.UTXOS_INSERT.setFieldsRows(utxos).toString())
    return dbRes
  }

  async getBestBlockNum() {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BEST_BLOCK_NUM.toString())
    const blockNum = (dbRes.rowCount !== 0)
      ? Number(dbRes.rows[0].best_block_num)
      : -1 // no blocks processed, start to process from 0 block.
    return blockNum
  }

  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.BEST_BLOCK_UPDATE.set('best_block_num', bestBlockNum).toString())
    return dbRes
  }

  async getBlock(height: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BLOCK.where('block_height = ?', height).toString())
    if (dbRes.rowCount === 0) {
      return new Block({
        hash: 0, slot: 0, epoch: 0, height: 0,
      })
    }
    const block = new Block()
    return block
  }


  async storeBlock(block) {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.BLOCK_INSERT.setFields(block.serialize()).toString())
    return dbRes
  }

  async storeEpoch(epoch) {
    const conn = this.getConn()
    for (const block of epoch) {
      if (block.txs) {
        await this.storeBlock(block)
      }
    }
  }
}


helpers.annotate(DB, [SERVICE_IDENTIFIER.DB_CONNECTION])

export default DB
