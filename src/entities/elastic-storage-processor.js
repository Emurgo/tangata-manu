// @flow
import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'
import { Client } from '@elastic/elasticsearch'

import type { StorageProcessor, Logger } from '../interfaces'
import type { BlockInfoType } from '../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../constants/identifiers'

const INDEX_SLOT = 'seiza.slot'

class ElasticStorageProcessor implements StorageProcessor {
  logger: Logger

  es: Client

  constructor(
    logger: Logger,
    elasticNode: string,
  ) {
    this.logger = logger
    this.es = new Client({ node: elasticNode })
  }

  async genesisLoaded() {
    this.logger.debug('Check elastic whether genesis loaded')
    return true
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    const emptyDb = { height: 0, epoch: 0 }
    const indexExists = await this.es.indices.exists({ index: INDEX_SLOT })
    if (!indexExists.body) {
      return emptyDb
    }
    const { hits } = (await this.es.search({
      index: INDEX_SLOT,
      body: {
        sort: [{ epoch: { order: 'desc' } }, { slot: { order: 'desc' } }],
        size: 1,
      },
    })).body.hits
    if (_.isEmpty(hits)) {
      return emptyDb
    }
    // eslint-disable-next-line no-underscore-dangle
    const source = hits[0]._source
    this.logger.debug('getBestBlockNum', source.height)
    return source
  }

  async storeBlockData(block, cache) {
    this.logger.debug('storeBlockData', block, cache)
  }
}

helpers.annotate(ElasticStorageProcessor,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'elasticNode',
    'elasticNodeProxy',
  ])


export default ElasticStorageProcessor
