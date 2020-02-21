// @flow

import type { TxType } from '../common/tx'
import type { CertificateType } from './certificate'

export type ShelleyTxType = {
  ...TxType,
  certificate?: CertificateType,
}
