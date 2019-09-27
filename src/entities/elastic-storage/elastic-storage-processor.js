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
      tx: {
        properties: {
          addresses: {
            type: 'nested',
          },
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


  async esSearch(params: {}) {
    const resp = await this.client.search(params)
    const { hits } = resp.body
    return hits
  }

  async getLatestStableChunk() {
    const hits = await this.esSearch({
      index: this.indexFor(INDEX_CHUNK),
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
    /*
    Does not works. Fail with next exception:
    UnhandledPromiseRejectionWarning: ResponseError: mapper_parsing_exception
    at IncomingMessage.<anonymous>
    (/Users/macbook/yoroi-importer/node_modules/@elastic/elasticsearch/lib/Transport.js:287:25)
    at IncomingMessage.emit (events.js:214:15)
    at IncomingMessage.EventEmitter.emit (domain.js:476:20)
    at endReadableNT (_stream_readable.js:1178:12)
    at processTicksAndRejections (internal/process/task_queues.js:77:11)
    */
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

  async genesisLoaded() {
    // await this.ensureElasticTemplates()
    const esResponse = await this.client.cat.count({
      index: this.indexFor(INDEX_TX),
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
        ...TxData.fromGenesisUtxo(o, this.networkStartTime).toPlainObject(),
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
    const esResponse = await this.client.search({
      index: this.indexFor(INDEX_SLOT),
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

  getBlocksForSlotIdx(blocks: Array<Block>, storedUTxOs: Array<UtxoType>, options:{} = {}) {
    return formatBulkUploadBody(blocks, {
      index: this.indexFor(INDEX_SLOT),
      getId: (o) => o.hash,
      getData: (o) => ({
        ...(new BlockData(o, storedUTxOs)).toPlainObject(),
        ...options,
      }),
    })
  }

  getBlockUtxos(block: Block, options:{} = {}) {
    const blockUtxos = (new BlockData(block)).getBlockUtxos()
    return formatBulkUploadBody(blockUtxos, {
      index: this.indexFor(INDEX_TXIO),
      getId: (o) => o.id,
      getData: (o) => ({
        ...o,
        ...options,
      }),
    })
  }

  async storeBlocksData(blocks: Array<Block>) {
    const storedUTxOs = []
    const utxosToStore = []
    const txInputsIds = []
    const blockTxs = []
    const chunk = (await this.getLatestStableChunk()) + 1
    for (const block of blocks) {
      const txs = block.getTxs()
      blockTxs.push(...txs)
      txInputsIds.push(..._.flatten(_.map(txs, 'inputs')).map(getTxInputUtxoId))
      if (txs.length > 0) {
        this.logger.debug('storeBlocksData', block)
        utxosToStore.push(...this.getBlockUtxos(block, { _chunk: chunk }))
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
    const blocksBody = this.getBlocksForSlotIdx(blocks,
      [...storedUTxOs, ...utxosToStore], { _chunk: chunk })
    await this.bulkUpload([...utxosToStore, ...blocksBody])

    await sleep(5000)
    await this.storeChunk({
      chunk,
      blocks: blocks.length,
      txs: blockTxs.length,
      txios: utxosToStore.length,
    })
    await sleep(5000)
  }
}

helpers.annotate(ElasticStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'elastic',
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])


export default ElasticStorageProcessor
