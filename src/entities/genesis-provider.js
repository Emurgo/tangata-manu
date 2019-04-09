import { helpers } from 'inversify-vanillajs-helpers'

import {
  Scheduler,
  RawDataProvider,
  Database,
  Logger,
  RawDataParser,
  Genesis
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

class GenesisProvider implements Genesis {
  #dataProvider: any

  #db: any

  #logger: any

  #genesisHash: any

  constructor(
    dataProvider: RawDataProvider,
    db: Database,
    logger: Logger,
    genesis: string,
  ) {
    this.#dataProvider = dataProvider
    this.#db = db
    this.#logger = logger
    this.#genesisHash = genesis
  }

  async storeUtxos() {
    const genesisFile = await this.#dataProvider.getGenesis(this.#genesisHash)
    this.#logger.debug('Storing genesis utxos')
    for (var addr in genesisFile.nonAvvmBalances) {
      if (genesisFile.nonAvvmBalances.hasOwnProperty(addr)) {
        await this.#db.storeUtxoAddr(addr, genesisFile.nonAvvmBalances[addr])
      }
    }
  }
}

helpers.annotate(GenesisProvider,
  [
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.LOGGER,
    'genesis',
  ])

export default GenesisProvider
