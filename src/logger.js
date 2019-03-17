// @flow
import { ContainerModule, interfaces } from 'inversify'

import BLogger from 'bunyan'
import config from 'config'

import { Logger } from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'

/* eslint new-cap: ["error", { "newIsCap": false }] */
const consoleLogger = (appName, level = 'debug') => new BLogger.createLogger({
  name: appName,
  level,
})

const loggerModule = new ContainerModule(async (bind: interfaces.Bind) => {
  const logger = consoleLogger(config.get('appName'), config.get('server').logLevel)
  bind<Logger>(SERVICE_IDENTIFIER.LOGGER).toConstantValue(logger)
})

export default loggerModule
