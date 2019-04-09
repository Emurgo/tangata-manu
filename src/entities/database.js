// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { Database, DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class DB implements Database {
  #conn: any

  UPSERT_UTXOS_ADDR_BALANCE = `
    INSERT INTO utxos(receiver, amount) VALUES($1, $2)
  `

  UPSERT_TX_ADDESSES = `
  `

  Q = {
    get_best_block_num: `
      SELECT best_block_num FROM bestblock
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

  async storeUtxoAddr(addr, amount) {
    const conn = this.getConn()
    console.log('Insert', addr, amount)
    const dbRes = await conn.query(this.UPSERT_UTXOS_ADDR_BALANCE, [addr, parseInt(amount)])
    console.log('Insert', dbRes)
  }

  async upsertTxAddresses(tx) {
    const txHash = tx.id
    const outAddrs = tx.outputs.map((value) => value.address)
    const dbRes = await conn.query(this.UPSERT_TX_ADDESSES)
  }

  async storeBlock(block) {
    const conn = this.getConn()
    const txs = block.txs || []
    for (const tx of txs) {
      console.log('Storing transaction', tx)
      await this.upsertTxAddresses(tx)
    }
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
