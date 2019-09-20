// @flow

import squel from 'squel'
import _ from 'lodash'

const sql = squel.useFlavour('postgres')

const psqlArrayValueHandler = (array) => {
  // FIXME: sql injection is possible
  const data = _.map(array, (item) => ((typeof item === 'string')
    ? `'${item}'`
    : item
  ))
  return `ARRAY[${data}]`
}

const UTXOS_INSERT = sql.insert().into('utxos')

const BEST_BLOCK_UPDATE = sql.update().table('bestblock')

const BLOCK_INSERT = sql.insert().into('blocks')

const TX_INSERT = sql.insert().registerValueHandler(Array, psqlArrayValueHandler).into('txs')

const TX_ADDRESSES_INSERT = sql.insert().into('tx_addresses').onConflict()

const GET_BEST_BLOCK_NUM = sql.select()
  .from('blocks')
  .field('block_hash')
  .field('block_height')
  .field('epoch')
  .field('slot')
  .order('block_height', false)
  .limit(1)

const GET_UTXOS_BLOCKS_COUNT = sql.select()
  .field('(select count(*) from utxos ) + ( select count(*) from blocks) as cnt')

export default {
  sql,
  UTXOS_INSERT,
  GET_BEST_BLOCK_NUM,
  BEST_BLOCK_UPDATE,
  BLOCK_INSERT,
  TX_INSERT,
  TX_ADDRESSES_INSERT,
  GET_UTXOS_BLOCKS_COUNT,
}
