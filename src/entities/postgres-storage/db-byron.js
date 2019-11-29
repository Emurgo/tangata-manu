// @flow

import type { Database } from '../../interfaces'

import type { TxType } from '../../blockchain/common'
import DB from './database'

class DBByron extends DB<TxType> implements Database<TxType> {

}

export default DBByron
