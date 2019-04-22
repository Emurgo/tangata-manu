// @flow
import { helpers } from 'inversify-vanillajs-helpers'
import _ from 'lodash'

import { Database, DBConnection, Logger } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import utils from '../blockchain/utils'
import Q from '../db-queries'

class DB implements Database {
  #conn: any

  #logger: any

  constructor(
    dbConn: DBConnection,
    logger: Logger,
  ) {
    this.#conn = dbConn
    this.#logger = logger
  }

  getConn() {
    return this.#conn
  }

  async storeUtxos(utxos) {
    const conn = this.getConn()
    this.#logger.debug('storeUtxos', utxos)
    const dbRes = await conn.query(
      Q.UTXOS_INSERT.setFieldsRows(utxos).toString())
    return dbRes
  }

  async getBestBlockNum() {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BEST_BLOCK_NUM.toString())
    const blockNum = (dbRes.rowCount !== 0)
      ? Number(dbRes.rows[0].best_block_num)
      : -1 // no blocks processed, start to process from 0 block.
    return blockNum
  }

  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.BEST_BLOCK_UPDATE.set('best_block_num', bestBlockNum).toString())
    return dbRes
  }

  async storeBlock(block) {
    const conn = this.getConn()
    try {
      await conn.query(Q.BLOCK_INSERT.setFields(block.serialize()).toString())
    } catch (e) {
      this.#logger.debug('Error occur on block', block.serialize())
    }
  }

  async getUtxoAddress(input) {
    const conn = this.getConn()
    const utxoId = `${input.txId}${input.idx}`
    const query = Q.sql.select().from('utxos').where('utxo_id = ?', utxoId).toString()
    this.#logger.debug('getUtxoAddress', input, utxoId, query)
    const dbRes = await conn.query(query)
    const row = dbRes.rows[0]
    return {
      address: row.receiver,
      amount: row.amount,
    }
  }


  async storeTxAddresses(txId, addresses) {
    const conn = this.getConn()
    const dbFields = _.map(addresses, (address) => ({
      tx_hash: txId,
      address,
    }))
    const query = Q.TX_ADDRESSES_INSERT.setFieldsRows(dbFields).toString()
    try {
      await conn.query(query)
    } catch (e) {
      this.#logger.debug(e)
      this.#logger.debug(`Addresses for ${txId} already stored`)
    }
  }

  async storeOutputs(tx) {
    const { id, outputs } = tx
    const utxosData = _.map(outputs, (output, index) => utils.structUtxo(
      output.address, output.value, id, index))
    await this.storeUtxos(utxosData)
  }

  async removeInputUtxos(input) {
    const conn = this.getConn()
    const query = Q.sql.delete().from('utxos')
      .where('utxo_id = ?', `${input.txId}${input.idx}`).toString()
    const dbRes = await conn.query(query)
    return dbRes
  }

  async storeTx(block, tx) {
    const conn = this.getConn()
    const { inputs, outputs, id } = tx

    await this.storeOutputs(tx)
    const inputsData = []
    for (let index = 0; index < inputs.length; index++) {
      const inputAddress = await this.getUtxoAddress(inputs[index])
      inputsData.push(inputAddress)
      await this.removeInputUtxos(inputs[index])
    }
    const inputAddresses = _.map(inputsData, 'address')
    const outputAddresses = _.map(outputs, 'address')
    const inputAmmounts = _.map(inputsData, (item) => Number.parseInt(item.amount, 10))
    const outputAmmounts = _.map(outputs, (item) => Number.parseInt(item.value, 10))
    const query = Q.TX_INSERT.setFields({
      hash: id,
      inputs_address: inputAddresses,
      inputs_amount: inputAmmounts,
      outputs_address: outputAddresses,
      outputs_amount: outputAmmounts,
      block_num: block.height,
      block_hash: block.hash,
    }).toString()
    this.#logger.debug('Insert TX:', query, inputAddresses, inputAmmounts)
    await conn.query(query)
    await this.storeTxAddresses(
      id,
      _.merge(inputAddresses, outputAddresses),
    )
  }

  async storeBlockTxs(block) {
    const txs = block.txs
    for (let index = 0; index < txs.length; index++) {
      await this.storeTx(block, txs[index])
    }
  }

  async storeEpoch(epoch) {
    for (const block of epoch) {
      if (block.txs) {
        await this.storeBlock(block)
      }
    }
  }
}


helpers.annotate(DB, [
  SERVICE_IDENTIFIER.DB_CONNECTION,
  SERVICE_IDENTIFIER.LOGGER,
])

export default DB
