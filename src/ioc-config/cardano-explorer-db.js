// @flow

import { AsyncContainerModule, interfaces } from 'inversify'
import pg from 'pg'
import type { PgPoolConfig, Pool } from 'pg'
import config from 'config'


import { DBConnection } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

const createDb = async (dbSettings: PgPoolConfig): Promise<Pool> => (new pg.Pool(dbSettings))

const cardanoExplorerDbModule = new AsyncContainerModule(async (bind: interfaces.Bind) => {
  const dbConn = await createDb(config.get('cardanoExplorerDb'))
  bind<DBConnection>(SERVICE_IDENTIFIER.DB_CONNECTION).toConstantValue(dbConn).whenTargetNamed('cardanoExplorerDb')
})

export default cardanoExplorerDbModule
