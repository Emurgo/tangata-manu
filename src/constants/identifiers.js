// @flow

const SERVICE_IDENTIFIER = {
  RAW_DATA_PROVIDER: Symbol.for('RawDataProvider'),
  RAW_DATA_PARSER: Symbol.for('RawDataParser'),
  SCHEDULER: Symbol.for('Scheduler'),
  DATABASE: Symbol.for('Database'),
  DB_CONNECTION: Symbol.for('DBConnection'),
  LOGGER: Symbol.for('Logger'),
}

export default SERVICE_IDENTIFIER
