// @flow
import _ from 'lodash'

import { helpers } from 'inversify-vanillajs-helpers'
import { Client } from '@elastic/elasticsearch'

import type { StorageProcessor, Logger } from '../../interfaces'
import type { Block } from '../../blockchain'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

import BlockData from './block-data'

const INDEX_SLOT = 'seiza.slot'

class ElasticStorageProcessor implements StorageProcessor {
  logger: Logger

  client: Client

  constructor(
    logger: Logger,
    elasticNode: string,
  ) {
    this.logger = logger
    this.client = new Client({ node: elasticNode })
  }

  async genesisLoaded() {
    this.logger.debug('Check elastic whether genesis loaded')
    return true
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
    'elasticNodeProxy',
  ])


export default ElasticStorageProcessor
