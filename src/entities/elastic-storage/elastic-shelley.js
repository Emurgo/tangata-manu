// @flow

import _ from 'lodash'
import type { Logger } from 'bunyan'

import type { NetworkConfig } from '../../interfaces'
import type { PoolOwnerInfoEntryType } from '../../interfaces/storage-processor'

import type { ElasticConfigType } from './elastic-storage-processor'
import ElasticStorageProcessor, { formatBulkUploadBody, qSort } from './elastic-storage-processor'

const INDEX_POOL_OWNER_INFO = 'pool-owner-info'

const POOL_OWNER_INFO_KEYS_AND_HASHES = {
  size: 0,
  aggs: {
    tmp_group_by: {
      terms: {
        field: 'owner.keyword',
        size: 10000000,
      },
      aggs: {
        tmp_select_latest: {
          top_hits: {
            size: 1,
            _source: ['owner', 'hash'],
            ...qSort(['time', 'desc']),
          },
        },
      },
    },
  },
}


const ELASTIC_SHELLEY_TEMPLATES = {
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

class ElasticShelleyStorageProcessor extends ElasticStorageProcessor {
  constructor(
    logger: Logger,
    elasticConfig: ElasticConfigType,
    networkConfig: NetworkConfig,
  ) {
    super(logger, elasticConfig, networkConfig)
    this.elasticTemplates = {
      ...this.elasticTemplates,
      ...ELASTIC_SHELLEY_TEMPLATES,
    }
  }

  async getLatestPoolOwnerHashes() {
    const index = this.indexFor(INDEX_POOL_OWNER_INFO)
    if (!await this.indexExists(index)) {
      return {}
    }
    const res = await this.client.search({
      index,
      allowNoIndices: true,
      ignoreUnavailable: true,
      body: POOL_OWNER_INFO_KEYS_AND_HASHES,
    })
    if (res.body.hits.total.value === 0) {
      return {}
    }
    const { buckets } = res.body.aggregations.tmp_group_by
    try {
      const pairs = buckets.map(buck => {
        const { owner, hash } = buck.tmp_select_latest.hits.hits[0]._source
        return { [owner]: hash }
      })
      return _.assign({}, ...pairs)
    } catch (e) {
      this.logger.error(
        'Failed while processing this response:', JSON.stringify(res, null, 2),
        'Error: ', e)
      throw e
    }
  }

  async storePoolOwnersInfo(entries: Array<PoolOwnerInfoEntryType>) {
    const time = new Date().toISOString()
    const entriesBody = formatBulkUploadBody(entries, {
      index: this.indexFor(INDEX_POOL_OWNER_INFO),
      getId: (o: PoolOwnerInfoEntryType) => `${o.owner}:${time}`,
      getData: (o: PoolOwnerInfoEntryType) => ({
        ...o,
        time,
      }),
    })
    await this.bulkUpload(entriesBody)
  }
}

export default ElasticShelleyStorageProcessor
