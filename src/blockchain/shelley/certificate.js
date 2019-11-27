// @flow

// hex-encoded pool-id
export type PoolId = string;

export const CERT_TYPE = {
  PoolRegistration: 'PoolRegistration',
  PoolRetirement: 'PoolRetirement',
  PoolUpdate: 'PoolUpdate',
  StakeDelegation: 'StakeDelegation',
}

export type PoolRegistration = {
  type: 'PoolRegistration',
  pool_id: PoolId,
  start_validity: number,
  owners: Array<string>,
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

export type StakeDelegationType = {
  type: 'StakeDelegation',
  pool_id: ?PoolId,
  account: string,
  isOwnerStake: boolean,
}

export type CertificateType = PoolRegistration | PoolRetirement | PoolUpdate | StakeDelegationType
