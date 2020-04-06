// @flow

import _ from 'lodash'
import restify from 'restify'
import { InversifyRestifyServer } from 'inversify-restify-utils'

import {
  Scheduler,
  Logger,
  Genesis,
  StorageProcessor,
  RawDataProvider,
  NetworkConfig,
  RewardsLoader,
} from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'

import initIoC from './ioc-config'
import { NETWORK_PROTOCOL, DATA_PROVIDER } from './entities/network-config'
import { YOROI_POSTGRES } from './ioc-config/storage-processor'

const loadGenesis = async (container) => {
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  if (networkConfig.networkProtocol() === NETWORK_PROTOCOL.SHELLEY) {
    const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
    await scheduler.processBlockById(networkConfig.genesisHash())
    logger.debug(`loadGenesis: ${NETWORK_PROTOCOL.SHELLEY}: loaded.`)
    return
  }
  if (networkConfig.dataProvider() === DATA_PROVIDER.CARDANO_EXPLORER) {
    const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
    await scheduler.processBlockById(networkConfig.genesisHash())
    logger.debug(`loadGenesis: ${NETWORK_PROTOCOL.BYRON}: loaded.`)
    return
  }
  const genesis = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  const genesisFile = await dataProvider.getGenesis(genesis.genesisHash)
  const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  const { protocolMagic } = genesisFile.protocolConsts

  const genesisLeaders = genesis.getGenesisLeaders(genesisFile.heavyDelegation || {})
  await storageProcessor.storeGenesisLeaders(genesisLeaders)

  const genesisUtxos = [
    ...genesis.nonAvvmBalancesToUtxos(genesisFile.nonAvvmBalances || []),
    ...genesis.avvmDistrToUtxos(genesisFile.avvmDistr || [], protocolMagic),
  ]
  if (!_.isEmpty(genesisUtxos)) {
    await storageProcessor.storeGenesisUtxos(genesisUtxos)
    logger.debug('loadGenesis: loaded')
  }
}

const startServer = async () => {
  const container = await initIoC()
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)
  const storageProcessor = container.get<StorageProcessor>(SERVICE_IDENTIFIER.STORAGE_PROCESSOR)
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)

  await storageProcessor.onLaunch()

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

  if (networkConfig.networkProtocol() === NETWORK_PROTOCOL.SHELLEY) {
    const gitHubLoader = container.get<Scheduler>(SERVICE_IDENTIFIER.GITHUB_LOADER)
    gitHubLoader.run()

    const memPoolChecker = container.get<Scheduler>(SERVICE_IDENTIFIER.MEMPOOL_CHECKER)
    memPoolChecker.run()

    const rewardsLoader = container.get<RewardsLoader>(SERVICE_IDENTIFIER.REWARDS_LOADER)
    rewardsLoader.run()
  }

  const storageName = container.getNamed('storageProcessor')
  const serverConfig = container.getNamed('server')
  if (storageName === YOROI_POSTGRES) {
    const server = new InversifyRestifyServer(container)
    const app = server.build()
    app.use(restify.plugins.bodyParser())
    app.listen(serverConfig.port, () => {
      logger.info('%s listening at %s', app.name, app.url)
    })
  }
}

export default startServer
