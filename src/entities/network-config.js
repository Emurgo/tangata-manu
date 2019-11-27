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

  #networkMagic: number

  #networkProtocol: string

  constructor() {
    this.#networkName = process.env.importer_network || config.get('defaultNetwork')
    const network = utils.getNetworkConfig(this.#networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, this.#networkName)
    this.#genesisHash = network.genesis
    this.#startTime = network.startTime
    this.#networkMagic = network.networkMagic
    this.#networkProtocol = network.protocol
  }

  networkName = () => this.#networkName

  startTime = () => this.#startTime

  genesisHash = () => this.#genesisHash

  networkUrl = () => this.#networkBaseUrl

  networkMagic = () => this.#networkMagic

  networkProtocol = () => this.#networkProtocol || NETWORK_PROTOCOL.BYRON
}

helpers.annotate(NetworkConfigImp, [])

export default NetworkConfigImp
