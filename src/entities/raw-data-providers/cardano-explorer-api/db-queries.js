// @flow

import squel from 'squel'

export const sql = squel.useFlavour('postgres')

export const GET_BEST_BLOCK_NUM = sql.select()
  .from('"Block"')
  .field('id', 'hash')
  .field('number', 'height')
  .field('"epochNo"', 'epoch')
  .field('"slotNo"')
  .where('number IS NOT NULL')
  .order('number', false)
  .limit(1)
  .toString()
