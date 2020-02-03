// @flow

import { PublicKey } from 'js-chain-libs/js_chain_libs'
import type { PoolRegistrationType, PoolRetirementType, StakeDelegationType } from './certificate'
import { CERT_TYPE } from './certificate'
import type { ShelleyTxType } from './tx'
import { AddressKind } from '../../../js-chain-libs/pkg/js_chain_libs'

function free(...args) {
  for (const a of args) {
    if (a && a.free) {
      a.free()
    }
  }
}

function consumeAccountToOptionalAddress(account, discrimination, stringEncoding = 'hex'): ?string {
  if (!account) {
    return null
  }
  const address = account.to_address(discrimination)
  const result = Buffer.from(address.as_bytes()).toString(stringEncoding)
  free(address, account)
  return result
}

function consumeKeysToStrings(keys, stringEncoding = 'hex'): Array<string> {
  const result: Array<string> = []
  for (let i = 0; i < keys.size(); i += 1) {
    const key = keys.get(i)
    const keyBytes = Buffer.from(key.as_bytes())
    result.push(keyBytes.toString(stringEncoding))
    free(key)
  }
  free(keys)
  return result
}

// frees input rust-wasm Value and parses it into a js number
const consumeOptionalValueToNumber = (value: any): ?number => {
  // TODO: Values are returned as strings under the rationale that js strings
  // can only fit a 52-bit radix as integers, but since the max ADA supply is smaller
  // than this (but bigger than a 32-bit int) this should be safe. We should try and
  // see if this can be changed in js-chain-libs and use that there instead.
  if (!value) {
    return null
  }
  const str = value.to_str ? value.to_str() : value.to_string()
  const n = parseInt(str, 10)
  free(value)
  return n
}

// frees any generic rust-wasm id (anything with as_bytes()) and creates a hex string buffer from it
const consumeIdToHex = (id: any): string => {
  const hex = Buffer.from(id.as_bytes()).toString('hex')
  free(id)
  return hex
}

// Takes a Rust {PublicKey} type, frees it, and returns bech32 string
const consumeKeyToBech32 = (key: any): string => {
  const result = key.to_bech32()
  free(key)
  return result
}

const identifierToAddress = (identifier: string, networkDiscrimination: number) => {
  const wasm = global.jschainlibs
  const bytes = Buffer.from(identifier, 'hex')
  const accountIdentifier = wasm.AccountIdentifier.from_bytes(bytes)
  const account = accountIdentifier.to_account_single()
  const accountAddrHex = consumeIdToHex(account.to_address(networkDiscrimination))
  return accountAddrHex
}

const fragmentToObj = (fragment: any, networkDiscrimination: number,
  extraData: {txTime: Date}): ShelleyTxType => {
  const wasm = global.jschainlibs

  const common = {
    id: consumeIdToHex(fragment.id()),
    txBody: Buffer.from(fragment.as_bytes()).toString('hex'),
    blockNum: undefined,
    blockHash: undefined,
    status: undefined,
    txOrdinal: undefined,
    isGenesis: undefined,
    certificate: undefined,
  }
  const tx = fragment.get_transaction()
  const inputs = tx.inputs()
  const inputs_parsed = []
  for (let input_index = 0; input_index < inputs.size(); input_index += 1) {
    const input = inputs.get(input_index)
    console.log(`tx input type: ${input.get_type()}`)
    if (input.is_utxo()) {
      const utxo = input.get_utxo_pointer()
      inputs_parsed.push({
        type: 'utxo',
        txId: consumeIdToHex(utxo.fragment_id()),
        idx: utxo.output_index(),
      })
      utxo.free()
    } else {
      const accountIdentifier = input.get_account_identifier()
      const account = accountIdentifier.to_account_single()
      const accountAddrHex = consumeIdToHex(account.to_address(networkDiscrimination))
      inputs_parsed.push({
        type: 'account',
        account_id: accountAddrHex,
        value: consumeOptionalValueToNumber(input.value()),
      })
      account.free()
      accountIdentifier.free()
    }
    input.free()
  }
  inputs.free()
  const outputs = tx.outputs()
  const outputs_parsed = []
  for (let output_index = 0; output_index < outputs.size(); output_index += 1) {
    const output = outputs.get(output_index)
    const addr = output.address()
    let outputType = 'utxo'
    switch (addr.get_kind()) {
      case wasm.AddressKind.Account:
      case wasm.AddressKind.Multisig:
        // should multisig be just account, or will we need more info later?
        outputType = 'account'
        break
      case wasm.AddressKind.Single:
      case wasm.AddressKind.Group:
        outputType = 'utxo'
        break
      default:
        break
    }
    outputs_parsed.push({
      type: outputType,
      address: consumeIdToHex(output.address()),
      value: consumeOptionalValueToNumber(output.value()),
    })
    addr.free()
    output.free()
  }
  outputs.free()
  const cert = tx.certificate !== undefined ? tx.certificate() : null
  if (cert) {
    const payload = Buffer.from(cert.as_bytes()).toString('hex')
    switch (cert.get_type()) {
      case wasm.CertificateKind.PoolRegistration: {
        const reg = cert.get_pool_registration()
        const reg_owners = consumeKeysToStrings(reg.owners())
        const reg_operators = consumeKeysToStrings(reg.operators())
        const rewardAccountAddress = consumeAccountToOptionalAddress(
          reg.reward_account(), networkDiscrimination)
        const rewards = reg.rewards()
        const keys = reg.keys()
        const poolId = reg.id()
        const startValidity = reg.start_validity()
        const parsedCert: PoolRegistrationType = {
          payload: {
            payloadKind: 'PoolRegistration',
            payloadKindId: wasm.CertificateKind.PoolRegistration,
            payloadHex: payload,
          },
          type: CERT_TYPE.PoolRegistration,
          pool_id: poolId.to_string(),
          // we should be able to do this considering js max int would be 285,616,414 years
          start_validity: parseInt(reg.start_validity().to_string(), 10),
          owners: reg_owners,
          operators: reg_operators,
          rewardAccount: rewardAccountAddress,
          rewards: {
            fixed: consumeOptionalValueToNumber(rewards.fixed()) || 0,
            ratio: [
              consumeOptionalValueToNumber(rewards.ratio_numerator()) || 0,
              consumeOptionalValueToNumber(rewards.ratio_denominator()) || 0,
            ],
            limit: consumeOptionalValueToNumber(rewards.max_limit()),
          },
          keys: {
            kes_bech32: consumeKeyToBech32(keys.kes_pubkey()),
            vrf_bech32: consumeKeyToBech32(keys.vrf_pubkey()),
          },
        }
        common.certificate = parsedCert
        free(startValidity, poolId, rewards, keys, reg)
        break
      }
      case wasm.CertificateKind.StakeDelegation: {
        const deleg = cert.get_stake_delegation()
        const delegationType = deleg.delegation_type()
        const poolId = delegationType.get_full()
        const accountIdentifier = deleg.account()
        const parsedCert: StakeDelegationType = {
          payload: {
            payloadKind: 'StakeDelegation',
            payloadKindId: wasm.CertificateKind.StakeDelegation,
            payloadHex: payload,
          },
          type: CERT_TYPE.StakeDelegation,
          // TODO: handle DelegationType parsing
          pool_id: poolId != null ? poolId.to_string() : null,
          account: consumeAccountToOptionalAddress(accountIdentifier.to_account_single(),
            networkDiscrimination),
          isOwnerStake: false,
        }
        common.certificate = parsedCert
        free(accountIdentifier, poolId, delegationType, deleg)
        break
      }
      case wasm.CertificateKind.PoolRetirement: {
        const retire = cert.get_pool_retirement()
        const retirementTime = retire.retirement_time()
        const parsedCert: PoolRetirementType = {
          payload: {
            payloadKind: 'PoolRetirement',
            payloadKindId: wasm.CertificateKind.PoolRetirement,
            payloadHex: payload,
          },
          type: CERT_TYPE.PoolRetirement,
          pool_id: retire.pool_id().to_string(),
          // we should be able to do this considering js max int would be 28,5616,414 years
          retirement_time: parseInt(retirementTime.to_string(), 10),
        }
        retirementTime.free()
        retire.free()
        common.certificate = parsedCert
        break
      }
      case wasm.CertificateKind.PoolUpdate:
        break
      case wasm.CertificateKind.OwnerStakeDelegation: {
        if (inputs_parsed.length !== 1 || inputs_parsed[0].type !== 'account') {
          throw new Error(`Malformed OwnerStakeDelegation. Expected 1 account input, found: ${JSON.stringify(inputs_parsed)}`)
        }
        const deleg = cert.get_owner_stake_delegation()
        const delegationType = deleg.delegation_type()
        const poolId = delegationType.get_full()
        const parsedCert: StakeDelegationType = {
          payload: {
            payloadKind: 'OwnerStakeDelegation',
            payloadKindId: wasm.CertificateKind.OwnerStakeDelegation,
            payloadHex: payload,
          },
          type: CERT_TYPE.StakeDelegation,
          // TODO: possibly handle Ratio types
          pool_id: poolId != null ? poolId.to_string() : null,
          account: inputs_parsed[0].account_id,
          isOwnerStake: true,
        }
        if (poolId) {
          poolId.free()
        }
        delegationType.free()
        deleg.free()
        common.certificate = parsedCert
        break
      }
      default:
        break
        // throw new Error(`parsing certificate type not implemented${cert.get_type()}`)
    }
    cert.free()
  }
  const ret = {
    inputs: inputs_parsed,
    outputs: outputs_parsed,
    witnesses: [],
    ...common,
    ...extraData,
  }
  tx.free()
  return ret
}

const getAccountIdFromAddress = (accountAddressHex: string): {
  type: string,
  accountId?: string,
} => {
  const wasm = global.jschainlibs
  let address
  try {
    address = wasm.Address.from_bytes(Buffer.from(accountAddressHex, 'hex'))
  } catch (e) {
    return {
      type: 'unknown',
      comment: 'failed to parse as an address',
    }
  }
  const kind = address.get_kind()
  if (kind === AddressKind.Account) {
    const accountAddress = address.to_account_address()
    const accountKey = accountAddress.get_account_key()
    const result = {
      type: 'account',
      accountId: Buffer.from(accountKey.as_bytes()).toString('hex'),
    }
    accountKey.free()
    accountAddress.free()
    return result
  }
  address.free()
  return {
    type: 'unknown',
    comment: 'unsupported kind (no account id)',
  }
}

const splitGroupAddress = (groupAddressHex: string): {
  groupAddress?: {},
  accountAddress?: string,
  type: string,
} => {
  const wasm = global.jschainlibs
  let address
  try {
    address = wasm.Address.from_bytes(Buffer.from(groupAddressHex, 'hex'))
  } catch (e) {
    return {
      type: 'unknown',
      comment: 'failed to parse as an address',
    }
  }
  let result = null
  const kind = address.get_kind()
  if (kind === AddressKind.Group) {
    const groupAddress = address.to_group_address()
    if (groupAddress) {
      const spendingKey = groupAddress.get_spending_key()
      const accountKey = groupAddress.get_account_key()
      const discrim = address.get_discrimination()
      const singleAddress = wasm.Address.single_from_public_key(spendingKey, discrim)
      const accountAddress = wasm.Address.account_from_public_key(accountKey, discrim)
      const metadata = {
        type: 'group',
        groupAddress: groupAddressHex,
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
  } else if (kind === AddressKind.Single) {
    result = {
      type: 'utxo',
      utxoAddress: Buffer.from(address.as_bytes()).toString('hex'),
    }
  } else if (kind === AddressKind.Account) {
    result = {
      type: 'account',
      accountAddress: Buffer.from(address.as_bytes()).toString('hex'),
    }
  } else {
    // Unsupported type
    result = {
      type: 'unknown',
      comment: 'unsupported kind',
    }
  }
  address.free()
  return result
}

const publicKeyBechToHex = (bech: string): string => {
  const pk = PublicKey.from_bech32(bech)
  const hex = Buffer.from(pk.as_bytes()).toString('hex')
  free(pk)
  return hex
}

const rawTxToObj = (tx: Array<any>, networkDiscrimination: number,
  extraData: {txTime: Date}): ShelleyTxType => {
  const wasm = global.jschainlibs
  const fragment = wasm.Fragment.from_bytes(tx)
  const obj = fragmentToObj(fragment, networkDiscrimination, extraData)
  fragment.free()
  return obj
}

export default {
  rawTxToObj,
  fragmentToObj,
  splitGroupAddress,
  identifierToAddress,
  getAccountIdFromAddress,
  consumeValueToNumber: consumeOptionalValueToNumber,
  consumeIdToHex,
  publicKeyBechToHex,
}
