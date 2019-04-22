// flow
import squel from 'squel'

const UTXOS_INSERT = squel.insert().into('utxos')

const BEST_BLOCK_UPDATE = squel.update().table('bestblock')

const BLOCK_INSERT = squel.insert().into('blocks')

const GET_BEST_BLOCK_NUM = squel.select()
  .from('bestblock')
  .field('best_block_num')

const GET_BLOCK = squel.select().from('blocks')


export default {
  UTXOS_INSERT,
  GET_BEST_BLOCK_NUM,
  GET_BLOCK,
  BEST_BLOCK_UPDATE,
  BLOCK_INSERT,
}
