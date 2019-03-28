// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { Database, DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

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

  async storeBlock(block) {
    const conn = this.getConn()
    const txs = block.txs || []
    for (const tx of txs) {
      console.log('Storing transaction', tx)
      await
    }
  }

  async storeEpoch(epoch) {
    const conn = this.getConn()
    for (const block of epoch) {
      if (block.txs) {
        this.storeBlock(block)
      }
    }
  }
}


helpers.annotate(DB, [SERVICE_IDENTIFIER.DB_CONNECTION])

export default DB
