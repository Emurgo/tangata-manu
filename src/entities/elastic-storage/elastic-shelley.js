// @flow

import type { Logger } from 'bunyan'

import type { NetworkConfig } from '../../interfaces'

import type { ElasticConfigType } from './elastic-storage-processor'
import ElasticStorageProcessor from './elastic-storage-processor'

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
}

export default ElasticShelleyStorageProcessor
