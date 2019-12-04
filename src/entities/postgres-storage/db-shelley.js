// @flow

import _ from 'lodash'

import { CERT_TYPE } from '../../blockchain/shelley/certificate'
import type {
  ShelleyTxType as TxType,
} from '../../blockchain/shelley/tx'

import type { AccountInputType, Block } from '../../blockchain/common'
import type { Database } from '../../interfaces'

import DB from './database'
import type { TxDbDataType } from './database'
import Q from './db-queries'


const DELEGATION_CERTIFICATES_TBL = 'delegation_certificates'
const ACCOUNTS_TBL = 'accounts'
const ACCOUNT_INP_TYPE = 'account'

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

  async getAccountDbData(accountInputs: Array<AccountInputType>): Promise<{
  }> {
    const accountIds = _.map(accountInputs, 'account_id')
    const sql = Q.sql.select()
      .from(Q.sql.select()
        .from(ACCOUNTS_TBL)
        .where('account in ?', accountIds)
        .order('account')
        .order('block_num', false)
        .order('tx_ordinal', false)
        .order('spending_counter', false)
        .distinct('account'), 't')
      .order('block_num', false)
      .order('tx_ordinal', false)
      .order('spending_counter', false)
      .toString()
    this.logger.debug('getAccountDbData', sql)
    const dbRes = await this.getConn().query(sql)
    let result = {}
    for (const row of dbRes.rows) {
      result = {
        ...result,
        ...{
          [row.account]: {
            balance: parseInt(row.balance, 10),
            counter: parseInt(row.spending_counter, 10),
          },
        },
      }
    }
    return result
  }

  async storeAccountsChanges(tx: TxType): Promise<void> {
    const accountInputs = tx.inputs.filter(inp => inp.type === ACCOUNT_INP_TYPE)
    const accountOutputs = tx.outputs.filter(out => out.type === ACCOUNT_INP_TYPE)
    const allAccountIdsAndValues = [
      ...accountInputs,
      ...(accountOutputs).map(inp => ({
        account_id: inp.address,
        value: inp.value,
      })),
    ]
    if (_.isEmpty(allAccountIdsAndValues)) {
      return
    }

    const accountStoredData = await this.getAccountDbData(allAccountIdsAndValues)

    const accountChanges = {}
    accountInputs.forEach(account => {
      const { account_id, value } = account
      const currentChange = accountChanges[account_id]
      if (currentChange !== undefined) {
        accountChanges[account_id] = {
          value: currentChange.value - value,
          counter: currentChange.counter + 1,
        }
      } else {
        accountChanges[account_id] = { value: 0 - value, counter: 1 }
      }
    })

    accountOutputs.forEach(account => {
      const { address, value } = account
      const currentChange = accountChanges[address]
      if (currentChange !== undefined) {
        accountChanges[address] = {
          value: currentChange.value + value,
          counter: currentChange.counter,
        }
      } else {
        accountChanges[address] = { value, counter: 0 }
      }
    })

    const accountsData = []
    for (const [account, data] of _.toPairs(accountChanges)) {
      let previousBalance = 0
      let previousCounter = 0
      if (accountStoredData[account] !== undefined) {
        previousBalance = accountStoredData[account].balance
        previousCounter = accountStoredData[account].counter
      }
      const balance = previousBalance + data.value
      accountsData.push({
        epoch: tx.epoch,
        slot: tx.slot,
        tx_ordinal: tx.txOrdinal,
        block_num: tx.blockNum,
        operation_id: tx.id,
        operation_type: ACCOUNT_OP_TYPE.REGULAR_TX,
        account,
        value: data.value,
        balance,
        spending_counter: previousCounter + data.counter,
      })
    }
    const conn = this.getConn()
    const sql = Q.sql.insert()
      .into(ACCOUNTS_TBL)
      .setFieldsRows(accountsData)
      .toString()
    this.logger.debug('storeAccountsChanges', sql)
    await conn.query(sql)
  }

  async storeTx(tx: TxType,
    txUtxos:Array<mixed> = [], upsert: boolean = true): Promise<void> {
    const { certificate } = tx
    await super.storeTxImpl(tx, txUtxos, upsert, (txDbData: TxDbDataType): object => {
      const wasm = global.jschainlibs
      const {
        inputAddresses, outputAddresses,
      } = txDbData
      const allAddresses = _.uniq([...inputAddresses, ...outputAddresses])
      console.log(`metadataCreator.allAddresses = ${allAddresses}`)
      return allAddresses.map(addressString => {
        let address
        try {
          address = wasm.Address.from_bytes(Buffer.from(addressString, 'hex'))
        } catch (e) {
          const prefix = addressString.substring(0, 3)
          // TODO: find a better way to distinguish legacy funds?
          if (prefix != 'Ddz' && prefix != 'Ae2') {
            throw new Error(`Group Metadata could not parse address: ${addressString}`)
          }
          return null
        }
        const groupAddress = address.to_group_address()
        let result = null
        if (groupAddress)
        {
          const spendingKey = groupAddress.get_spending_key()
          const accountKey = groupAddress.get_account_key()
          const discrim = address.get_discrimination()
          const singleAddress = wasm.Address.single_from_public_key(spendingKey, discrim)
          const accountAddress = wasm.Address.account_from_public_key(accountKey, discrim)
          const metadata = {
            groupAddress: addressString,
            utxoAddress: Buffer.from(singleAddress.as_bytes()).toString('hex'),
            accountAddress: Buffer.from(accountAddress.as_bytes()).toString('hex'),
          }
          singleAddress.free()
          accountAddress.free()
          spendingKey.free()
          accountKey.free()
          groupAddress.free()
          result = metadata
        }
        address.free()
        return result
      }).filter(Boolean)
    })
    await this.storeAccountsChanges(tx)
    if (certificate
      && (certificate.type === CERT_TYPE.StakeDelegation)) {
      await this.storeStakeDelegationCertTx(tx)
    }
  }
}

export default DBShelley
