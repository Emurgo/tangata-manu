// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import _ from 'lodash'

import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { CERT_TYPE } from '../../blockchain/shelley/certificate'
import type { ShelleyTxType } from '../../blockchain/shelley/tx'

import DB from './database'
import type TxDbDataType from './database'
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
        address.free()
        if (groupAddress)
        {
          const spendingKey = groupAddress.get_spending_key()
          const accountKey = groupAddress.get_account_key()
          const discrim = address.get_discrimination()
          const singleAddress = wasm.Address.single_from_public_key(spendingKey, discrim)
          const accountAddress = wasm.Address.account_from_public_key(spendingKey, discrim)
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
          //throw new Error(`finally found group address: ${JSON.stringify(metadata)}`)
          return metadata
        }
        else
        {
          return null;
        }
      }).filter(Boolean)
    })
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
