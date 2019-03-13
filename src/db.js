// @flow

import pg from 'pg'
import type { PgPoolConfig, Pool } from 'pg'

const createDb = async (dbSettings: PgPoolConfig): Pool => (new pg.Pool(dbSettings))

export default createDb
