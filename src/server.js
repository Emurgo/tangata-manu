// @flow

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
import type { GenesisLeaderType } from "./interfaces/storage-processor";

const serverConfig = config.get('server')

const loadGenesis = async (container) => {
  // TODO: fix this, temporary commented out to avoid loading genesis data for Jormungandr as it was causing a crash
  // const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  // const genesis = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  // const genesisFile = await dataProvider.getGenesis(genesis.genesisHash)
  // const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  // const { protocolMagic } = genesisFile.protocolConsts

  // const genesisLeaders: Array<GenesisLeaderType> = genesis.getGenesisLeaders(genesisFile.heavyDelegation || {})
  // await storageProcessor.storeGenesisLeaders(genesisLeaders)

  // const genesisUtxos = [
  //   ...genesis.nonAvvmBalancesToUtxos(genesisFile.nonAvvmBalances || []),
  //   ...genesis.avvmDistrToUtxos(genesisFile.avvmDistr || [], protocolMagic),
  // ]
  // const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  // logger.debug('does it reach here?')
  // await storageProcessor.storeGenesisUtxos(genesisUtxos)
}

const startServer = async () => {
  const container = await initIoC()
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)

  await storageProcessor.onLaunch()

  const server = new InversifyRestifyServer(container)
  const app = server.build()

  const genesisLoaded = await storageProcessor.genesisLoaded()
  if (!genesisLoaded) {
    logger.info('Start to upload genesis.')
    await loadGenesis(container)
    logger.info('Genesis data loaded.')
  }

  // start scheduler to check for updates from cardano-http-bridge
  const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
  scheduler.startAsync().then(async res => {
    logger.error(`Scheduler.startAsync exited successfully. This is unexpected to happen by itself! (result=${res})`)
    await new Promise(resolve => setTimeout(resolve, 5000))
    process.exit(1)
  }, async err => {
    logger.error('Scheduler.startAsync exited with an error:', err)
    await new Promise(resolve => setTimeout(resolve, 5000))
    process.exit(1)
  })

  app.use(restify.plugins.bodyParser())
  app.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', app.name, app.url)
  })
}

export default startServer
