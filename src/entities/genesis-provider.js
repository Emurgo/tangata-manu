// @flow

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

import { utils } from '../blockchain/common'
import type { NetworkConfig } from '../interfaces'
import type { GenesisLeaderType } from '../interfaces/storage-processor'

const generateUtxoHash = (address) => {
  const data = bs58.decode(address)
  return BLAKE2b.digest(data).toString('hex')
}


class GenesisProvider implements Genesis {
  #dataProvider: any

  #logger: any

  genesisHash: string

  constructor(
    logger: Logger,
    networkConfig: NetworkConfig,
    dataProvider: RawDataProvider,
  ) {
    this.genesisHash = networkConfig.genesisHash()
    this.#dataProvider = dataProvider
    this.#logger = logger
  }

  getGenesisLeaders(heavyDelegation: { [string]: {} }): Array<GenesisLeaderType> {
    this.#logger.debug('getGenesisLeaders')
    const res: Array<GenesisLeaderType> = Object.entries(heavyDelegation).map(
      ([heavyDelegationId, { issuerPk }], idx) => {
        const ordinal = idx + 1
        const lead: GenesisLeaderType = {
          slotLeaderPk: Buffer.from(issuerPk, 'base64').toString('hex'),
          leadId: heavyDelegationId,
          name: `Bootstrap era pool #${ordinal}`,
          description: `Pool ${ordinal} used before decentralization`,
          ordinal,
        }
        return lead
      })
    return res
  }

  nonAvvmBalancesToUtxos(nonAvvmBalances: []) {
    this.#logger.debug('nonAvvmBalances to utxos')
    return _.map(nonAvvmBalances, (amount, receiver) => {
      const utxoHash = generateUtxoHash(receiver)
      return utils.structUtxo(receiver, Number(amount), utxoHash)
    })
  }

  avvmDistrToUtxos(avvmDistr: [], protocolMagic: number) {
    this.#logger.debug('avvmDistrToUtxos called.')
    if (avvmDistr.length == 0) {
      this.#logger.debug('avvmDistr.length is empty')
      return []
    }
    const settings = Cardano.BlockchainSettings.from_json({
      protocol_magic: protocolMagic,
    })
    return _.map(avvmDistr, (amount, publicRedeemKey) => {
      const prk = Cardano.PublicRedeemKey.from_hex(
        base64url.decode(publicRedeemKey, 'hex'))
      const receiver = prk.address(settings).to_base58()
      const utxoHash = generateUtxoHash(receiver)
      return utils.structUtxo(receiver, Number(amount), utxoHash)
    })
  }
}

helpers.annotate(GenesisProvider,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
    SERVICE_IDENTIFIER.RAW_DATA_PROVIDER,
  ])

export default GenesisProvider
