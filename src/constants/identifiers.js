// @flow

const SERVICE_IDENTIFIER = {
  NETWORK_CONFIG: Symbol.for('NetworkConfig'),
  RAW_DATA_PROVIDER: Symbol.for('RawDataProvider'),
  RAW_DATA_PARSER: Symbol.for('RawDataParser'),
  SCHEDULER: Symbol.for('Scheduler'),
  DATABASE: Symbol.for('Database'),
  DB_CONNECTION: Symbol.for('DBConnection'),
  LOGGER: Symbol.for('Logger'),
  GENESIS: Symbol.for('Genesis'),
  STORAGE_PROCESSOR: Symbol.for('StorageProcessor'),
  VALIDATOR: Symbol.for('Validator'),
}

export default SERVICE_IDENTIFIER
