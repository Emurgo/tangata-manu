// @flow

import type {
  TxType as ByronTxType,
} from '../../blockchain/common'

import ElasticStorageProcessor from './elastic-storage-processor'

class ElasticByronStorageProcessor extends ElasticStorageProcessor<ByronTxType> {

}

export default ElasticByronStorageProcessor
