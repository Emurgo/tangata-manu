// @flow

const LOVELACE_IN_ADA = 1000000

export const coinFormat = (num: number) => ({
  integers: Math.floor(num / LOVELACE_IN_ADA),
  decimals: num % LOVELACE_IN_ADA,
  full: num,
})

class ElasticData {
  static getBaseFields() {
    return {
      branch: 0,
    }
  }
}

export default ElasticData
