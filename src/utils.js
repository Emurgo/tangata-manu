// @flow

import config from 'config'

type NetworkConfigType = {
  bridgeUrl: string,
  genesis: string,
  startTime: number,
  networkMagic: number,
}

const getNetworkConfig = (networkName: string): NetworkConfigType => {
  const network = { ...config.get('networks')[networkName] }
  network.bridgeUrl = network.bridgeUrl || config.get('defaultBridgeUrl')
  return network
}

export default {
  getNetworkConfig,
}
