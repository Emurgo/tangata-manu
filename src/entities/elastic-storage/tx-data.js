// @flow
/* eslint-disable no-param-reassign */

import _ from 'lodash'

import BigNumber from 'bignumber.js'
import type { TxType } from '../../blockchain/common'
import { utils } from '../../blockchain/common'

import ElasticData, { coinFormat } from './elastic-data'
import UtxoData from './utxo-data'
import InputData from './input-data'
import AccountInputData from "./account-input-data";
import AccountOutputData from "./account-output-data";
import { shelleyUtils } from "../../blockchain/shelley";
import { CERT_TYPE } from "../../blockchain/shelley/certificate";

class TxData extends ElasticData {
  tx: TxType

  resolvedInputs: Array<InputData>

  resolvedOutputs: Array<UtxoData>

  sumInputs: number

  sumOutputs: number

  fee: number

  newAddresses: number

  txTrackedState: { [string]: any }

  addressStates: Array<{ [string]: any }>

  poolStates: Array<{ [string]: any }>

  delegationStates: Array<{ [string]: any }> = []

  constructor(
    tx: TxType,
    inputsUtxos: {} = {},
    txTrackedState: { [string]: any } = {},
    addressStates: { [string]: any } = {},
    poolDelegationStates: { [string]: any } = {},
  ) {
    super()
    this.tx = tx

    this.resolvedInputs = tx.inputs.map((inp, idx) => {
      if (inp.type === 'account') {
        return new AccountInputData(inp, tx, idx)
      }
      const id = utils.getUtxoId(inp)
      const inputUtxo = inputsUtxos[id]
      if (!inputUtxo) {
        throw new Error(`UTxO '${id}' is not found for tx '${tx.id}'!`)
      }
      return new InputData(inp, idx, inputUtxo, tx)
    })

    this.resolvedOutputs = tx.outputs.map((out, idx) => {
      if (out.type === 'account') {
        return new AccountOutputData(out, tx, idx)
      }
      return new UtxoData({
        receiver: out.address,
        amount: out.value,
        tx_index: idx,
        block_hash: tx.blockHash,
        tx_hash: tx.id,
      })
    })

    const prevSupply: BigNumber = txTrackedState.supply_after_this_tx

    if (this.resolvedInputs.length === 1
     && this.resolvedOutputs.length === 1
     && this.resolvedInputs[0].getAmount() === this.resolvedOutputs[0].getAmount()) {
      const value = this.resolvedInputs[0].getAmount()

      this.sumInputs = value
      this.sumOutputs = value
      this.fee = 0

      // This is a redemption tx that increases the total supply of coin
      txTrackedState.supply_after_this_tx = prevSupply.plus(value)
    } else {
      this.sumInputs = _.sumBy(this.resolvedInputs, x => x.getAmount())
      this.sumOutputs = _.sumBy(this.resolvedOutputs, x => x.getAmount())
      this.fee = Math.max(0, this.sumInputs - this.sumOutputs)

      if (!tx.isGenesis) {
        // This is a regular tx - fees are burned from the total supply
        txTrackedState.supply_after_this_tx = prevSupply.minus(this.fee)
      }
    }
    this.txTrackedState = { ...txTrackedState }

    // Aggregate all inputs/outputs into a "diff" object
    const txAddressDiff: { [string]: any } = {}
    for (const io of [...this.resolvedInputs, ...this.resolvedOutputs]) {
      const receiver = io.getRelatedAddress()
      const amount = io.getAmount()
      const isInput = io.isInput()
      const isAccount = io.isAccount()
      const balanceDiff = isInput ? -amount : amount
      const {
        addressBalanceDiff = 0,
        accountDelegationDiff = 0,
        isAddressInput = false,
        isAddressOutput = false,
      } = txAddressDiff[receiver] || {}
      txAddressDiff[receiver] = {
        isAddressAccount: isAccount,
        addressBalanceDiff: addressBalanceDiff + balanceDiff,
        isAddressInput: isAddressInput || isInput,
        isAddressOutput: isAddressOutput || !isInput,
        ...(isAccount ? {
          // If account balance itself is changed - delegation sum changes accordingly
          accountDelegationDiff: accountDelegationDiff + balanceDiff
        } : {}),
      }
      if (!isAccount) {
        const { type, accountAddress } = shelleyUtils.splitGroupAddress(receiver)
        if (type === 'group' && accountAddress) {
          // Group address also changes state for its linked accont
          const {
            addressBalanceDiff = 0,
            accountDelegationDiff = 0,
            isAddressInput = false,
            isAddressOutput = false,
          } = txAddressDiff[accountAddress] || {}
          txAddressDiff[accountAddress] = {
            isAddressAccount: true,
            // account balance does not change
            addressBalanceDiff: addressBalanceDiff,
            // account itself is not used as either input or output in this particular case
            // but it might have been additionally used in the same transaction, so we are preserving the flags
            isAddressInput: isAddressInput,
            isAddressOutput: isAddressOutput,
            // Delegation sum per account changes with the same value
            accountDelegationDiff: accountDelegationDiff + balanceDiff,
          }
        }
      }
    }

    if (tx.certificate) {
      const cert = tx.certificate
      if (cert.type === CERT_TYPE.StakeDelegation) {
        const { pool_id, account, isOwnerStake } = cert
        const accountDiff = txAddressDiff[account] || {}
        txAddressDiff[account] = {
          ...accountDiff,
          isAddressAccount: true,
          newDelegatedPool: pool_id,
        }
        // For currently delegated pool - reduce the delegation sum
        const {
          balance_after_this_tx,
          delegated_pool_after_this_tx,
        } = addressStates[account] || {}
        // If account is already delegating to ANOTHER pool
        if (delegated_pool_after_this_tx) {
          if (delegated_pool_after_this_tx === pool_id) {
            // New certificate delegates to the same pool as before
            // In that case - no pool delegation state changed here
            // And we are marking the cert as repeat
            cert.isRepeat = true
          } else {
            const {
              delegation_after_this_tx = 0,
              state_ordinal = 0,
            } = poolDelegationStates[delegated_pool_after_this_tx] || {}
            const newState = {
              pool_id: delegated_pool_after_this_tx,
              delegation_after_this_tx: delegation_after_this_tx - balance_after_this_tx,
              state_ordinal: state_ordinal + 1,
            }
            poolDelegationStates[delegated_pool_after_this_tx] = newState
            this.delegationStates.push(newState)
          }
        }
      }
    }

    // Apply the aggregated diff to the address state
    let newAddresses = 0
    for (const address of Object.keys(txAddressDiff)) {
      const {
        isAddressAccount,
        addressBalanceDiff = 0,
        accountDelegationDiff = 0,
        isAddressInput,
        isAddressOutput,
        newDelegatedPool,
      } = txAddressDiff[address]
      const {
        balance_after_this_tx = 0,
        delegation_after_this_tx = 0,
        delegated_pool_after_this_tx = null,
        tx_num_after_this_tx = 0,
        received_tx_num_after_this_tx = 0,
        sent_tx_num_after_this_tx = 0,
        state_ordinal = 0,
        isNewAddress = false,
      } = addressStates[address] || {
        isNewAddress: true,
      }
      if (isNewAddress) {
        newAddresses += 1
      }
      const newState = {
        address,
        is_account: isAddressAccount,
        balance_after_this_tx: balance_after_this_tx + addressBalanceDiff,
        ...(isAddressAccount ? {
          delegation_after_this_tx: delegation_after_this_tx + accountDelegationDiff,
          delegated_pool_after_this_tx: newDelegatedPool || delegated_pool_after_this_tx,
        } : {}),
        tx_num_after_this_tx: tx_num_after_this_tx + (isAddressInput || isAddressOutput ? 1 : 0),
        sent_tx_num_after_this_tx: sent_tx_num_after_this_tx + (isAddressInput ? 1 : 0),
        received_tx_num_after_this_tx: received_tx_num_after_this_tx + (isAddressOutput ? 1 : 0),
        state_ordinal: state_ordinal + 1,
        ...(isNewAddress ? { new_address: true } : {}),
      }
      addressStates[address] = newState
    }

    if (tx.certificate) {
      const cert = tx.certificate
      if (cert.type === CERT_TYPE.PoolRegistration) {
        const { pool_id, owners, start_validity, operators, rewardAccount } = cert
        this.poolStates = [{
          pool_id, owners, operators, rewardAccount, start_validity,
          type: 'new',
          cert_num_per_pool: 1,
        }]
      } else if (cert.type === CERT_TYPE.StakeDelegation && !cert.isRepeat) {
        const { pool_id, account, isOwnerStake } = cert
        const accountState = addressStates[account];
        const { balance_after_this_tx = 0 } = accountState
        if (pool_id && accountState && balance_after_this_tx > 0) {
          const {
            delegation_after_this_tx = 0,
            state_ordinal = 0,
          } = poolDelegationStates[pool_id] || {}
          const newState = {
            pool_id,
            delegation_after_this_tx: delegation_after_this_tx + accountBalance,
            state_ordinal: state_ordinal + 1,
          }
          poolDelegationStates[pool_id] = newState
          this.delegationStates.push(newState)
        }
      }
    }

    const txAddressStates = []
    for (const address of Object.keys(txAddressDiff)) {
      txAddressStates.push({
        ...addressStates[address],
      })
    }

    this.addressStates = txAddressStates
    this.newAddresses = newAddresses
  }

  static fromGenesisUtxo(utxo: any, networkStartTime: number) {
    return new TxData({
      blockHash: null,
      blockNum: null,
      inputs: [],
      isGenesis: true,
      txBody: '',
      txOrdinal: 0,
      txTime: new Date(networkStartTime * 1000),
      witnesses: [],
      id: utxo.tx_hash,
      branch: 0,
      outputs: [
        {
          address: utxo.receiver,
          value: utxo.amount,
          ...utxo,
        },
      ],
    })
  }

  getOutputsData() {
    return this.resolvedOutputs.map(o => o.toPlainObject())
  }

  getInputsData() {
    return this.resolvedInputs.map(i => i.toPlainObject())
  }

  toPlainObject() {
    const certificate = this.tx.certificate
    return {
      ...TxData.getBaseFields(),
      is_genesis: this.tx.isGenesis || false,
      hash: this.tx.id,
      tx_ordinal: this.tx.txOrdinal,
      block_hash: this.tx.blockHash,
      addresses: this.addressStates.map(s => ({
        ...s,
        balance_after_this_tx: coinFormat(s.balance_after_this_tx),
        ...(s.delegation_after_this_tx ? {
          delegation_after_this_tx: coinFormat(s.delegation_after_this_tx),
        } : {}),
      })),
      outputs: this.getOutputsData(),
      inputs: this.getInputsData(),
      sum_inputs: coinFormat(this.sumInputs),
      sum_outputs: coinFormat(this.sumOutputs),
      fees: coinFormat(this.fee),
      new_addresses: this.newAddresses,
      time: this.tx.txTime.toISOString(),
      ...(this.tx.isGenesis ? {} : {
        supply_after_this_tx: coinFormat(this.txTrackedState.supply_after_this_tx),
      }),
      ...(certificate ? { certificates: [certificate] } : {}),
      ...(this.poolStates ? { pools: this.poolStates } : {}),
      delegation: this.delegationStates.map(s => ({
        ...s,
        delegation_after_this_tx: coinFormat(s.delegation_after_this_tx),
      })),
    }
  }
}

export default TxData
