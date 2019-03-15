// @flow

import restify from 'restify'
import config from 'config'

import consoleLogger from './logger'
import createDb from './db'
import { CheckBlockchainTipJob } from './cron'
import { RawDataProvider } from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'
import container from './ioc_config'


const serverConfig = config.get('server')

const logger = consoleLogger(config.get('appName'), serverConfig.logLevel)

const dataProvider = container.get<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER)

const hello = (req, res, next) => {
  res.send(`hello ${req.params.name}`)
  next()
}

const server = restify.createServer()
server.get('/hello/:name', hello)

const startServer = async () => {
  const db = await createDb(config.get('db'))

  const checkBlockchainTipJob = new CheckBlockchainTipJob({
    cronTime: config.get('checkTipCronTime'),
    context: { db, logger, dataProvider },
  })
  checkBlockchainTipJob.start()
  server.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', server.name, server.url)
  })
}

export default startServer
