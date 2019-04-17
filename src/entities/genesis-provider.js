import { helpers } from 'inversify-vanillajs-helpers'
import bs58 from 'bs58'

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

  avvmDistrToUtxos(avvmDistr, networkMagic) {
    this.#logger.debug('avvmDistrToUtxos called.')
    const utxos = []
    try {
    const CardanoCrypto = require('rust-cardano-crypto')
    } catch (e) {
      console.log('dddhellooo')
      const CardanoCrypto = require('rust-cardano-crypto')
    }
    this.#logger.debug('import passed')
    Object.entries(avvmDistr).forEach(entry => {
      const key = entry[0]
      const { result: { tx_id, address } } = CardanoCrypto.Redemption.redemptionPubKeyToAvvmTxOut(
        Buffer.from(key, 'base64'), networkMagic)
      const addressStr = bs58.encode(Buffer.from(address))
      utxos.push([tx_id, addressStr, entry[1]])
    })
    return utxos
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
