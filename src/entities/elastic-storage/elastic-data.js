// @flow

import BigNumber from 'bignumber.js'

const LOVELACE_IN_ADA = 1000000

export const coinFormat = (num: number|BigNumber) => {
  if (BigNumber.isBigNumber(num)) {
    return {
      integers: Math.floor(num.dividedBy(LOVELACE_IN_ADA).toNumber()),
      decimals: num.modulo(LOVELACE_IN_ADA).toNumber(),
      full: num.toNumber(), // the value here is approximate at large numbers
    }
  }
  return {
    integers: Math.floor(num / LOVELACE_IN_ADA),
    decimals: num % LOVELACE_IN_ADA,
    full: num,
  }
}

export const parseCoinToBigInteger = (
  { integers, decimals }: { integers: number, decimals: number },
): BigNumber => new BigNumber(integers).multipliedBy(LOVELACE_IN_ADA).plus(decimals)

class ElasticData {
  static getBaseFields() {
    return {
      branch: 0,
    }
  }
}

export default ElasticData
