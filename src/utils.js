// flow
import config from 'config'

const getNetworkConfig = (): {} => {
  const networkName = config.get('defaultNetwork')
  const network = { ...config.get('networks')[networkName] }
  network.bridgeUrl = network.bridgeUrl || config.get('defaultBridgeUrl')
  return network
}

export default {
  getNetworkConfig,
}
