// @flow

import { CERT_TYPE } from './certificate'

const fragmentToObj = (fragment: any, extraData: {}) => {
  // TODO: proper parsing - need to parse other tx types (certs) + parse witnesses
  const common = {
    id: Buffer.from(fragment.id().as_bytes()).toString('hex'),
  }
  if (fragment.is_initial()) {
    console.log('\n\n\n\nINITIAL\n\n\n\n')
  }
  if (fragment.is_owner_stake_delegation()) {
    console.log('\n\n\nOWNER STAKE DELEGATION\n\n\n\n')
  }
  if (fragment.is_stake_delegation()) {
    console.log('\n\n\n\nSTAKE DELEGATION\n\n\n\n')
  }
  if (fragment.is_pool_registration()) {
    console.log('\n\n\n\nPOOL REGISTRATION\n\n\n\n')
  }
  if (fragment.is_pool_retirement()) {
    console.log('\n\n\n\nPOOL MANAGEMENT\n\n\n\n')
  }
  if (fragment.is_old_utxo_declaration()) {
    console.log('\n\n\n\nOLD UTXO\n\n\n\n')
  }
  if (fragment.is_update_proposal()) {
    console.log('\n\n\n\nUPDATE PROPOSAL\n\n\n\n')
  }
  if (fragment.is_update_vote()) {
    console.log('\n\n\n\nUPDATE VOTE\n\n\n\n')
  }
  const tx = fragment.get_transaction()
  const inputs = tx.inputs()
  const inputs_parsed = []
  for (let input_index = 0; input_index < inputs.size(); input_index += 1) {
    const input = inputs.get(input_index)
    console.log(`tx input type: ${input.get_type()}`)
    if (input.is_utxo()) {
      const utxo = input.get_utxo_pointer()
      const txId = Buffer.from(utxo.fragment_id().as_bytes()).toString('hex')
      inputs_parsed.push(TxInputType.fromUtxo(txId, utxo.output_index()))
    } else {
      const account = input.get_account().to_identifier()
      // TODO: Values are returned as strings under the rationale that js strings
      // can only fit a 52-bit radix as integers, but since the max ADA supply is smaller
      // than this (but bigger than a 32-bit int) this should be safe. We should try and
      // see if this can be changed in js-chain-libs and use that there instead.
      inputs_parsed.push({
        type: 'account',
        account_id: account.to_hex(),
        value: parseInt(input.value().to_str(), 10),
      })
    }
  }
  const outputs = tx.outputs()
  const outputs_parsed = []
  for (let output_index = 0; output_index < outputs.size(); output_index += 1) {
    const output = outputs.get(output_index)
    outputs_parsed.push({
      // TODO: what bech prefix do we put here?
      address: output.address().to_string('tc'),
      // See comment for input values
      value: parseInt(output.value().to_str(), 10),
    })
  }
  const cert = tx.certificate !== undefined ? tx.certificate() : null
  if (cert) {
    switch (cert.get_type()) {
      case 'PoolRegistration': {
        const reg = cert.get_pool_registration()
        const pool_keys = reg.owners()
        const pool_owners = []
        for (let i = 0; i < pool_keys.size(); i += 1) {
          const keyBytes = Buffer.from(pool_keys.get(i).as_bytes())
          pool_owners.push(keyBytes.toString('hex'))
        }
        common.certificate = {
          type: 'PoolRegistration',
          pool_id: reg.id().to_string(),
          // we should be able to do this considering js max int would be 28,5616,414 years
          start_validity: parseInt(reg.start_validity().to_string(), 10),
          owners: pool_owners,
        }
        break
      }
      case CERT_TYPE.StakeDelegation: {
        const deleg = cert.get_stake_delegation()
        common.certificate = {
          type: CERT_TYPE.StakeDelegation,
          // TODO: handle DelegationType parsing
          // pool_id: deleg.pool_id().to_string(),
          pool_id: 'TODO: handle DelegationType parsing',
          account: deleg.account().to_hex(),
        }
        break
      }
      case 'PoolRetirement': {
        const retire = cert.get_pool_retirement()
        common.certificate = {
          type: 'PoolRetirement',
          pool_id: retire.pool_id().to_string(),
          // we should be able to do this considering js max int would be 28,5616,414 years
          retirement_time: parseInt(retire.retirement_time().to_string(), 10),
        }
        break
      }
      case 'PoolUpdate':
        console.log('\n\n\n\n\n========\n\nPOOL UPDATE FOUND\n\n\n')
        break
      case 'OwnerStakeDelegation':
        console.log('\n\n\n\n\n========\n\nOWNER STAKE DELEGATION FOUND\n\n\n')
        break
      default:
        break
        // throw new Error(`parsing certificate type not implemented${cert.get_type()}`)
    }
  }
  const ret = {
    inputs: inputs_parsed,
    outputs: outputs_parsed,
    witnesses: [],
    ...common,
    ...extraData,
  }
  console.log(`parsed a tx: \n${JSON.stringify(ret)}\n`)
  return ret
}

const rawTxToObj = (tx: Array<any>) => {
  const wasm = global.jschainlibs
  return fragmentToObj(wasm.Block.from_bytes(tx))
}

export default {
  rawTxToObj,
  fragmentToObj,
}
