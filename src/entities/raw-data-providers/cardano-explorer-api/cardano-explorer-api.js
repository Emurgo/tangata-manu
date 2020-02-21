// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import type { Logger } from 'bunyan'

import type {
  RawDataProvider,
  NetworkConfig,
  DBConnection,
} from '../../../interfaces'
import type { NodeStatusType } from '../../../interfaces/raw-data-provider'
import SERVICE_IDENTIFIER from '../../../constants/identifiers'
import { GENESIS_PARENT } from '../../../blockchain/shelley/block'

import {
  GET_BEST_BLOCK_NUM,
} from './db-queries'

class CardanoExplorerApi implements RawDataProvider {
  logger: Logger

  conn: DBConnection

  networkConfig: NetworkConfig

  constructor(
    networkConfig: NetworkConfig,
    logger: Logger,
    conn: DBConnection,
  ) {
    this.logger = logger
    this.networkConfig = networkConfig
    this.conn = conn
  }

  async getGenesis(hash: string): Promise<Object> {
    this.logger.debug(`getGenesis: ${hash}`)
    // const resp = await this.getJson(`/genesis/${hash}`)
    // const { data } = resp
    // return data
    // not supported right now in jormungandr, so we're hardcoding this for now
    // as something empty to not cause any issues.
    return {
      protocolConsts: {
        protocolMagic: null,
      },
      nonAvvmBalances: [],
      avvmDistr: [],
    }
  }

  async getStatus(): Promise<NodeStatusType> {
    const resp = await this.conn.query(GET_BEST_BLOCK_NUM)
    this.logger.debug('[cardano-explorer-api].getStatus', resp)
    if (resp.rows.length === 1) {
      const {
        epoch, slotNo, height, hash,
      } = resp.rows[0]
      const tipStatus = {
        height,
        hash,
        slot: [epoch, slotNo],
      }
      return {
        packedEpochs: epoch,
        tip: {
          local: tipStatus,
          remote: tipStatus,
        },
      }
    }

    const emptyTip = {
      height: 0,
      slot: [0, 0],
      hash: GENESIS_PARENT,
    }
    return {
      packedEpochs: 0,
      tip: {
        local: emptyTip,
        remote: emptyTip,
      },
    }
  }
}

helpers.annotate(CardanoExplorerApi, [
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
  SERVICE_IDENTIFIER.LOGGER,
  { type: SERVICE_IDENTIFIER.DB_CONNECTION, named: 'cardanoExplorerDbConnection' },
])

export default CardanoExplorerApi
