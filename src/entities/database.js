// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { Database, DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import Block from '../blockchain'

class DB implements Database {
  #conn: any

  UPSERT_TX_ADDESSES = `
  `

  Q = {
    get_best_block_num: `
      SELECT best_block_num FROM bestblock
    `,
    get_newest_block: `
      SELECT *
      FROM blocks
      ORDER BY
        height DESC,
      LIMIT 1
    `,
    get_block_by_height: `
      SELECT *
      FROM blocks
      WHERE block_height = $1
    `,
    update_best_block_num: `
      UPDATE bestblock
      SET best_block_num = $1
    `,
    upsert_block: `
      INSERT INTO blocks(block_hash, epoch, slot, block_height)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (block_hash)
      DO UPDATE SET
        epoch = EXCLUDED.epoch,
        slot = EXCLUDED.slot,
        block_height = EXCLUDED.block_height
    `,
  }

  constructor(
    dbConn: DBConnection,
  ) {
    this.#conn = dbConn
  }

  getConn() {
    return this.#conn
  }

  async getBestBlockNum() {
    const conn = this.getConn()
    const dbRes = await conn.query(this.Q.get_best_block_num)
    const blockNum = (dbRes.rowCount !== 0)
      ? Number(dbRes.rows[0].best_block_num)
      : -1 // no blocks processed, start to process from 0 block.
    return blockNum
  }

  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(this.Q.update_best_block_num, [bestBlockNum])
  }

  async getBlock(height: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(this.Q.get_block_by_height, [height])
    if (dbRes.rowCount === 0) {
      return new Block({
        hash: 0, slot: 0, epoch: 0, height: 0,
      })
    }
    const block = new Block()
    return block
  }


  async upsertTxAddresses(tx) {
    const txHash = tx.id
    const outAddrs = tx.outputs.map((value) => value.address)
    const dbRes = await conn.query(this.UPSERT_TX_ADDESSES)
  }

  async storeBlock(block) {
    const conn = this.getConn()
    const dbRes = await conn.query(this.Q.upsert_block, block.toArray())
  }
/*
  async getLastBlock() {
    const conn = this.getConn()
    const dbRes = await conn.query(this.Q.get_newest_block)
    if (dbRes.rowCount === 0) return new Block(0, 0, 0, 0)
    return dbRes
  }
*/
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
