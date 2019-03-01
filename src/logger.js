import Logger from 'bunyan'

/* eslint new-cap: ["error", { "newIsCap": false }] */
const consoleLogger = (appName, level = 'debug') => new Logger.createLogger({
  name: appName,
  level,
})

export default consoleLogger
