// @flow

// hex-encoded pool-id
export type PoolIdType = string;

export const CERT_TYPE = {
  PoolRegistration: 'PoolRegistration',
  PoolRetirement: 'PoolRetirement',
  PoolUpdate: 'PoolUpdate',
  StakeDelegation: 'StakeDelegation',
}

type CertificateCommonType = {
  payload: {
    payloadKind: string,
    // hex-encoded raw binary payload of the certificate
    payloadHex: string,
  },
}

export type PoolRegistrationType = {
  ...CertificateCommonType,
  type: 'PoolRegistration',
  pool_id: PoolIdType,
  start_validity: number,
  owners: Array<string>,
  operators: Array<string>,
  rewardAccount: string|null,
  rewards: {
    fixed: number,
    ratio: [number, number],
    limit: number|null,
  },
  keys: {
    kes_beck32: string,
    vrf_beck32: string,
  }
}

export type PoolRetirementType = {
  ...CertificateCommonType,
  type: 'PoolRetirement',
  pool_id: PoolIdType,
  // TODO: store time-offset? store slot it expires in?
  retirement_time: number,
}

export type PoolUpdateType = {
  ...CertificateCommonType,
  type: 'PoolUpdate',
  // do we need this in seiza?
  pool_id: PoolIdType,
}

export type StakeDelegationType = {
  ...CertificateCommonType,
  type: 'StakeDelegation',
  pool_id: ?PoolIdType,
  account: string,
  isOwnerStake: boolean,
}

export type CertificateType =
  PoolRegistrationType |
  PoolRetirementType |
  PoolUpdateType |
  StakeDelegationType
