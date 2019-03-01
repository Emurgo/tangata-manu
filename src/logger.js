import Logger from 'bunyan';

const consoleLogger = (appName, level = 'debug') => new Logger.createLogger({
  name: appName,
  level,
});

export default consoleLogger;
