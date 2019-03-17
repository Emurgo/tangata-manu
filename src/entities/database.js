// @flow
import { helpers } from 'inversify-vanillajs-helpers'

import { Database, DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class DB implements Database {
  conn: any

  constructor(
    dbConn: DBConnection,
  ) {
    this.conn = dbConn
  }

  getConn() {
    return this.conn
  }
}


helpers.annotate(DB, [SERVICE_IDENTIFIER.DB_CONNECTION])

export default DB
