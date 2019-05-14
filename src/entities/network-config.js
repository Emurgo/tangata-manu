import { helpers } from 'inversify-vanillajs-helpers'
import config from 'config'

import {
  Logger,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'

import utils from '../utils'
import type { NetworkConfig } from "../interfaces/network-config";
import urljoin from "url-join";

class NetworkConfigImp implements NetworkConfig {

  #logger: any

  #networkName: string

  #networkBaseUrl: string

  #genesisHash: string

  #startTime: number

  constructor(
    logger: Logger,
  ) {
    this.#networkName = process.env['importer_network'] || config.get('defaultNetwork')
    const network = utils.getNetworkConfig(this.#networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, this.#networkName)
    this.#genesisHash = network.genesis
    this.#startTime = network.startTime
    this.#logger = logger
    logger.info(`Initialized network config for: "${this.#networkName}" (@ ${this.#networkBaseUrl})`)
  }

  networkName = () => this.#networkName

  startTime = () => this.#startTime

  genesisHash = () => this.#genesisHash

  networkUrl = () => this.#networkBaseUrl
}

helpers.annotate(NetworkConfigImp,
  [
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default NetworkConfigImp
