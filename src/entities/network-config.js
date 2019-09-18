// @flow

import { helpers } from 'inversify-vanillajs-helpers'
import config from 'config'

import urljoin from 'url-join'

import utils from '../utils'
import type { NetworkConfig } from '../interfaces/network-config'

class NetworkConfigImp implements NetworkConfig {
  #networkName: string

  #networkBaseUrl: string

  #genesisHash: string

  #startTime: number

  #networkMagic: number

  constructor() {
    this.#networkName = process.env.importer_network || config.get('defaultNetwork')
    const network = utils.getNetworkConfig(this.#networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, this.#networkName)
    this.#genesisHash = network.genesis
    this.#startTime = network.startTime
    this.#networkMagic = network.networkMagic
  }

  networkName = () => this.#networkName

  startTime = () => this.#startTime

  genesisHash = () => this.#genesisHash

  networkUrl = () => this.#networkBaseUrl

  networkMagic = () => this.#networkMagic
}

helpers.annotate(NetworkConfigImp, [])

export default NetworkConfigImp
