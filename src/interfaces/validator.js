// @flow

import type { TxType } from '../blockchain/common'

export interface Validator {
    validateTx(txObj: TxType): any;
}
