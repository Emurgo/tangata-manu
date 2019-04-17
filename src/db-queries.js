// flow
import squel from 'squel'

const UTXOS_INSERT = squel.insert().into('utxos')

export default {
  UTXOS_INSERT,
}
