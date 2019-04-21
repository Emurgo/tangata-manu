import { helpers } from 'inversify-vanillajs-helpers'
import { BLAKE2b } from 'bcrypto'
import bs58 from 'bs58'
import _ from 'lodash'
import * as Cardano from 'cardano-wallet'
import base64url from 'base64url'

import {
  RawDataProvider,
  Logger,
  Genesis,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

const generateUtxoHash = (address) => {
  const data = bs58.decode(address)
  return BLAKE2b.digest(data).toString('hex')
}

const structUtxo = (
  receiver,
  amount,
  utxoHash,
  txIndex = 0,
) => ({
  utxo_id: `${utxoHash}${txIndex}`,
  tx_hash: utxoHash,
  tx_index: txIndex,
  receiver,
  amount,
})

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

  nonAvvmBalancesToUtxos(nonAvvmBalances) {
    this.#logger.debug('nonAvvmBalances to utxos')
    return _.map(nonAvvmBalances, (amount, receiver) => {
      const utxoHash = generateUtxoHash(receiver)
      return structUtxo(receiver, amount, utxoHash)
    })
  }

  avvmDistrToUtxos(avvmDistr, protocolMagic) {
    this.#logger.debug('avvmDistrToUtxos called.')
    const settings = Cardano.BlockchainSettings.from_json({
      protocol_magic: protocolMagic,
    })
    return _.map(avvmDistr, (amount, publicRedeemKey) => {
      const prk = Cardano.PublicRedeemKey.from_hex(
        base64url.decode(publicRedeemKey, 'hex'))
      const receiver = prk.address(settings).to_base58()
      const utxoHash = generateUtxoHash(receiver)
      return structUtxo(receiver, amount, utxoHash)
    })
  }
}

helpers.annotate(GenesisProvider,
  [
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
    SERVICE_IDENTIFIER.LOGGER,
    'genesis',
  ])

export default GenesisProvider
