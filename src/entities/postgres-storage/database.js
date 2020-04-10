// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import _ from 'lodash'

import type { DBConnection, Logger } from '../../interfaces'
import type { BlockInfoType } from '../../interfaces/storage-processor'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import type { TxInputType, TxType as ByronTxType, UtxoInputType } from '../../blockchain/common'
import { Block, TX_STATUS, utils } from '../../blockchain/common'
import type { ShelleyTxType } from '../../blockchain/shelley/tx'
import Q from './db-queries'

const SNAPSHOTS_TABLE = 'transient_snapshots'

export type TxDbDataType = {
  txDbFields: {
    block_num: ?number,
    block_hash: ?string,
    tx_state: string,
  },
  inputAddresses:Array<string>,
  outputAddresses:Array<string>,
}

export type TxInputsDbDataType = {
  inputAddresses:Array<string>,
  inputAmounts:Array<number>,
  inputs:Array<any>,
}


type BlockTxsDataType = {
  allUtxoMap: any,
  newUtxos: any,
  requiredUtxoIds: any,
}

class DB<TxType: ByronTxType | ShelleyTxType> {
  #conn: any

  logger: any

  pendingTxsTimeoutMillis: number

  constructor(
    dbConn: DBConnection,
    logger: Logger,
    pendingTxsTimeoutMinutes: number,
  ) {
    this.#conn = dbConn
    this.logger = logger
    if (!pendingTxsTimeoutMinutes || pendingTxsTimeoutMinutes <= 0) {
      logger.debug(`[DB] pendingTxsTimeoutMinutes=${pendingTxsTimeoutMinutes}, Pending TTL will NOT be applied`)
    } else {
      logger.debug(`[DB] pendingTxsTimeoutMinutes=${pendingTxsTimeoutMinutes}, Pending TTL is applied`)
      this.pendingTxsTimeoutMillis = pendingTxsTimeoutMinutes * 60000
    }
  }

  getConn() {
    return this.#conn
  }

  async storeUtxos(utxos: Array<mixed>): Promise<void> {
    if (_.isEmpty(utxos)) {
      return
    }
    const conn = this.getConn()
    const query = Q.newUtxosInsert().setFieldsRows(utxos.map(u => ({
      tx_hash: u.tx_hash,
      tx_index: u.tx_index,
      block_num: u.block_num,
      receiver: u.receiver,
      amount: u.amount,
      utxo_id: u.utxo_id,
    }))).toString()
    // this.logger.debug('storeUtxos', utxos, query)
    await conn.query(query)
  }

  async getBestBlockNum(): Promise<BlockInfoType> {
    const conn = this.getConn()
    const dbRes = await conn.query(Q.GET_BEST_BLOCK_NUM)
    if (dbRes.rowCount > 0) {
      const row = dbRes.rows[0]
      return {
        hash: row.block_hash,
        height: Number(row.block_height),
        epoch: Number(row.epoch),
        slot: Number(row.slot),
      }
    }
    return {
      height: 0, epoch: 0, slot: 0, hash: null,
    }
  }

  async utxosForInputsExists(inputs: Array<UtxoInputType>): Promise<boolean> {
    const utxoIds = inputs.map(utils.getUtxoId)
    const conn = this.getConn()
    const sql = Q.sql.select()
      .from('utxos')
      .field('COUNT(*)', 'utxoscount')
      .where('utxo_id IN ?', utxoIds)
      .toString()
    this.logger.debug(`utxosForInputsExists: ${sql}`)
    const dbRes = await conn.query(sql)
    return inputs.length === Number(dbRes.rows[0].utxoscount)
  }

  async txsForInputsExists(inputs: Array<TxInputType>): Promise<boolean> {
    const conn = this.getConn()
    const sql = Q.sql.select()
      .from('txs')
      .field('COUNT(*)', 'txscount')
      .where('hash IN ?', _.map(inputs, 'txId'))
      .where('tx_state = ?', TX_STATUS.TX_SUCCESS_STATUS)
      .toString()
    this.logger.debug(`txsForInputsExists: ${sql}`)
    const dbRes = await conn.query(sql)
    return inputs.length === Number(dbRes.rows[0].txscount)
  }


  async updateBestBlockNum(bestBlockNum: number) {
    const conn = this.getConn()
    const dbRes = await conn.query(
      Q.newBestBlockUpdate().set('best_block_num', bestBlockNum).toString())
    return dbRes
  }

  async rollBackTransactions(blockHeight: number): Promise<void> {
    this.logger.info(`rollBackTransactions to block ${blockHeight}`)
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

  async rollbackTo(blockHeight: number): Promise<void> {
    await this.rollBackTransactions(blockHeight)
    await this.rollbackTransientSnapshots(blockHeight)
    await this.rollBackUtxoBackup(blockHeight)
    await this.rollBackBlockHistory(blockHeight)
    await this.updateBestBlockNum(blockHeight)
  }

  async rollbackTransientSnapshots(blockHeight: number): Promise<void> {
    // Delete all pending and failed snapshots after `blockHeight`
    await this.removeRecordsAfterBlock(SNAPSHOTS_TABLE, blockHeight)
  }

  async removeRecordsAfterBlock(tableName: string, blockHeight: number): Promise<void> {
    this.logger.info(`removeRecordsAfterBlock: ${blockHeight}`)
    const conn = this.getConn()
    const sql = Q.sql.delete().from(tableName)
      .where('block_num > ?', blockHeight).toString()
    await conn.query(sql)
  }

  async deleteInvalidUtxos(blockHeight: number) {
    this.logger.info(`deleteInvalidUtxos to block ${blockHeight}`)
    const conn = this.getConn()
    const utxosSql = Q.sql.delete().from('utxos')
      .where('block_num > ?', blockHeight).toString()
    const utxosBackupSql = Q.sql.delete().from('utxos_backup')
      .where('block_num > ?', blockHeight).toString()
    await conn.query(utxosSql)
    await conn.query(utxosBackupSql)
  }

  async rollBackUtxoBackup(blockHeight: number): Promise<void> {
    this.logger.info(`rollBackUtxoBackup to block ${blockHeight}`)
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
    await conn.query(sql)
  }

  async rollBackBlockHistory(blockHeight: number) {
    this.logger.info(`rollBackBlockHistory to block ${blockHeight}`)
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
      await conn.query(Q.newBlockInsert().setFieldsRows(blocksData).toString())
    } catch (e) {
      this.logger.debug('Error occur on block', blocks)
      throw e
    }
  }

  static insertTxAddressesSql(txId: string, addresses: Array<string>): string {
    const dbFields = _.map(addresses, (address) => ({
      tx_hash: txId,
      address: utils.fixLongAddress(address),
    }))
    const sql = Q.newTxAddressesInsert().setFieldsRows(dbFields).toString()
    return sql
  }

  async storeTxAddresses(txId: string, addresses: Array<string>) {
    if (_.isEmpty(addresses)) {
      this.logger.info(`storeTxAddresses: ${txId} has no addresses`)
      return
    }
    const sql = DB.insertTxAddressesSql(txId, addresses)
    const conn = this.getConn()
    try {
      await conn.query(sql)
    } catch (e) {
      this.logger.debug(`storeTxAddresses: ${sql}`, e)
      this.logger.debug(`Addresses for ${txId} already stored`)
    }
  }

  async storeOutputs(tx: {id: string, blockNum: number, outputs: []}) {
    const { id, outputs, blockNum } = tx
    const utxosData = _.map(outputs, (output, index: number) => utils.structUtxo(
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
    this.logger.debug(`backupAndRemoveUtxos ${query}`)
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
      type: 'utxo',
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
    const dbRes = await conn.query(Q.GET_UTXOS_BLOCKS_COUNT)
    return !!Number.parseInt(dbRes.rows[0].cnt, 10)
  }

  async getTxInputsDbData(tx: TxType, txUtxos: Array<mixed> = []): Promise<TxInputsDbDataType> {
    const { inputs } = tx
    let inputUtxos
    if (_.isEmpty(txUtxos)) {
      const inputUtxoIds = inputs.map(utils.getUtxoId)
      inputUtxos = await this.getUtxos(inputUtxoIds)
    } else {
      inputUtxos = txUtxos
    }
    const inputAddresses = _.map(inputUtxos, 'address')
    const inputAmounts = _.map(inputUtxos, (item) => Number.parseInt(item.amount, 10))
    return {
      inputs: inputUtxos,
      inputAddresses,
      inputAmounts,
    }
  }

  async getTxDBData(tx: TxType, txUtxos: Array<mixed> = []): Promise<TxDbDataType> {
    const {
      outputs,
      id,
      blockNum,
      blockHash,
    } = tx
    // this.logger.debug(`storeTx tx: ${JSON.stringify(tx)}`)
    // this.logger.debug('storeTx:', txUtxos)
    const txStatus = tx.status || TX_STATUS.TX_SUCCESS_STATUS

    const { inputAddresses, inputAmounts, inputs } = await this.getTxInputsDbData(tx, txUtxos)

    const outputAddresses = _.map(outputs, (out) => utils.fixLongAddress(out.address))
    const outputAmounts = _.map(outputs, (item) => Number.parseInt(item.value, 10))
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
      ...(!_.isEmpty(inputAddresses)
        ? {
          inputs: JSON.stringify(inputs),
          inputs_address: inputAddresses,
          inputs_amount: inputAmounts,
        }
        : {}),
      ...(!_.isEmpty(outputAddresses)
        ? {
          outputs_address: outputAddresses,
          outputs_amount: outputAmounts,
        }
        : {}),
    }
    return {
      txDbFields, inputAddresses, outputAddresses,
    }
  }

  async storeTxImpl(
    tx: ShelleyTxType,
    txUtxos: Array<mixed>,
    upsert: boolean,
    txDbData: TxDbDataType): Promise<void> {
    const {
      txDbFields, inputAddresses, outputAddresses,
    } = txDbData
    const onConflictArgs = []
    if (upsert) {
      const now = new Date().toUTCString()
      onConflictArgs.push('hash', {
        inputs: txDbFields.inputs || null,
        // inputs and outputs can be empty(especially in genesis block)
        inputs_address: txDbFields.inputs_address || null,
        inputs_amount: txDbFields.inputs_amount || null,
        outputs_address: txDbFields.outputs_address || null,
        outputs_amount: txDbFields.outputs_amount || null,
        block_num: txDbFields.block_num,
        block_hash: txDbFields.block_hash,
        time: txDbFields.time,
        tx_state: txDbFields.tx_state,
        last_update: now,
        tx_body: txDbFields.tx_body,
        tx_ordinal: txDbFields.tx_ordinal,
      })
    }
    const conn = this.getConn()
    const sql = Q.newTxInsert()
      .setFields(txDbFields)
      .onConflict(...onConflictArgs)
      .toString()
    this.logger.debug('Insert TX:', sql, inputAddresses)
    await conn.query(sql)
    await this.storeTxAddresses(
      tx.id,
      [...new Set([...inputAddresses, ...outputAddresses])],
    )
  }

  async storeTx(tx: ShelleyTxType,
    txUtxos:Array<mixed> = [], upsert:boolean = true): Promise<void> {
    const txDbData = await this.getTxDBData(tx, txUtxos)
    await this.storeTxImpl(tx, txUtxos, upsert, txDbData)
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

  async getTxStatus(txId: string): Promise<string> {
    const sql = Q.sql.select().from('txs')
      .field('tx_state')
      .where('hash = ?', txId)
      .limit(1)
      .toString()
    const dbRes = await this.getConn().query(sql)
    return dbRes.rows.length === 1 ? dbRes.rows[0].tx_state : null
  }

  async selectPendingTxsOnly(txHashes: Array<string>): Promise<Array<mixed>> {
    if (_.isEmpty(txHashes)) {
      return []
    }
    const sql = Q.sql.select().from('txs')
      .where('hash IN ?', txHashes)
      .where('tx_state = ?', TX_STATUS.TX_PENDING_STATUS)
      .toString()
    this.logger.debug('selectPendingTxsOnly', sql)
    const dbRes = await this.getConn().query(sql)
    return dbRes.rows
  }

  async queryPendingSet() {
    const qMaxSnapshotBlockNum = Q.sql.select().from(SNAPSHOTS_TABLE).field('MAX(block_num)')
    const query = Q.sql.select().from(SNAPSHOTS_TABLE)
      .field('tx_hash')
      .where('block_num = ?', qMaxSnapshotBlockNum)
      .where('status = ?', TX_STATUS.TX_PENDING_STATUS)
      .union(
        Q.sql.select().from('txs')
          .field('hash')
          .where('tx_state = ?', TX_STATUS.TX_PENDING_STATUS)
          .where('NOT EXISTS ?',
            Q.sql.select().from(SNAPSHOTS_TABLE)
              .field('1')
              .where('tx_hash = hash')
              .where('block_num = ?', qMaxSnapshotBlockNum),
          ),
      )
      .toString()
    const dbRes = await this.getConn().query(query)
    this.logger.debug('queryPendingSet:', query, dbRes)
    return _.map(dbRes.rows, 'tx_hash')
  }

  async validateAndGroupPendingTxs(
    txHashes: Array<string>,
  ): Promise<[Array<string>, Array<string>]> {
    const txs = await this.selectPendingTxsOnly(txHashes)
    const validTxs = []
    const invalidTxs = []
    const nowMillis = (new Date()).getTime()
    for (const tx of txs) {
      const utxoInputs = (tx.inputs || []).filter(inp => inp.type === 'utxo')
        .map(({ txHash, index }) => {
          const utxo: UtxoInputType = {
            type: 'utxo',
            txId: txHash,
            idx: index,
          }
          return utxo
        })
      const isAllInputsFree = utxoInputs.length === 0 || (await this.utxosForInputsExists(utxoInputs))
      if (!isAllInputsFree) {
        this.logger.info('[DB.validateAndGroupPendingTxs] tx inputs already spent: ', tx)
        invalidTxs.push(tx.hash)
        continue
      }
      if (this.pendingTxsTimeoutMillis) {
        const lastUpdateTime = tx.last_update.getTime()
        const ageMillis = nowMillis - lastUpdateTime
        if (ageMillis > this.pendingTxsTimeoutMillis) {
          this.logger.info('[DB.validateAndGroupPendingTxs] tx has timed out: ', tx)
          invalidTxs.push(tx.hash)
          continue
        }
      }
      validTxs.push(tx.hash)
    }
    return [_.uniq(validTxs), _.uniq(invalidTxs)]
  }

  async groupPendingTxsForSnapshot(
    newConfirmedTxHashes: Array<string>): Promise<[Array<string>, Array<string>]> {
    const pendingSet = await this.queryPendingSet()
    const txsInPendingState = _.difference(pendingSet, newConfirmedTxHashes)
    const [pendingTxs, invalidTxs] = await this.validateAndGroupPendingTxs(txsInPendingState)
    return [pendingTxs, invalidTxs]
  }

  async storeNewPendingSnapshot(block: Block, snapshot: Array<string>) {
    if (_.isEmpty(snapshot)) {
      this.logger.debug('storeNewPendingSnapshot: No pending txs added to snapshot..')
      return
    }
    const dbFields = snapshot.map(txHash => ({
      tx_hash: txHash,
      block_hash: block.getHash(),
      block_num: block.getHeight(),
      status: TX_STATUS.TX_PENDING_STATUS,
    }))
    const sql = Q.sql.insert().into(SNAPSHOTS_TABLE)
      .setFieldsRows(dbFields).toString()
    this.logger.debug('storeNewPendingSnapshot: ', snapshot, sql)
    await this.getConn().query(sql)
  }

  async addNewTxsToTransientSnapshots(txHashes: string|Array<string>, txStatus: string) {
    if (!Array.isArray(txHashes)) {
      txHashes = [txHashes]
    }
    this.logger.debug('addNewTxsToTransientSnapshots:', txHashes, txStatus)
    if (_.isEmpty(txHashes)) {
      this.logger.debug('addNewTxsToTransientSnapshots: No tx is provided')
      return
    }
    if (txStatus !== TX_STATUS.TX_PENDING_STATUS && txStatus !== TX_STATUS.TX_FAILED_STATUS) {
      throw new Error(`[addNewTxToTransientSnapshots] Incorrect tx status: ${txStatus}! 
       Expected one of: '${TX_STATUS.TX_PENDING_STATUS}' or '${TX_STATUS.TX_FAILED_STATUS}'`)
    }
    const { hash, height } = await this.getBestBlockNum()
    const dbFields = txHashes.map(txHash => ({
      tx_hash: txHash,
      block_hash: hash,
      block_num: height,
      status: txStatus,
    }))
    const sql = Q.sql.insert()
      .into(SNAPSHOTS_TABLE)
      .setFieldsRows(dbFields)
      .onConflict()
      .toString()
    this.logger.debug('addNewTxsToTransientSnapshots: ', sql)
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
    this.logger.debug('queryFailedSet:', sql, dbRes)
    return _.map(dbRes.rows, 'hash')
  }

  async storeNewFailedSnapshot(block: Block, invalidTxs: Array<string>) {
    const failedSet = [
      ...(await this.queryFailedSet()),
      ...invalidTxs,
    ]
    if (_.isEmpty(failedSet)) {
      this.logger.debug('storeNewFailedSnapshot: No failed txs added to snapshot..')
      return
    }
    const dbFields = _.uniq(failedSet).map(txHash => ({
      tx_hash: txHash,
      block_hash: block.getHash(),
      block_num: block.getHeight(),
      status: TX_STATUS.TX_FAILED_STATUS,
    }))
    const sql = Q.sql.insert().into(SNAPSHOTS_TABLE)
      .setFieldsRows(dbFields).toString()
    this.logger.debug('storeNewFailedSnapshot: ', sql)
    await this.getConn().query(sql)
  }

  async updateTxsStatus(txs: Array<string>, status: string) {
    const now = new Date().toUTCString()
    const sql = Q.sql.update().table('txs')
      .set('tx_state', status)
      .set('last_update', now)
      .where('hash IN ?', txs)
      .toString()
    return this.getConn().query(sql)
  }

  async storeNewSnapshot(block: Block) {
    const txHashes = _.map(block.getTxs(), 'id')
    const [pendingTxs, invalidTxs] = await this.groupPendingTxsForSnapshot(txHashes)
    if (!_.isEmpty(invalidTxs)) {
      await this.updateTxsStatus(invalidTxs, TX_STATUS.TX_FAILED_STATUS)
    }
    await this.storeNewPendingSnapshot(block, pendingTxs)
    await this.storeNewFailedSnapshot(block, invalidTxs)
  }

  async collectTxsData(block: Block): Promise<BlockTxsDataType> {
    const txs = block.getTxs()
    const newUtxos = utils.getTxsUtxos(txs)
    const blockUtxos = []
    const requiredInputs = []
    const requiredUtxoIds = []
    for (const tx of txs) {
      requiredInputs.push(...tx.inputs.filter(inp => {
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
              type: 'utxo',
            })
            // Delete new Utxo if it's already spent in the same block
            delete newUtxos[utxoId]
            // Remove this input from required
            return false
          }
          requiredUtxoIds.push(utxoId)
          return true
        }
        return false
      }))
    }
    this.logger.debug('collectTxsData.requiredUtxo', requiredUtxoIds)
    const availableUtxos = await this.getUtxos(requiredUtxoIds)
    const allUtxoMap = _.keyBy([...availableUtxos, ...blockUtxos], 'id')
    return {
      allUtxoMap,
      newUtxos,
      requiredUtxoIds,
    }
  }


  async storeBlockTxs(block: Block) {
    // TODO: Do we need to serialize more in shelley?
    const hash = block.getHash()
    const epoch = block.getEpoch()
    const slot = block.getSlot()
    const txs = block.getTxs()
    const {
      allUtxoMap,
      newUtxos,
      requiredUtxoIds,
    } = await this.collectTxsData(block)
    this.logger.debug(`storeBlockTxs (${epoch}/${String(slot)}, ${hash}, ${block.getHeight()})`)
    /* eslint-disable no-plusplus */
    for (const tx of txs) {
      const utxos = tx.inputs
        .filter(inp => inp.type === 'utxo')
        .map(input => allUtxoMap[utils.getUtxoId(input)])
        .filter(x => x)
      this.logger.debug('storeBlockTxs.storeTx', tx.id)
      await this.storeTx(tx, utxos)
    }
    await this.storeUtxos(Object.values(newUtxos))
    if (requiredUtxoIds.length > 0) {
      await this.backupAndRemoveUtxos(requiredUtxoIds, block.getHeight())
    }
  }

  storePoolOwnersInfo(inputs: Array<TxInputType>): Promise<boolean> {
    this.logger.debug('Database.storePoolOwnersInfo not supported.', inputs)
    throw new Error('NOT SUPPORTED')
  }

  getLatestPoolOwnerHashes(): Promise<{}> {
    this.logger.debug('Database.getLatestPoolOwnerHashes not supported.')
    throw new Error('NOT SUPPORTED')
  }

  async doInTransaction(callback: Function): Promise<any> {
    const dbConn = this.getConn()
    try {
      await dbConn.query('BEGIN')
      const result = await callback(dbConn)
      await dbConn.query('COMMIT')
      return result
    } catch (e) {
      await dbConn.query('ROLLBACK')
      throw e
    }
  }
}


helpers.annotate(DB, [
  { type: SERVICE_IDENTIFIER.DB_CONNECTION, named: 'dbConnection' },
  SERVICE_IDENTIFIER.LOGGER,
  'pendingTxsTimeoutMinutes',
])

export default DB
