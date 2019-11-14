// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import _ from 'lodash'

import type { Database, DBConnection, Logger } from '../../interfaces'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import { Block, TX_STATUS, utils } from '../../blockchain/common'
import type { TxType, TxInputType } from '../../blockchain/common'
import Q from './db-queries'

const SNAPSHOTS_TABLE = 'transient_snapshots'


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

  async storeUtxos(utxos: Array<mixed>) {
    const conn = this.getConn()
    const query = Q.UTXOS_INSERT.setFieldsRows(utxos).toString()
    this.#logger.debug('storeUtxos', utxos, query)
    const dbRes = await conn.query(query)
    return dbRes
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BEST_BLOCK_NUM.toString())
    if (dbRes.rowCount > 0) {
      const row = dbRes.rows[0]
      return {
        hash: row.block_hash,
        height: Number(row.block_height),
        epoch: Number(row.epoch),
        slot: Number(row.slot),
      }
    }
    return { height: 0, epoch: 0 }
  }

  async utxosForInputsExists(inputs: Array<TxInputType>): Promise<boolean> {
    const utxoIds = inputs.map(utils.getUtxoId)
    const conn = this.getConn()
    const sql = Q.sql.select()
      .from('utxos')
      .field('COUNT(*)', 'utxoscount')
      .where('utxo_id IN ?', utxoIds)
      .toString()
    this.#logger.debug(`utxosForInputsExists: ${sql}`)
    const dbRes = await conn.query(sql)
    return inputs.length === Number(dbRes.rows[0].utxoscount)
  }

  async txsForInputsExists(inputs: Array<TxInputType>) {
    const conn = this.getConn()
    const sql = Q.sql.select()
      .from('txs')
      .field('COUNT(*)', 'txscount')
      .where('hash IN ?', _.map(inputs, 'txId'))
      .where('tx_state = ?', TX_STATUS.TX_SUCCESS_STATUS)
      .toString()
    this.#logger.debug(`txsForInputsExists: ${sql}`)
    const dbRes = await conn.query(sql)
    return inputs.length === Number(dbRes.rows[0].txscount)
  }


  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.BEST_BLOCK_UPDATE.set('best_block_num', bestBlockNum).toString())
    return dbRes
  }

  async rollBackTransactions(blockHeight: number) {
    this.#logger.info(`rollBackTransactions to block ${blockHeight}`)
    const conn = this.getConn()
    // all txs after the `blockHeight` are marked as “Pending”
    const sql = Q.sql.update()
      .table('txs')
      .set('tx_state', TX_STATUS.TX_PENDING_STATUS)
      .set('block_num', null)
      .set('block_hash', null)
      .set('time', null)
      .set('last_update', 'NOW()', { dontQuote: true })
      .where('block_num > ?', blockHeight)
      .toString()
    await conn.query(sql)
  }

  async rollbackTransientSnapshots(blockHeight: number) {
    // Delete all pending and failed snapshots after `blockHeight`
    this.#logger.info(`rollbackTransientSnapshots to block ${blockHeight}`)
    const conn = this.getConn()
    const sql = Q.sql.delete().from(SNAPSHOTS_TABLE)
      .where('block_height > ?', blockHeight)
    return conn.query(sql)
  }

  async deleteInvalidUtxos(blockHeight: number) {
    this.#logger.info(`deleteInvalidUtxos to block ${blockHeight}`)
    const conn = this.getConn()
    const utxosSql = Q.sql.delete().from('utxos')
      .where('block_num > ?', blockHeight).toString()
    const utxosBackupSql = Q.sql.delete().from('utxos_backup')
      .where('block_num > ?', blockHeight).toString()
    await conn.query(utxosSql)
    await conn.query(utxosBackupSql)
  }

  async rollBackUtxoBackup(blockHeight: number) {
    this.#logger.info(`rollBackUtxoBackup to block ${blockHeight}`)
    await this.deleteInvalidUtxos(blockHeight)
    const conn = this.getConn()
    const sql = Q.sql.insert()
      .into('utxos')
      .with('moved_utxos',
        Q.sql.delete()
          .from('utxos_backup')
          .where('block_num < ?', blockHeight)
          .where('deleted_block_num > ?', blockHeight)
          .returning('*'))
      .fromQuery(['utxo_id', 'tx_hash', 'tx_index', 'receiver', 'amount', 'block_num'],
        Q.sql.select().from('moved_utxos')
          .field('utxo_id')
          .field('tx_hash')
          .field('tx_index')
          .field('receiver')
          .field('amount')
          .field('block_num'))
      .toString()
    const dbRes = await conn.query(sql)
    return dbRes
  }

  async rollBackBlockHistory(blockHeight: number) {
    this.#logger.info(`rollBackBlockHistory to block ${blockHeight}`)
    const conn = this.getConn()
    const sql = Q.sql.delete()
      .from('blocks')
      .where('block_height > ?', blockHeight)
      .toString()
    await conn.query(sql)
  }

  async storeBlocks(blocks: Array<Block>) {
    const conn = this.getConn()
    const blocksData = _.map(blocks, (block) => block.serialize())
    try {
      await conn.query(Q.BLOCK_INSERT.setFieldsRows(blocksData).toString())
    } catch (e) {
      this.#logger.debug('Error occur on block', blocks)
      throw e
    }
  }

  static insertTxAddressesSql(txId: string, addresses: Array<string>): string {
    const dbFields = _.map(addresses, (address) => ({
      tx_hash: txId,
      address: utils.fixLongAddress(address),
    }))
    const sql = Q.TX_ADDRESSES_INSERT.setFieldsRows(dbFields).toString()
    return sql
  }


  async storeTxAddresses(txId: string, addresses: Array<string>) {
    if (_.isEmpty(addresses)) {
      this.#logger.info(`storeTxAddresses: ${txId} has no addresses`)
      return
    }
    const sql = DB.insertTxAddressesSql(txId, addresses)
    const conn = this.getConn()
    try {
      await conn.query(sql)
    } catch (e) {
      this.#logger.debug(`storeTxAddresses: ${sql}`, e)
      this.#logger.debug(`Addresses for ${txId} already stored`)
    }
  }

  async storeOutputs(tx: {id: string, blockNum: number, outputs: []}) {
    const { id, outputs, blockNum } = tx
    const utxosData = _.map(outputs, (output, index) => utils.structUtxo(
      utils.fixLongAddress(output.address), output.value, id, index, blockNum))
    await this.storeUtxos(utxosData)
  }

  async backupAndRemoveUtxos(utxoIds: Array<string>, deletedBlockNum: number) {
    const conn = this.getConn()
    const query = Q.sql.insert()
      .into('utxos_backup')
      .with('moved_utxos',
        Q.sql.delete()
          .from('utxos')
          .where('utxo_id IN ?', utxoIds)
          .returning('*'))
      .fromQuery([
        'utxo_id',
        'tx_hash',
        'tx_index',
        'receiver',
        'amount',
        'block_num',
        'deleted_block_num',
      ],
      Q.sql.select().from('moved_utxos')
        .field('utxo_id')
        .field('tx_hash')
        .field('tx_index')
        .field('receiver')
        .field('amount')
        .field('block_num')
        .field(`${deletedBlockNum}`, 'deleted_block_num'))
      .toString()
    this.#logger.debug(`backupAndRemoveUtxos ${query}`)
    const dbRes = await conn.query(query)
    return dbRes
  }

  async getUtxos(utxoIds: Array<string>): Promise<Array<{}>> {
    if (_.isEmpty(utxoIds)) {
      return []
    }
    const conn = this.getConn()
    const query = Q.sql.select().from('utxos').where('utxo_id in ?', utxoIds).toString()
    const dbRes = await conn.query(query)
    return dbRes.rows.map((row) => ({
      address: row.receiver,
      amount: row.amount,
      id: row.utxo_id,
      index: row.tx_index,
      txHash: row.tx_hash,
    }))
  }

  async getOutputsForTxHashes(hashes: Array<string>): Promise<Array<{}>> {
    const conn = this.getConn()
    const query = Q.sql.select().from('txs').where('hash in ?', hashes).toString()
    const dbRes = await conn.query(query)
    return dbRes.rows.reduce((res, row) => {
      const arr = _.map(_.zip(row.outputs_address, row.outputs_amount),
        ([address, amount]) => ({ address, amount }))
      res[row.hash] = arr
      return res
    }, {})
  }

  async genesisLoaded(): Promise<boolean> {
    /* Check whether utxo and blocks tables are empty.
    */
    const conn = this.getConn()
    const query = Q.GET_UTXOS_BLOCKS_COUNT
    const dbRes = await conn.query(query.toString())
    return !!Number.parseInt(dbRes.rows[0].cnt, 10)
  }

  async storeTx(tx: TxType, txUtxos:Array<mixed> = [], upsert:boolean = true) {
    const conn = this.getConn()
    const {
      inputs,
      outputs,
      id,
      blockNum,
      blockHash,
    } = tx
    let inputUtxos
    this.#logger.debug(`storeTx tx: ${JSON.stringify(tx)}`)
    this.#logger.debug('storeTx:', txUtxos)
    const txStatus = tx.status || TX_STATUS.TX_SUCCESS_STATUS
    if (_.isEmpty(txUtxos)) {
      const inputUtxoIds = inputs.map(utils.getUtxoId)
      inputUtxos = await this.getUtxos(inputUtxoIds)
    } else {
      inputUtxos = txUtxos
    }
    const inputAddresses = _.map(inputUtxos, 'address')
    const outputAddresses = _.map(outputs, (out) => utils.fixLongAddress(out.address))
    const inputAmmounts = _.map(inputUtxos, (item) => Number.parseInt(item.amount, 10))
    const outputAmmounts = _.map(outputs, (item) => Number.parseInt(item.value, 10))
    const txUTCTime = tx.txTime.toUTCString()
    const txDbFields = {
      hash: id,
      block_num: blockNum,
      block_hash: blockHash,
      tx_state: txStatus,
      tx_body: tx.txBody || null,
      tx_ordinal: tx.txOrdinal,
      time: txUTCTime,
      last_update: txUTCTime,
      ...(!_.isEmpty(inputUtxos)
        ? {
          inputs: JSON.stringify(inputUtxos),
          inputs_address: inputAddresses,
          inputs_amount: inputAmmounts,
        }
        : {}),
      ...(!_.isEmpty(outputAddresses)
        ? {
          outputs_address: outputAddresses,
          outputs_amount: outputAmmounts,
        }
        : {}),
    }
    const now = new Date().toUTCString()

    const onConflictArgs = []
    if (upsert) {
      onConflictArgs.push('hash', {
        block_num: blockNum,
        block_hash: blockHash,
        time: txUTCTime,
        tx_state: txStatus,
        last_update: now,
        tx_ordinal: tx.txOrdinal,
      })
    }

    const sql = Q.TX_INSERT.setFields(txDbFields)
      .onConflict(...onConflictArgs)
      .toString()
    this.#logger.debug('Insert TX:', sql, inputAddresses, inputAmmounts)
    await conn.query(sql)
    await this.storeTxAddresses(
      id,
      [...new Set([...inputAddresses, ...outputAddresses])],
    )
  }

  async isTxExists(txId: string): Promise<boolean> {
    const sql = Q.sql.select().from('txs')
      .field('1')
      .where('hash = ?', txId)
      .limit(1)
      .toString()
    const dbRes = await this.getConn().query(sql)
    return dbRes.rows.length === 1
  }

  async selectInputsForPendingTxsOnly(txHashes: Array<string>): Promise<Array<mixed>> {
    if (_.isEmpty(txHashes)) {
      return []
    }
    const sql = Q.sql.select().from('txs')
      .where('hash IN ?', txHashes)
      .where('tx_state = ?', TX_STATUS.TX_PENDING_STATUS)
      .toString()
    this.#logger.debug('selectInputsForPendingTxsOnly', sql)
    const dbRes = await this.getConn().query(sql)
    return dbRes.rows
  }

  async queryPendingSet() {
    const query = Q.sql.select().from(SNAPSHOTS_TABLE)
      .field('tx_hash')
      .where('block_height = ?', Q.sql.select().from(SNAPSHOTS_TABLE)
        .field('MAX(block_height)'))
      .where('status = ?', TX_STATUS.TX_PENDING_STATUS)
      .union(Q.sql.select().from('txs')
        .field('hash')
        .where('tx_state = ?', TX_STATUS.TX_PENDING_STATUS)
        .where('NOT EXISTS ?', Q.sql.select().from(SNAPSHOTS_TABLE)
          .field('1')
          .where('tx_hash = hash')))
      .toString()
    const dbRes = await this.getConn().query(query)
    this.#logger.debug('queryPendingSet:', query, dbRes)
    return _.map(dbRes.rows, 'tx_hash')
  }

  async groupPendingTxs(
    txHashes: Array<string>): Promise<[Array<string>, Array<string>]> {
    const txs = await this.selectInputsForPendingTxsOnly(txHashes)
    const validTxs = []
    const invalidTxs = []
    for (const tx of txs) {
      const utxosForInputsExists = await this.utxosForInputsExists(tx.inputs)
      if (utxosForInputsExists) {
        validTxs.push(tx.hash)
      } else {
        this.#logger.info(`tx ${tx} inputs already spent`)
        invalidTxs.push(tx.hash)
      }
    }
    return [validTxs, invalidTxs]
  }

  async groupPendingTxsForSnapshot(
    newConfirmedTxHashes: Array<string>): Promise<[Array<string>, Array<string>]> {
    const pendingSet = await this.queryPendingSet()
    const txsInPendingState = _.difference(pendingSet, newConfirmedTxHashes)
    const [pendingTxs, invalidTxs] = await this.groupPendingTxs(txsInPendingState)
    return [pendingTxs, invalidTxs]
  }


  async storeNewPendingSnapshot(block: Block, snapshot: Array<string>) {
    if (_.isEmpty(snapshot)) {
      this.#logger.debug('storeNewPendingSnapshot: No pending txs added to snapshot..')
      return
    }
    const dbFields = snapshot.map(txHash => ({
      tx_hash: txHash,
      block_hash: block.hash,
      block_height: block.height,
      status: TX_STATUS.TX_PENDING_STATUS,
    }))
    const sql = Q.sql.insert().into(SNAPSHOTS_TABLE)
      .setFieldsRows(dbFields).toString()
    this.#logger.debug('storeNewPendingSnapshot: ', snapshot, sql)
    await this.getConn().query(sql)
  }

  async queryFailedSet() {
    const sql = Q.sql.select().from('txs')
      .field('hash')
      .where('tx_state = ?', TX_STATUS.TX_FAILED_STATUS)
      .where('NOT EXISTS ?', Q.sql.select().from(SNAPSHOTS_TABLE)
        .where('status = ?', TX_STATUS.TX_FAILED_STATUS)
        .where('tx_hash = hash'))
      .toString()
    const dbRes = await this.getConn().query(sql)
    this.#logger.debug('queryFailedSet:', sql, dbRes)
    return _.map(dbRes.rows, 'hash')
  }

  async storeNewFailedSnapshot(block: Block, invalidTxs: Array<string>) {
    const failedSet = [
      ...(await this.queryFailedSet()),
      ...invalidTxs,
    ]
    if (_.isEmpty(failedSet)) {
      this.#logger.debug('storeNewFailedSnapshot: No failed txs added to snapshot..')
      return
    }
    const dbFields = failedSet.map(txHash => ({
      tx_hash: txHash,
      block_hash: block.hash,
      block_height: block.height,
      status: TX_STATUS.TX_FAILED_STATUS,
    }))
    const sql = Q.sql.insert().into(SNAPSHOTS_TABLE)
      .setFieldsRows(dbFields).toString()
    this.#logger.debug('storeNewFailedSnapshot: ', sql)
    await this.getConn().query(sql)
  }

  async updateTxsStatus(txs: Array<string>, status: string) {
    const sql = Q.sql.update().table('txs')
      .set('tx_state', status)
      .where('hash IN ?', txs)
      .toString()
    return this.getConn().query(sql)
  }

  async storeNewSnapshot(block: Block) {
    const txHashes = _.map(block.txs, 'id')
    const [pendingTxs, invalidTxs] = await this.groupPendingTxsForSnapshot(txHashes)
    if (!_.isEmpty(invalidTxs)) {
      await this.updateTxsStatus(invalidTxs, TX_STATUS.TX_FAILED_STATUS)
    }
    await this.storeNewPendingSnapshot(block, pendingTxs)
    await this.storeNewFailedSnapshot(block, invalidTxs)
  }


  async storeBlockTxs(block: Block) {
    // TODO: Do we need to serialize more in shelley?
    const hash = block.getHash()
    const epoch = block.getEpoch()
    const slot = block.getSlot()
    const txs = block.getTxs()
    this.#logger.debug(`storeBlockTxs (${epoch}/${String(slot)}, ${hash}, ${block.getHeight()})`)
    const newUtxos = utils.getTxsUtxos(txs)
    const blockUtxos = []
    // TODO: these are some changes I made quickly to see if I could protoype account spending
    // and the code is not exactly of the best quality.
    // indexed by tx index in block
    const accountInputs: Map<number, Array<AccountType>> = new Map()
    const withdrawls: Map<string, Number> = new Map()
    const requiredInputs = _.flatMap(txs, (tx) => tx.inputs).filter((inp, txOrdinal) => {
      if (inp.type === 'utxo') {
        const utxoId = utils.getUtxoId(inp)
        const localUtxo = newUtxos[utxoId]
        if (localUtxo) {
          blockUtxos.push({
            id: localUtxo.utxo_id,
            address: localUtxo.receiver,
            amount: localUtxo.amount,
            txHash: localUtxo.tx_hash,
            index: localUtxo.tx_index,
          })
          // Delete new Utxo if it's already spent in the same block
          delete newUtxos[utxoId]
          // Remove this input from required
          return false
        }
        return true
      }
      if (inp.type === 'account') {
        if (typeof accountInputs.get(txOrdinal) === 'undefined') {
          accountInputs.set(txOrdinal, [])
        }
        accountInputs.get(txOrdinal).push(inp)
        withdrawls.set(inp.account_id, (withdrawls.get(inp.account_id) || 0) + inp.value)
        return false
      }
      return false
    })
    const requiredUtxoIds = requiredInputs.map(utils.getUtxoId)
    this.#logger.debug('storeBlockTxs.requiredUtxo', requiredUtxoIds)
    const availableUtxos = await this.getUtxos(requiredUtxoIds)
    const allUtxoMap = _.keyBy([...availableUtxos, ...blockUtxos], 'id')
    /* eslint-disable no-plusplus */
    for (let index = 0; index < txs.length; index++) {
      /* eslint-disable no-await-in-loop */
      const tx = txs[index]
      const utxos = tx.inputs.filter(inp => inp.type === 'utxo').map(input => allUtxoMap[utils.getUtxoId(input)]).filter(x => x)
      if (utxos.length + (accountInputs.get(index)
        ? accountInputs.get(index).length : 0) !== tx.inputs.length) {
        throw new Error(
          `Failed to query input utxos for tx ${
            tx.id} for inputs: ${JSON.stringify(tx.inputs)}
            all utxos: ${JSON.stringify(allUtxoMap)}`,
        )
      }
      this.#logger.debug('storeBlockTxs.storeTx', tx.id)
      await this.storeTx(tx, utxos)
    }
    await this.storeUtxos(Object.values(newUtxos))
    if (requiredUtxoIds.length > 0) {
      await this.backupAndRemoveUtxos(requiredUtxoIds, block.getHeight())
    }
    // idea is to update the SQL account balance table here
    if (withdrawls.size > 0) {
      this.#logger.info(`\n\n\n\n\n\nACCOUNT WITHDRAWLS: ${JSON.stringify(withdrawls)}\n\n\n\n`)
    }
  }
}


helpers.annotate(DB, [
  SERVICE_IDENTIFIER.DB_CONNECTION,
  SERVICE_IDENTIFIER.LOGGER,
])

export default DB
