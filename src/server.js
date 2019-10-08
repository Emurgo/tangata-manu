// @flow
import _ from 'lodash'
import restify from 'restify'
import config from 'config'
import { InversifyRestifyServer } from 'inversify-restify-utils'

import {
  Scheduler,
  Logger,
  Genesis,
  StorageProcessor,
  RawDataProvider,
} from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'

import initIoC from './ioc_config'

const serverConfig = config.get('server')

const genesisLoadUtxos = async (container) => {
  const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  const genesis = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  const genesisFile = await dataProvider.getGenesis(genesis.genesisHash)
  const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  const { protocolMagic } = genesisFile.protocolConsts

  const genesisUtxos = [
    ...genesis.nonAvvmBalancesToUtxos(genesisFile.nonAvvmBalances || []),
    ...genesis.avvmDistrToUtxos(genesisFile.avvmDistr || [], protocolMagic),
  ]
  await storageProcessor.storeGenesisUtxos(genesisUtxos)
}

const startServer = async () => {
  const container = await initIoC()
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)

  const server = new InversifyRestifyServer(container)
  const app = server.build()

  const genesisLoaded = await storageProcessor.genesisLoaded()
  if (!genesisLoaded) {
    logger.info('Start to upload genesis.')
    await genesisLoadUtxos(container)
    logger.info('Genesis data loaded.')
  }

  // start scheduler to check for updates from cardano-http-bridge
  const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
  scheduler.startAsync().then(res => {
    logger.error(`Scheduler.startAsync exited successfully. This is unexpected to happen by itself! (result=${res})`)
    process.exit(1)
  }, err => {
    logger.error('Scheduler.startAsync exited with an error:', err)
    process.exit(1)
  })

  app.use(restify.plugins.bodyParser())
  app.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', app.name, app.url)
  })
}

export default startServer
