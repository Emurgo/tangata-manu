// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'

import { helpers } from 'inversify-vanillajs-helpers'
import { Client } from '@elastic/elasticsearch'

import BigNumber from 'bignumber.js'
import type { StorageProcessor, NetworkConfig } from '../../interfaces'
import type { AccountInputType, Block, TxInputType, TxType } from '../../blockchain/common'
import type { BlockInfoType, GenesisLeaderType } from '../../interfaces/storage-processor'
import type { ShelleyTxType } from '../../blockchain/shelley/tx';

import SERVICE_IDENTIFIER from '../../constants/identifiers'

import type { UtxoType } from './utxo-data'
import BlockData from './block-data'
import UtxoData, { getTxInputUtxoId } from './utxo-data'
import TxData from './tx-data'
import { parseCoinToBigInteger } from './elastic-data'
import { shelleyUtils } from '../../blockchain/shelley';
import { CERT_TYPE } from "../../blockchain/shelley/certificate";

const INDEX_LEADERS = 'leader'
const INDEX_SLOT = 'slot'
const INDEX_TX = 'tx'
const INDEX_TXIO = 'txio'
const INDEX_CHUNK = 'chunk'
const INDEX_POINTER_ALL = '*'


const ELASTIC_TEMPLATES = {
  seiza_tx_addresses: {
    index_patterns: ['seiza*.tx'],
    mappings: {
      properties: {
        addresses: {
          type: 'nested',
        },
      },
    },
  },
  seiza_tx_delegation: {
    index_patterns: ['seiza*.tx'],
    mappings: {
      properties: {
        delegation: {
          type: 'nested',
        },
      },
    },
  },
  seiza_tx_pools: {
    index_patterns: ['seiza*.tx'],
    mappings: {
      properties: {
        pools: {
          type: 'nested',
        },
      },
    },
  },
  seiza_tx_certificates: {
    index_patterns: ['seiza*.tx'],
    mappings: {
      properties: {
        certificates: {
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

const getBlocksForSlotIdx = (
  blocks: Array<Block>,
  storedUTxOs: Array<UtxoType>,
  txTrackedState: { [string]: any },
  addressStates: { [string]: any },
  poolDelegationStates: { [string]: any },
): Array<BlockData> => {
  const blocksData = blocks.map(
    block => new BlockData(block, storedUTxOs, txTrackedState, addressStates, poolDelegationStates))
  return blocksData
}

const getBlockUtxos = (block: Block) => {
  const blockUtxos = block.getTxs().flatMap(tx => tx.outputs.map(
    (out, idx) => (new UtxoData({
      tx_hash: tx.id,
      tx_index: idx,
      block_hash: block.getHash(),
      receiver: out.address,
      amount: out.value,
    })).toPlainObject(),
  ))
  return blockUtxos
}

const createAddressStateQuery = (uniqueBlockAddresses) => ({
  size: 0,
  aggs: {
    tmp_nest: {
      nested: {
        path: 'addresses',
      },
      aggs: {
        tmp_filter: {
          filter: {
            terms: {
              'addresses.address.keyword': uniqueBlockAddresses,
            },
          },
          aggs: {
            tmp_group_by: {
              terms: {
                field: 'addresses.address.keyword',
              },
              aggs: {
                tmp_select_latest: {
                  top_hits: {
                    size: 1,
                    ...qSort(['addresses.state_ordinal', 'desc']),
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})


const createPoolDelegationStateQuery = (uniqueBlockPools) => ({
  size: 0,
  aggs: {
    tmp_nest: {
      nested: {
        path: 'delegation',
      },
      aggs: {
        tmp_filter: {
          filter: {
            terms: {
              'delegation.pool_id.keyword': uniqueBlockPools,
            },
          },
          aggs: {
            tmp_group_by: {
              terms: {
                field: 'delegation.pool_id.keyword',
              },
              aggs: {
                tmp_select_latest: {
                  top_hits: {
                    size: 1,
                    ...qSort(['delegation.state_ordinal', 'desc']),
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})


class ElasticStorageProcessor implements StorageProcessor {
  logger: Logger

  client: Client

  networkStartTime: number

  elasticConfig: ElasticConfigType

  lastChunk: number;

  genesisLeaders: Array<GenesisLeaderType>

  slotsPerEpoch: number

  constructor(
    logger: Logger,
    elasticConfig: ElasticConfigType,
    networkConfig: NetworkConfig,
  ) {
    this.logger = logger
    this.elasticConfig = elasticConfig
    this.client = new Client({ node: elasticConfig.node })
    this.networkStartTime = networkConfig.startTime()
    this.slotsPerEpoch = networkConfig.slotsPerEpoch()
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
    // Sleeping to ensure delete is flushed
    await sleep(5000)
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

  setGenesisLeaders(leaders: Array<GenesisLeaderType>) {
    this.genesisLeaders = _.keyBy(leaders, 'slotLeaderPk')
    this.logger.debug('Genesis leaders: ', this.genesisLeaders)
  }

  async onLaunch() {
    await this.ensureElasticTemplates()
    await this.removeUnsealed()
    this.lastChunk = await this.getLatestStableChunk()
    this.setGenesisLeaders(await this.getGenesisLeaders())
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

  async storeGenesisLeaders(leaders: Array<GenesisLeaderType>) {
    this.logger.debug('storeGenesisLeaders')
    this.setGenesisLeaders(leaders)
    const leadersBody = formatBulkUploadBody(leaders, {
      index: this.indexFor(INDEX_LEADERS),
      getId: (o: GenesisLeaderType) => o.leadId,
      getData: (o) => o,
    })
    const resp = await this.bulkUpload(leadersBody)
    this.logger.debug('storeGenesisLeaders: upload response ', resp)
  }

  async getGenesisLeaders(): Promise<Array<GenesisLeaderType>> {
    const index = this.indexFor(INDEX_LEADERS)
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return []
    }
    const { hits } = await this.esSearch({
      index,
      allowNoIndices: true,
      ignoreUnavailable: true,
    })
    return _.map(hits, '_source')
  }

  async storeGenesisUtxos(utxos: Array<UtxoType>) {
    // TODO: check bulk upload response
    this.logger.debug('storeGenesisUtxos: store utxos to "txio" index and create fake txs in "tx" index')
    const chunk = ++this.lastChunk

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
    this.logger.debug('bulkUpload', { ...resp, body: { ...resp.body, items: undefined } })
    return resp
  }

  async storeBlocksData(blocks: Array<Block>) {
    const isGenesisBlock = blocks.length === 1  && blocks[0].isGenesisBlock();
    if (isGenesisBlock) {
      this.logger.info('storeBlocksData.GENESIS detected')
    }
    const storedUTxOs = []
    const blockOutputsToStore = []
    const txInputsIds = []
    const blockTxs = []
    const chunk = ++this.lastChunk
    for (const block of blocks) {
      // Resolves the slot leader PKs into a usable ID here for Byron blocks.
      // TODO: is this a very good way to handle this moving forward to shelley?
      // $FlowFixMe
      if (!block.getSlotLeaderId() && block.slotLeaderPk) {
        const lead: GenesisLeaderType = this.genesisLeaders[block.slotLeaderPk]
        if (!lead) {
          throw new Error(
            `Failed to find lead by PK: '${block.slotLeaderPk}', 
            leaders: ${JSON.stringify(this.getGenesisLeaders(), null, 2)}`)
        }
        // $FlowFixMe
        block.lead = lead.leadId
      }

      const txs = block.getTxs()
      if (txs.length > 0) {
        // TODO: imeplement for accounts
        txInputsIds.push(..._.flatten(_.map(txs, 'inputs'))
          .filter((x: TxInputType) => x.type === 'utxo')
          .map(getTxInputUtxoId))
        // this.logger.debug('storeBlocksData', block)
        for (const u of getBlockUtxos(block)) {
          blockOutputsToStore.push(u)
        }
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

    this.logger.debug('storeBlocksData.gettingLatestTxTrackedState')
    const txTrackedState = await this.getLatestTxTrackedState()

    // Inputs are resolved into UTxOs that are being spent
    // Plus all the UTxOs produced in the processed blocks
    const utxosForInputsAndOutputs = [...storedUTxOs, ...blockOutputsToStore]

    const chunkTxs: Array<TxType|ShelleyTxType> = blocks.flatMap(b => b.getTxs())

    // Filter all the unique addresses being used in either inputs or outputs
    this.logger.debug('storeBlocksData.processingAddressStates')

    // All utxo input/output addresses (they are taken from resolved data,
    // because utxo-input address is not straightforward to obtain
    const utxoAddresses = _.uniq(utxosForInputsAndOutputs.map(({ address }) => address));

    // Account inputs/output addresses. They are straightforward
    const accountAddresses = chunkTxs.flatMap((tx: TxType) => {
      const inputAccountAddresses = tx.inputs
        .filter(x => x.type === 'account')
        .map((x: AccountInputType) => x.account_id)
      const outputAccountAddresses = tx.outputs
        .filter(x => x.type === 'account')
        .map(x => x.address)
      return [...inputAccountAddresses, ...outputAccountAddresses]
    })

    // For all group addresses (they are UTxO) we extract the related account address
    const groupAccounts = utxoAddresses.map(addr => {
      const { accountAddress } = shelleyUtils.splitGroupAddress(addr)
      return accountAddress
    }).filter(Boolean)

    // For all delegation certificates we extract the related account address
    const delegationCertificateAccounts = chunkTxs.flatMap(tx =>
      tx.certificate && tx.certificate.type === CERT_TYPE.StakeDelegation ? [tx.certificate.account] : [])

    // All the different extracted addresses are combined in a single set
    // For each one we need to query the previous known state because it will be used in some way
    const uniqueBlockAddresses = _.uniq([
      ...utxoAddresses,
      ...accountAddresses,
      ...groupAccounts,
      ...delegationCertificateAccounts,
    ])

    this.logger.debug(`storeBlocksData.getAddressStates for ${uniqueBlockAddresses.length} addresses`)
    const addressStates: { [string]: any } = await this.getAddressStates(uniqueBlockAddresses)

    // Extract delegated pool IDs from all resolved address states
    const relatedAddressPools = Object.values(addressStates)
      .map(s => s.delegated_pool_after_this_tx)
      .filter(Boolean)

    // For all delegation certificates we extract the pool ID
    const delegationCertificatePools = chunkTxs.flatMap(tx =>
      tx.certificate && tx.certificate.type === CERT_TYPE.StakeDelegation ? [tx.certificate.pool_id] : [])

    const uniqueBlockPools = _.uniq([
      ...relatedAddressPools,
      ...delegationCertificatePools,
    ])

    this.logger.debug(`storeBlocksData.getPoolDelegationStates for ${uniqueBlockPools.length} pools`)
    const poolDelegationStates: { [string]: any } = await this.getPoolDelegationStates(uniqueBlockPools)

    const mappedBlocks: Array<BlockData> = getBlocksForSlotIdx(
      blocks,
      utxosForInputsAndOutputs,
      txTrackedState,
      addressStates,
      poolDelegationStates,
    )

    const blockInputsToStore = mappedBlocks
      .flatMap((b: BlockData) => b.getResolvedTxs())
      .flatMap((tx: TxData) => tx.getInputsData())

    const tip: BlockInfoType = await this.getBestBlockNum()
    const paddedBlocks: Array<BlockData> = padEmptySlots(mappedBlocks,
      tip.epoch, tip.slot, this.networkStartTime, this.slotsPerEpoch)

    const blocksData = paddedBlocks.map((b: BlockData) => b.toPlainObject())

    this.logger.debug(`storeBlocksData.constructing bulk for ${blocksData.length} slots`)
    const blocksBody = formatBulkUploadBody(blocksData, {
      index: this.indexFor(INDEX_SLOT),
      getId: (o) => o.hash,
      getData: o => ({
        ...o,
        ...(isGenesisBlock ?  {
          tx: undefined,
        } : {}),
        _chunk: chunk,
      }),
    })

    const blockTxioToStore = [...blockInputsToStore, ...blockOutputsToStore]
    this.logger.debug(`storeBlocksData.constructing bulk for ${blockTxioToStore.length} txio`)
    const txiosBody = formatBulkUploadBody(blockTxioToStore, {
      index: this.indexFor(INDEX_TXIO),
      getId: (o) => o.id,
      getData: (o) => ({
        ...o,
        _chunk: chunk,
      }),
    })

    const txsData = blocksData.flatMap(b => b.tx);
    this.logger.debug(`storeBlocksData.constructing bulk for ${txsData.length} txs`)
    const txsBody = formatBulkUploadBody(txsData, {
      index: this.indexFor(INDEX_TX),
      getId: (o) => o.hash,
      getData: (o) => o,
    })

    const bulkData = [...blocksBody, ...txsBody, ...txiosBody];
    this.logger.debug(`storeBlocksData.total bulk is ${bulkData.length} documents`)
    const bulkChunks = _.chunk(bulkData, 1000)
    for (let i = 0; i < bulkChunks.length; i += 1) {
      this.logger.debug(`storeBlocksData.bulkUpload chunk ${i+1} out of ${bulkChunks.length}`)
      try {
        await this.bulkUpload(bulkChunks[i])
        await sleep(100)
      } catch (e) {
        this.logger.error(`Failed to bulk-upload blocks data (chunk ${i+1} out of ${bulkChunks.length})`, e)
        throw new Error(`Failed to bulk-upload blocks data (chunk ${i+1} out of ${bulkChunks.length}) : ${e}`)
      }
    }

    // Commit every 10th chunk
    if (chunk % 10 === 0 || isGenesisBlock) {
      await sleep(5000)
      await this.storeChunk({
        chunk,
        blocks: blocks.length,
        txs: blockTxs.length,
        txios: blockTxioToStore.length,
      })
      await sleep(5000)
    }
  }

  async getLatestTxTrackedState(): { [string]: any } {
    this.logger.debug('Querying latest tx-tracking state')
    const res = await this.esSearch({
      index: this.indexFor(INDEX_TX),
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: {
        size: 1,
        query: { bool: { filter: { term: { is_genesis: false } } } },
        _source: ['supply_after_this_tx'],
        ...qSort(['epoch', 'desc'], ['slot', 'desc'], ['tx_ordinal', 'desc']),
      },
    })
    const hit = res.hits[0]
    this.logger.debug('Latest tx-tracking state hit: ', JSON.stringify(hit, null, 2))
    return {
      supply_after_this_tx: hit
        ? parseCoinToBigInteger(hit._source.supply_after_this_tx)
        : new BigNumber(0),
    }
  }

  async getAddressStates(uniqueBlockAddresses: Array<string>): { [string]: any } {
    const index = this.indexFor(INDEX_TX);
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return {}
    }
    const res = await this.client.search({
      index,
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: createAddressStateQuery(uniqueBlockAddresses),
    })
    if (res.body.hits.total.value === 0) {
      return {}
    }
    const { buckets } = res.body.aggregations.tmp_nest.tmp_filter.tmp_group_by
    try {
      const states = buckets.map(buck => {
        const source = buck.tmp_select_latest.hits.hits[0]._source
        return {
          ...source,
          balance_after_this_tx: Number(source.balance_after_this_tx.full),
          ...(source.delegation_after_this_tx ? {
            delegation_after_this_tx: Number(source.delegation_after_this_tx.full),
          }: {}),
        }
      })
      return _.keyBy(states, 'address')
    } catch (e) {
      this.logger.error(
        'Failed while processing this response:', JSON.stringify(res, null, 2),
        'Error: ', JSON.stringify(e, null, 2))
      throw e
    }
  }

  async getPoolDelegationStates(uniqueBlockPools: Array<string>): { [string]: any } {
    const index = this.indexFor(INDEX_TX);
    const indexExists = (await this.client.indices.exists({
      index,
    })).body
    if (!indexExists) {
      return {}
    }
    const res = await this.client.search({
      index,
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: createPoolDelegationStateQuery(uniqueBlockPools),
    })
    if (res.body.hits.total.value === 0) {
      return {}
    }
    const { buckets } = res.body.aggregations.tmp_nest.tmp_filter.tmp_group_by
    try {
      const states = buckets.map(buck => {
        const source = buck.tmp_select_latest.hits.hits[0]._source
        return {
          ...source,
          delegation_after_this_tx: Number(source.delegation_after_this_tx.full),
        }
      })
      return _.keyBy(states, 'pool_id')
    } catch (e) {
      this.logger.error(
        'Failed while processing this response:', JSON.stringify(res, null, 2),
        'Error: ', JSON.stringify(e, null, 2))
      throw e
    }
  }
}

/*
 * Function iterates thru the passed array of blocks, assuming they are in consecutive order,
 * and checks if there are any gaps in epoch/slot between blocks. If there is a gap detected
 * it is assumed these "gap slots" are empty and a special "empty slot" object is created,
 * to track it in Elastic.
 *
 * The tip epoch and slot arguments are used to detect if there's a gap before the first block
 * in the passed array. The network start time argument is used to calculate the `time` field
 * for empty slot objects.
 *
 * Returns a new array of block-objects with the same or larger size.
 */
function padEmptySlots(
  blocks: Array<BlockData>,
  tipEpoch: number,
  tipSlot: ?number,
  networkStartTime: number,
  slotsPerEpoch: number,
): Array<BlockData> {
  const maxSlotNumber = slotsPerEpoch - 1;
  const nextSlot = (epoch: number, slot: ?number) => ({
    epoch: slot >= maxSlotNumber ? epoch + 1 : epoch,
    slot: (slot == null || slot >= maxSlotNumber) ? 0 : slot + 1,
  })
  const result: Array<BlockData> = []
  blocks.reduce(({ epoch, slot }, b: BlockData) => {
    const [blockEpoch, blockSlot] = [b.block.getEpoch(), b.block.getSlot()]
    if (blockEpoch < epoch || (blockEpoch === epoch && blockSlot < slot)) {
      throw new Error(`Got a block for storing younger than next expected slot.
         Expected: ${epoch}/${slot}, got: ${JSON.stringify(b.block)}`,
      )
    }
    if (blockEpoch > epoch) {
      if (blockEpoch - epoch > 1) {
        throw new Error(`Diff between expected slot and next block is more than 1 full epoch.
          Expected: ${epoch}/${slot}, got: ${JSON.stringify(b.block)}`)
      }
      // There are empty slots on the epoch boundary
      for (let emptySlot = slot; emptySlot < 21600; emptySlot++) {
        // Push for all missing slots in the last epoch
        result.push(BlockData.emptySlot(epoch, emptySlot, networkStartTime))
      }
      for (let emptySlot = 0; emptySlot < blockSlot; emptySlot++) {
        // Push for all empty slots in the new epoch
        result.push(BlockData.emptySlot(blockEpoch, emptySlot, networkStartTime))
      }
    } else {
      // Empty slots withing an epoch
      for (let emptySlot = slot; emptySlot < blockSlot; emptySlot++) {
        result.push(BlockData.emptySlot(blockEpoch, emptySlot, networkStartTime))
      }
    }
    // Push the block itself
    result.push(b)
    // Calculate next expected slot from the current block
    return nextSlot(blockEpoch, blockSlot)
  }, nextSlot(tipEpoch, tipSlot))
  return result
}

/*
 * Pass array of queries, where each query is one of:
 * 1. A string 'S' - then turned into `{ S: { order: 'asc' } }`
 * 2. An array [S, O] - then turned into '{ S: { order: O } }'
 * 3. An array [S, O, U] - then turned into '{ S: { order: O, unmapped_type: U } }'
 * 4. An object - passed directly
 *
 * The returned result is an object like: `{ sort: [ *E ] }`
 * Where `*E` are all entries transformed.
 *
 * Use it when constructing an Elastic query like:
 * {
 *   query: { ... },
 *   ...qSort('field1', ['field2', 'desc'])
 * }
 *
 * NOTE: `unmapped_type` is set to `long` for all entries except direct objects
 * and arrays of length 3.
 */
function qSort(...entries) {
  const mapped = entries.map(e => {
    const res = {}
    let key
    let order = 'asc'
    let unmapped_type = 'long'
    if (Array.isArray(e)) {
      if (e.length < 1 || e.length > 3) {
        throw new Error('qSort array entry expect 1-3 elements!')
      }
      key = e[0]
      if (e.length > 1) {
        order = e[1]
      }
      if (e.length > 2) {
        unmapped_type = e[2]
      }
    } else if (typeof e === 'object') {
      return e
    } else {
      key = e
    }
    res[key] = { order, unmapped_type }
    return res
  })
  return { sort: mapped }
}

helpers.annotate(ElasticStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'elastic',
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])


export default ElasticStorageProcessor
