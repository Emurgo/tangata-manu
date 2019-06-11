// @flow
import 'reflect-metadata'

import _ from 'lodash'
import restify from 'restify'
import config from 'config'
import { InversifyRestifyServer } from 'inversify-restify-utils'

import {
  Scheduler,
  Logger,
  Genesis,
  Database,
  RawDataProvider,
} from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'

import initIoC from './ioc_config'

const serverConfig = config.get('server')

const genesisLoadUtxos = async (container) => {
  const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  const genesis = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  const genesisFile = await dataProvider.getGenesis(genesis.genesisHash)
  const db = container.get<Database>(SERVICE_IDENTIFIER.DATABASE)
  const { protocolMagic } = genesisFile.protocolConsts

  if (!_.isEmpty(genesisFile.nonAvvmBalances)) {
    await db.storeUtxos(genesis.nonAvvmBalancesToUtxos(genesisFile.nonAvvmBalances))
  }
  if (!_.isEmpty(genesisFile.avvmDistr)) {
    await db.storeUtxos(genesis.avvmDistrToUtxos(genesisFile.avvmDistr,
      protocolMagic))
  }
}

const startServer = async () => {
  const container = await initIoC()
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const db = container.get<Database>(SERVICE_IDENTIFIER.DATABASE)

  const server = new InversifyRestifyServer(container)
  const app = server.build()

  const genesisLoaded = await db.genesisLoaded()
  if (!genesisLoaded) {
    logger.info('Start to upload genesis.')
    await genesisLoadUtxos(container)
    logger.info('Genesis data loaded.')
  }

  // start scheduler to check for updates from cardano-http-bridge
  const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
  scheduler.start()

  app.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', app.name, app.url)
  })
}

export default startServer
