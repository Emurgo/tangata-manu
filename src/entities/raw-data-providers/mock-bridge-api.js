// @flow

import CardanoBridgeApi from './cardano-brdige-api'

class MockBridgeApi extends CardanoBridgeApi {
  async getTip() {
    const resp = await super.getTip()
    return resp
  }
}

export default MockBridgeApi
