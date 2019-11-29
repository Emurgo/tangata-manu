// @flow

import _ from 'lodash'

import { CERT_TYPE } from '../../blockchain/shelley/certificate'
import type { ShelleyTxType as TxType } from '../../blockchain/shelley/tx'
import type { Database } from '../../interfaces'

import DB from './database'
import Q from './db-queries'


const DELEGATION_CERTIFICATES_TBL = 'delegation_certificates'
const ACCOUNTS_TBL = 'accounts'

const ACCOUNT_OP_TYPE = {
  REGULAR_TX: 0,
  REWARD_DEPOSIT: 1,
}

class DBShelley extends DB<TxType> implements Database<TxType> {
  async rollbackTo(blockHeight: number): Promise<void> {
    await super.rollbackTo(blockHeight)
    await this.rollbackDelegationCerts(blockHeight)
    await this.rollbackAccounts(blockHeight)
  }

  async rollbackAccounts(blockHeight: number): Promise<void> {
    await super.removeRecordsAfterBlock(ACCOUNTS_TBL, blockHeight)
  }

  async rollbackDelegationCerts(blockHeight: number): Promise<void> {
    await super.removeRecordsAfterBlock(DELEGATION_CERTIFICATES_TBL, blockHeight)
  }

  async storeStakeDelegationCertTx(tx: TxType): Promise<void> {
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

  async storeAccountsChanges(tx: TxType): Promise<void> {
    const accountInputs = tx.inputs.filter(inp => inp.type === 'account')
    const accountOutputs = tx.outputs.filter(out => out.type === 'account')
    if (_.isEmpty([...accountInputs, ...accountOutputs])) {
      return
    }

    const accountsBalance = new Map<string, number>()
    accountInputs.forEach((account, counter) => {
      const { account_id, value } = account
      const currentBalance = accountsBalance.get(account_id)
      if (currentBalance !== undefined) {
        accountsBalance.set(account_id, currentBalance - value)
      } else {
        accountsBalance.set(account_id, 0 - value)
      }
    })

    accountOutputs.forEach((account, counter) => {
      const { address, value } = account
      const currentBalance = accountsBalance.get(address)
      if (currentBalance !== undefined) {
        accountsBalance.set(address, currentBalance + value)
      } else {
        accountsBalance.set(address, value)
      }
    })

    const accountsData = []
    for (const [account, balance] of accountsBalance) {
      accountsData.push({
        account,
        balance: Math.ceil(balance / 100000),
        operation_type: ACCOUNT_OP_TYPE.REGULAR_TX,
        operation_id: `${account}:${tx.id}`,
      })
    }
    const conn = this.getConn()
    const sql = Q.sql.insert()
      .into(ACCOUNTS_TBL)
      .setFieldsRows(accountsData)
      .toString()
    await conn.query(sql)
  }

  async storeTx(tx: TxType,
    txUtxos:Array<mixed> = [], upsert: boolean = true): Promise<void> {
    const { certificate } = tx
    await super.storeTx(tx, txUtxos, upsert)
    await this.storeAccountsChanges(tx)
    if (certificate
      && (certificate.type === CERT_TYPE.StakeDelegation)) {
      await this.storeStakeDelegationCertTx(tx)
    }
  }
}

export default DBShelley
