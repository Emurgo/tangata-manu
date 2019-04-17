// @flow

import restify from 'restify'
import config from 'config'

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
const genesisHash = config.get('genesis')

const hello = (req, res, next) => {
  res.send(`hello ${req.params.name}`)
  next()
}

const server = restify.createServer()
server.get('/hello/:name', hello)

const genesisLoadUtxos = async (container) => {
  const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  const genesisFile = await dataProvider.getGenesis(genesisHash)
  const db = container.get<Database>(SERVICE_IDENTIFIER.DATABASE)
  const genesis = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  await db.storeUtxos(genesis.avvmDistrToUtxos(genesisFile.avvmDistr,
    genesisFile.protocolConsts.protocolMagic))
}

const startServer = async () => {
  const container = await initIoC()
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)

  if (process.argv[2] === 'load-genesis') {
    logger.info('Start to upload genesis.')
    await genesisLoadUtxos(container)
    logger.info('Genesis data loaded.')
    return
  }

  // start scheduler to check for updates from cardano-http-bridge
  const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
  scheduler.start()
  server.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', server.name, server.url)
  })
}

export default startServer
