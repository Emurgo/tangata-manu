// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'

import { helpers } from 'inversify-vanillajs-helpers'
import { Client } from '@elastic/elasticsearch'

import type { StorageProcessor, NetworkConfig } from '../../interfaces'
import type { Block } from '../../blockchain'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

import type { UtxoType } from './utxo-data'

import BlockData from './block-data'
import UtxoData, { getTxInputUtxoId } from './utxo-data'
import TxData from './tx-data'

const INDEX_SLOT = 'slot'
const INDEX_TX = 'tx'
const INDEX_TXIO = 'txio'
const INDEX_CHUNK = 'chunk'
const INDEX_POINTER_ALL = '*'


const ELASTIC_TEMPLATES = {
  seiza_tx: {
    index_patterns: ['seiza*.tx'],
    mappings: {
      properties: {
        addresses: {
          type: 'nested',
        },
      },
    },
  },
}

type ElasticConfigType = {
  node: string,
  indexPrefix: string,
}

type ChunkBodyType = {
  chunk: number,
  blocks: number,
  txs: number,
  txios: number,
}


type FormatBulkUploadOptionsType = {
  index: string,
  getId?: (any) => string,
  getData: (any) => {},
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const formatBulkUploadBody = (objs: any,
  options: FormatBulkUploadOptionsType) => objs.flatMap(o => [
  {
    index: {
      _index: options.index,
      _id: options.getId !== undefined ? options.getId(o) : o.getId(),
    },
  },
  options.getData(o),
])

const getBlocksForSlotIdx = (blocks: Array<Block>, storedUTxOs: Array<UtxoType>, addressStates: { [string]: any }) => {
  const blocksData = blocks.map(block => (new BlockData(block, storedUTxOs, addressStates)).toPlainObject())
  return blocksData
}

const getBlockUtxos = (block: Block) => {
  const blockUtxos = block.getTxs().flatMap(tx => tx.outputs.map(
    (out, idx) => (new UtxoData({
      tx_hash: tx.id,
      tx_index: idx,
      block_hash: block.hash,
      receiver: out.address,
      amount: out.value,
    })).toPlainObject(),
  ))
  return blockUtxos
}


class ElasticStorageProcessor implements StorageProcessor {
  logger: Logger

  client: Client

  networkStartTime: number

  elasticConfig: ElasticConfigType

  constructor(
    logger: Logger,
    elasticConfig: ElasticConfigType,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.elasticConfig = elasticConfig
    this.client = new Client({ node: elasticConfig.node })
    this.networkStartTime = networkConfig.startTime()
  }

  indexFor(name: string) {
    // TOFO: memoize
    return `${this.elasticConfig.indexPrefix}.${name}`
  }

  async rollbackTo(height: number) {
    await sleep(10000)
    const latestStableChunk = await this.getLatestStableChunk()
    return this.deleteChunksAfter(Math.min(latestStableChunk, height))
  }

  async esSearch(params: {}) {
    const resp = await this.client.search(params)
    const { hits } = resp.body
    return hits
  }

  async getLatestStableChunk() {
    const index = this.indexFor(INDEX_CHUNK)
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return 0
    }
    const hits = await this.esSearch({
      index,
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: {
        sort: [{ chunk: { order: 'desc' } }],
        size: 1,
      },
    })
    this.logger.debug('getLatestStableChunk', hits)
    return hits.total.value > 0 ? hits.hits[0]._source.chunk : 0
  }

  async deleteChunksAfter(chunk: number) {
    const resp = await this.client.deleteByQuery({
      index: this.indexFor(INDEX_POINTER_ALL),
      body: {
        query: { range: { _chunk: { gt: chunk } } },
      },
    })
    const deletedDocs = resp.body.total
    this.logger.info(`deleteChunksAfter(${chunk}), total deleted:${deletedDocs}`, resp)
  }

  async ensureElasticTemplates() {
    for (const [name, tmpl] of _.toPairs(ELASTIC_TEMPLATES)) {
      // eslint-disable-next-line no-await-in-loop
      const tmplExists = await this.client.indices.existsTemplate({
        name,
      })
      if (!tmplExists.body) {
        // eslint-disable-next-line no-await-in-loop
        const resp = await this.client.indices.putTemplate({
          name,
          body: tmpl,
          include_type_name: false,
        })
        this.logger.debug(`Put template ${name}`, resp)
      }
    }
  }

  async storeChunk(chunkBody: ChunkBodyType) {
    return this.client.index({
      index: this.indexFor(INDEX_CHUNK),
      id: chunkBody.chunk,
      body: chunkBody,
    })
  }

  async removeUnsealed() {
    const lastChunk = await this.getLatestStableChunk()
    this.logger.debug('Remove unsealed blocks after', lastChunk)
    if (lastChunk > 0) {
      await this.deleteChunksAfter(lastChunk)
    }
  }

  async onLaunch() {
    await this.ensureElasticTemplates()
    await this.removeUnsealed()
    this.logger.debug('Launched ElasticStorageProcessor storage processor.')
  }

  async genesisLoaded() {
    const index = this.indexFor(INDEX_TX)
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return false
    }
    const esResponse = await this.client.cat.count({
      index,
      format: 'json',
    })
    this.logger.debug('Check elastic whether genesis loaded...', esResponse)
    return Number(esResponse.body[0].count) > 0
  }

  async storeGenesisUtxos(utxos: Array<UtxoType>) {
    // TODO: check bulk upload response
    this.logger.debug('storeGenesisUtxos: store utxos to "txio" index and create fake txs in "tx" index')
    const chunk = 1

    const utxosObjs = utxos.map((utxo) => new UtxoData(utxo))
    const txioBody = formatBulkUploadBody(utxosObjs, {
      index: this.indexFor(INDEX_TXIO),
      getData: (o) => ({
        ...o.toPlainObject(),
        _chunk: chunk,
      }),
    })
    const txBody = formatBulkUploadBody(utxosObjs, {
      index: this.indexFor(INDEX_TX),
      getId: (o) => o.getHash(),
      getData: (o) => ({
        ...TxData.fromGenesisUtxo(o.utxo, this.networkStartTime).toPlainObject(),
        _chunk: chunk,
      }),
    })

    const resp = await this.bulkUpload([...txioBody, ...txBody])
    await this.storeChunk({
      chunk,
      blocks: 0,
      txs: utxosObjs.length,
      txios: utxosObjs.length,
    })
    this.logger.debug('storeGenesisUtxos:tx', resp)
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    const emptyDb = { height: 0, epoch: 0 }
    const index = this.indexFor(INDEX_SLOT)
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return emptyDb
    }
    const esResponse = await this.client.search({
      index,
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

  async bulkUpload(body: Array<mixed>) {
    const resp = await this.client.bulk({
      refresh: 'true',
      body,
    })
    this.logger.debug('bulkUpload', resp)
    return resp
  }

  async storeBlocksData(blocks: Array<Block>) {
    const storedUTxOs = []
    const utxosToStore = []
    const txInputsIds = []
    const blockTxs = []
    const chunk = (await this.getLatestStableChunk()) + 1
    for (const block of blocks) {
      const txs = block.getTxs()
      if (txs.length > 0) {
        txInputsIds.push(..._.flatten(_.map(txs, 'inputs')).map(getTxInputUtxoId))
        this.logger.debug('storeBlocksData', block)
        utxosToStore.push(...getBlockUtxos(block))
        blockTxs.push(...txs)
      }
    }
    if (!_.isEmpty(txInputsIds)) {
      const txInputs = await this.client.mget({
        index: this.indexFor(INDEX_TXIO),
        body: {
          ids: txInputsIds,
        },
      })
      storedUTxOs.push(..._.map(txInputs.body.docs.filter(d => d.found), '_source'))
    }

    // Inputs are resolved into UTxOs that are being spent
    // Plus all the UTxOs produced in the processed blocks
    let utxosForInputsAndOutputs = [...storedUTxOs, ...utxosToStore];

    // Filter all the unique addresses being used in either inputs or outputs
    const uniqueBlockAddresses = _.uniq(utxosForInputsAndOutputs.map(({ address }) => address));
    const addressStates: { [string]: any } = await this.getAddressStates(uniqueBlockAddresses);
    const blocksData = getBlocksForSlotIdx(blocks, utxosForInputsAndOutputs, addressStates)

    const blocksBody = formatBulkUploadBody(blocksData, {
      index: this.indexFor(INDEX_SLOT),
      getId: (o) => o.hash,
      getData: o => ({
        ...o,
        _chunk: chunk,
      }),
    })
    const utxosBody = formatBulkUploadBody(utxosToStore, {
      index: this.indexFor(INDEX_TXIO),
      getId: (o) => o.id,
      getData: (o) => ({
        ...o,
        _chunk: chunk,
      }),
    })
    const txsBody = formatBulkUploadBody(blocksData.flatMap(b => b.tx), {
      index: this.indexFor(INDEX_TX),
      getId: (o) => o.hash,
      getData: (o) => o,
    })
    await this.bulkUpload([...utxosBody, ...blocksBody, ...txsBody])

    await sleep(5000)
    await this.storeChunk({
      chunk,
      blocks: blocks.length,
      txs: blockTxs.length,
      txios: utxosToStore.length,
    })
    await sleep(5000)
  }

  async getAddressStates(uniqueBlockAddresses): { [string]: any } {
    const res = await this.client.search({
      index: this.indexFor(INDEX_TX),
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: createAddressStateQuery(uniqueBlockAddresses)
    });
    const { buckets } = res['body']['aggregations']['tmp_nest']['tmp_filter']['tmp_group_by'];
    const states = buckets.map(buck => {
      const source = buck['tmp_select_latest']['hits']['hits']['_source']
      return { ...source, balance_after_this_tx: Number(source['balance_after_this_tx']['full']) }
    });
    return _.keyBy(states, 'address');
  }
}

function createAddressStateQuery(uniqueBlockAddresses) {
  return {
    size: 0,
    aggs: {
      tmp_nest: {
        nested: {
          path: "addresses"
        },
        aggs: {
          tmp_filter: {
            filter: {
              terms: {
                'addresses.address.keyword': uniqueBlockAddresses
              }
            },
            aggs: {
              tmp_group_by: {
                terms: {
                  field: "addresses.address.keyword"
                },
                aggs: {
                  tmp_select_latest: {
                    top_hits: {
                      size: 1,
                      sort: [
                        {
                          "addresses.tx_num_after_this_tx": {
                            order: "desc"
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

helpers.annotate(ElasticStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'elastic',
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])


export default ElasticStorageProcessor
