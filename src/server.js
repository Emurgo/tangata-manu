// @flow

import restify from 'restify'
import config from 'config'
import base64url from 'base64url'

import { Scheduler, Logger, Genesis } from './interfaces'
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

const startServer = async () => {
  const container = await initIoC()

  const scheduler = container.get<Scheduler>(SERVICE_IDENTIFIER.SCHEDULER)
  const logger = container.get<Logger>(SERVICE_IDENTIFIER.LOGGER)

  // Store genesis utxos
  //const dataProvider = container.get<Logger>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)
  //const genesisFile = await dataProvider.getGenesis(genesisHash)
  //const genesisProvider = container.get<Genesis>(SERVICE_IDENTIFIER.GENESIS)
  //await genesisProvider.storeUtxos()
  //storeGenesisData(genesisFile)

  scheduler.start()
  server.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', server.name, server.url)
  })
}

export default startServer
