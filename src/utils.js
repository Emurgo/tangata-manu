// @flow

import config from 'config'

type NetworkConfigType = {
  bridgeUrl: string,
  genesis: string,
  startTime: number,
  networkMagic: number,
  protocol: string,
  networkDiscrimination?: string,
}

export const getNetworkConfig = (networkName: string): NetworkConfigType => {
  const network = { ...config.get('networks')[networkName] }
  network.bridgeUrl = network.bridgeUrl || config.get('defaultBridgeUrl')
  return network
}

export const sleep = (millis: number): Promise<void> => new Promise(
  resolve => setTimeout(resolve, millis))
