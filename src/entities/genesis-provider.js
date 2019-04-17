import { helpers } from 'inversify-vanillajs-helpers'
import { BLAKE2b } from 'bcrypto'
import bs58 from 'bs58'
import _ from 'lodash'

import {
  RawDataProvider,
  Logger,
  Genesis,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

const generateUtxoId = (address) => {
  const data = bs58.decode(address)
  return BLAKE2b.digest(data).toString('hex')
}

class GenesisProvider implements Genesis {
  #dataProvider: any

  #logger: any

  #genesisHash: any

  constructor(
    dataProvider: RawDataProvider,
    logger: Logger,
    genesis: string,
  ) {
    this.#dataProvider = dataProvider
    this.#logger = logger
    this.#genesisHash = genesis
  }

  static nonAvvmBalancesToUtxos(nonAvvmBalances) {
    return _.map(nonAvvmBalances, (amount, receiver) => {
      const utxoId = generateUtxoId(receiver)
      return {
        utxo_id: utxoId,
        tx_hash: utxoId,
        tx_index: 0,
        receiver,
        amount,
      }
    })
  }

  avvmDistrToUtxos(avvmDistr, networkMagic) {
    this.#logger.debug('avvmDistrToUtxos called.')
    const utxos = []
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
