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

const newUtxosInsert = () => sql.insert().into('utxos')

const newBestBlockUpdate = () => sql.update().table('bestblock')

const newBlockInsert = () => sql.insert().into('blocks')

const newTxInsert = () => sql.insert().registerValueHandler(Array, psqlArrayValueHandler).into('txs')

const newTxAddressesInsert = () => sql.insert().into('tx_addresses').onConflict()

const GET_BEST_BLOCK_NUM = sql.select()
  .from('blocks')
  .field('block_hash')
  .field('block_height')
  .field('epoch')
  .field('slot')
  .order('block_height', false)
  .limit(1)
  .toString()

const GET_UTXOS_BLOCKS_COUNT = sql.select()
  .field('(select count(*) from utxos ) + ( select count(*) from blocks) as cnt')
  .toString()

export default {
  sql,
  newUtxosInsert,
  GET_BEST_BLOCK_NUM,
  newBestBlockUpdate,
  newBlockInsert,
  newTxInsert,
  newTxAddressesInsert,
  GET_UTXOS_BLOCKS_COUNT,
}
