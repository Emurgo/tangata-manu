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
import { ByronBlock } from '../../../blockchain/byron'

import {
  sql,
  GET_BEST_BLOCK_NUM,
} from './db-queries'
import { Block } from 'js-chain-libs'

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

  async getBlockByHeight(height: number): Promise<ByronBlock> {
    this.logger.debug('cardano-explorer-api:getBlockByHeight: ', height)
    // get block data
    const blockSql = sql.select().from('"Block"')
      .where('number = ?', height)
      .limit(1)
      .toString()
    const txs = []
    const blockData = (await this.conn.query(blockSql)).rows[0]
    const blockId = blockData.id.toString('hex')
    this.logger.debug('blockData', blockData)
    // get transactions for block
    if (blockData.transactionsCount > 0) {
      const txsSql = sql.select().from('"Transaction"')
        .where('"blockId" = ?', `\\x${blockId}`).toString()
      const txsData = (await this.conn.query(txsSql)).rows
      const txsIds = txsData.map(tx => `\\x${tx.id.toString('hex')}`)
      // get transaction inputsf
      const txInputsSql = sql.select().from('"TransactionInput"')
        .where('"txId" IN ?', txsIds).toString()
      const txInputsData = (await this.conn.query(txInputsSql)).rows
      // get transaction outputs
      const txOutputsSql = sql.select().from('"TransactionOutput"')
        .where('"txId" IN ?', txsIds).toString()
      const txOutputsData = (await this.conn.query(txOutputsSql)).rows
      for (const txData of txsData) {
        txs.push({
          inputs: txInputsData
            .filter((inp) => inp.txId.toString('hex') === txData.id.toString('hex'))
            .map((inp) => ({
              type: 'utxo',
              txId: inp.sourceTxId.toString('hex'),
              idx: inp.sourceTxIndex,
            })),
          outputs: txOutputsData
            .filter((out) => out.txId.toString('hex') === txData.id.toString('hex'))
            .map((out) => ({
              type: 'utxo',
              address: out.address,
              value: out.value,
            })),
          id: txData.id.toString('hex'),
          blockNum: height,
          blockHash: blockData.id,
          status: 'Successfull',
          txTime: txData.includedAt.toString(),
          txBody: '',
          txOrdinal: 0,
        })
      }
      console.log('txsData', txInputsData, txOutputsData)
    }

    return new ByronBlock({
      hash: blockId,
      epoch: blockData.epochNo,
      slot: blockData.slotNo,
      size: blockData.size,
      height,
      txs,
      isEBB: false,
      prevHash: blockData.previousBlockId.toString('hex'),
      time: blockData.createdAt,
      lead: blockData.createdBy,
    })
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
