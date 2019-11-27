// @flow

import { helpers } from 'inversify-vanillajs-helpers'

import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { CERT_TYPE } from '../../blockchain/shelley/certificate'
import type { ShelleyTxType } from '../../blockchain/shelley/tx'

import DB from './database'
import Q from './db-queries'


const DELEGATION_CERTIFICATES_TBL = 'delegation_certificates'

class DBShelley extends DB {
  async rollbackTo(blockHeight: number): Promise<void> {
    await super.rollbackTo(blockHeight)
    await this.rollbackDelegationCerts(blockHeight)
  }

  async rollbackDelegationCerts(blockHeight: number): Promise<void> {
    await super.removeRecordsAfterBlock(DELEGATION_CERTIFICATES_TBL, blockHeight)
  }

  async storeStakeDelegationCertTx(tx: ShelleyTxType): Promise<void> {
    const { certificate } = tx
    const sql = Q.sql.insert()
      .into(DELEGATION_CERTIFICATES_TBL)
      .setFields({
        epoch: tx.epoch,
        slot: tx.slot,
        tx_ordinal: tx.txOrdinal,
        cert_ordinal: tx.certOrdinal,
        block_num: tx.blockNum,
        tx_hash: tx.id,
        pool: certificate.pool_id,
        cert_id: `cert:${tx.id}${tx.certOrdinal}`,
        account: certificate.account,
      })
      .toString()
    this.logger.debug('storeStakeDelegationCertTx: ', sql)
    await this.getConn().query(sql)
  }

  async storeTx(tx: ShelleyTxType,
    txUtxos:Array<mixed> = [], upsert: boolean = true): Promise<void> {
    const { certificate } = tx
    await super.storeTx(tx, txUtxos, upsert)
    if (certificate
      && (certificate.type === CERT_TYPE.StakeDelegation)) {
      await this.storeStakeDelegationCertTx(tx)
    }
  }
}

helpers.annotate(DBShelley, [
  SERVICE_IDENTIFIER.DB_CONNECTION,
  SERVICE_IDENTIFIER.LOGGER,
])

export default DBShelley
