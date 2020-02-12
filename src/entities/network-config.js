// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import config from 'config'

import urljoin from 'url-join'

import { getNetworkConfig } from '../utils'
import type { NetworkConfig } from '../interfaces/network-config'

export const NETWORK_PROTOCOL = {
  BYRON: 'byron',
  SHELLEY: 'shelley',
}

export const DATA_PROVIDER = {
  CARDANO_EXPLORER: 'cardano-explorer',
  CARDANO_BRIDGE: 'cardano-http-bridge',
  JORMUNGANDR: 'jormungandr',
}

const BYRON_DEFAULTS = {
  slotsPerEpoch: 21600,
  slotDurationSeconds: 20,
}

class NetworkConfigImp implements NetworkConfig {
  #networkName: string

  #networkBaseUrl: string

  #genesisHash: string

  #startTime: number

  #slotsPerEpoch: number

  #slotDurationSeconds: number

  #networkMagic: number

  #networkProtocol: string

  #networkDiscrimination: ?string

  #dataProvider: ?string

  constructor() {
    this.#networkName = process.env.importer_network || config.get('defaultNetwork')
    const network = getNetworkConfig(this.#networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, this.#networkName)
    this.#genesisHash = network.genesis
    this.#startTime = network.startTime
    this.#slotsPerEpoch = network.slotsPerEpoch || BYRON_DEFAULTS.slotsPerEpoch
    this.#slotDurationSeconds = network.slotDurationSeconds || BYRON_DEFAULTS.slotDurationSeconds
    this.#networkMagic = network.networkMagic
    this.#networkProtocol = network.protocol
    this.#networkDiscrimination = network.networkDiscrimination
    this.#dataProvider = network.dataProvider
  }

  networkName = () => this.#networkName

  dataProvider = () => {
    if (this.#dataProvider !== undefined) {
      return this.#dataProvider
    }
    if (this.networkProtocol() === NETWORK_PROTOCOL.BYRON) {
      return DATA_PROVIDER.CARDANO_BRIDGE
    }
    return DATA_PROVIDER.JORMUNGANDR
  }

  startTime = () => this.#startTime

  slotsPerEpoch = () => this.#slotsPerEpoch

  slotDurationSeconds = () => this.#slotDurationSeconds

  genesisHash = () => this.#genesisHash

  networkUrl = () => this.#networkBaseUrl

  networkMagic = () => this.#networkMagic

  networkProtocol = () => this.#networkProtocol || NETWORK_PROTOCOL.BYRON

  networkDiscrimination = () => {
    const addrDiscrimantion = global.jschainlibs.AddressDiscrimination
    return this.#networkDiscrimination === 'test' ? addrDiscrimantion.Test : addrDiscrimantion.Production
  }
}

helpers.annotate(NetworkConfigImp, [])

export default NetworkConfigImp
