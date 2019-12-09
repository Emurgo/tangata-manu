// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import config from 'config'

import urljoin from 'url-join'

import utils from '../utils'
import type { NetworkConfig } from '../interfaces/network-config'

export const NETWORK_PROTOCOL = {
  BYRON: 'byron',
  SHELLEY: 'shelley',
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

  constructor() {
    this.#networkName = process.env.importer_network || config.get('defaultNetwork')
    const network = utils.getNetworkConfig(this.#networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, this.#networkName)
    this.#genesisHash = network.genesis
    this.#startTime = network.startTime
    this.#slotsPerEpoch = network.slotsPerEpoch
    this.#slotDurationSeconds = network.slotDurationSeconds
    this.#networkMagic = network.networkMagic
    this.#networkProtocol = network.protocol
    this.#networkDiscrimination = network.networkDiscrimination
  }

  networkName = () => this.#networkName

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
