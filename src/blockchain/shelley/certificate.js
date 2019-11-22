// @flow

// hex-encoded pool-id
export type PoolId = String;

export type PoolRegistration = {
  type: 'PoolRegistration',
  pool_id: PoolId,
  start_validity: string,
  owners: [string],
}

export type PoolRetirement = {
  type: 'PoolRetirement',
  pool_id: PoolId,
  // TODO: store time-offset? store slot it expires in?
  retirement_time: number,
}

export type PoolUpdate = {
  type: 'PoolUpdate',
  // do we need this in seiza?
  pool_id: PoolId,
}

export type StakeDelegation = {
  type: 'StakeDelegation',
  // null here signifies NonDelegated, ie un-delegate
  pool_id: ?PoolId,
  account: string,
}

export type OwnerStakeDelegation = {
  type: 'OwnerStakeDelegation',
  // null here signifies NonDelegated, ie un-delegate
  pool_id: ?PoolId,
  // this is not in the certificate, but was inferred from the tx
  account: string,
}

export type Certificate = PoolRegistration | PoolRetirement | PoolUpdate | StakeDelegation
