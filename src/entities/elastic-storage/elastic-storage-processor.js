// @flow
import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'
import { Client } from '@elastic/elasticsearch'

import type { StorageProcessor, Logger, NetworkConfig } from '../../interfaces'
import type { Block } from '../../blockchain'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

import type { UtxoType } from './utxo-data'

import BlockData from './block-data'
import UtxoData from './utxo-data'
import TxData from './tx-data'

const INDEX_SLOT = 'seiza.slot'
const INDEX_TX = 'seiza.tx'
const INDEX_TXIO = 'seiza.txio'

class ElasticStorageProcessor implements StorageProcessor {
  logger: Logger

  client: Client

  networkStartTime: number

  constructor(
    logger: Logger,
    elasticNode: string,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.client = new Client({ node: elasticNode })
    this.networkStartTime = networkConfig.startTime()
  }

  async genesisLoaded() {
    const esResponse = await this.client.cat.count({
      index: INDEX_TX,
      format: 'json',
    })
    this.logger.debug('Check elastic whether genesis loaded...', esResponse)
    return Number(esResponse.body[0].count) > 0
  }

  async storeGenesisUtxos(utxos: Array<UtxoType>) {
    this.logger.debug('storeGenesisUtxos: store utxos to "txio" index and create fake txs in "tx" index')
    // TODO: create tx and txio objects in one iteration.
    const utxosObjs = utxos.map((utxo) => new UtxoData(utxo))
    // upload utxos to "txio" index
    const txioBody = utxosObjs.flatMap(utxoData => [
      {
        index: {
          _index: INDEX_TXIO,
          _id: utxoData.getId(),
        },
      },
      utxoData.toPlainObject(),
    ])
    const txioResp = await this.client.bulk({
      refresh: true,
      body: txioBody,
    })
    this.logger.debug('storeGenesisUtxos:txio', txioResp)

    // upload utxos to "tx" index
    const txBody = utxosObjs.flatMap(utxoData => [
      {
        index: {
          _index: INDEX_TX,
          _id: utxoData.getId(),
        },
      },
      TxData.fromGenesisUtxo(utxoData, this.networkStartTime).toPlainObject(),
    ])
    const txResp = await this.client.bulk({
      refresh: true,
      body: txBody,
    })
    this.logger.debug('storeGenesisUtxos:tx', txResp)
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    const emptyDb = { height: 0, epoch: 0 }
    const esResponse = await this.client.search({
      index: INDEX_SLOT,
      body: {
        sort: [{ epoch: { order: 'desc' } }, { slot: { order: 'desc' } }],
        size: 1,
      },
    })
    const { hits } = esResponse.body.hits
    if (_.isEmpty(hits)) {
      return emptyDb
    }
    // eslint-disable-next-line no-underscore-dangle
    const source = hits[0]._source
    this.logger.debug('getBestBlockNum', source.height)
    return source
  }

  async storeBlockData(block: Block, cache: any = []) {
    this.logger.debug('storeBlockData', block)
    const body = cache.flatMap(blk => [
      {
        index: {
          _index: INDEX_SLOT,
          _id: blk.hash,
        },
      },
      (new BlockData(blk)).toPlainObject(),
    ])
    const resp = await this.client.bulk({
      refresh: true,
      body,
    })
    this.logger.debug('storeBlockData', resp)
  }
}

helpers.annotate(ElasticStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'elasticNode',
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])


export default ElasticStorageProcessor
