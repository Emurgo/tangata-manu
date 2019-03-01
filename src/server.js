// @flow

import restify from 'restify'
import config from 'config'

import consoleLogger from './logger'
import createDb from './db'
import { CheckBlockchainTipJob } from './cron'
import CardanoBridgeApi from './cardano-bridge-api'


const serverConfig = config.get('server')
const cardanoBridgeConfig = config.get('cardanoBridge')

const logger = consoleLogger(config.get('appName'), serverConfig.logLevel)
const api = new CardanoBridgeApi(cardanoBridgeConfig.baseUrl,
  cardanoBridgeConfig.template)

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
    context: { db, logger, api },
  })
  checkBlockchainTipJob.start()
  server.listen(serverConfig.port, () => {
    logger.info('%s listening at %s', server.name, server.url)
  })
}

export default startServer
