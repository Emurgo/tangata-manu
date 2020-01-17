// @flow

import { Container } from 'inversify'

import SERVICE_IDENTIFIER from '../constants/identifiers'

import { NETWORK_PROTOCOL } from '../entities/network-config'

import { NetworkConfig } from '../interfaces'

import initByron from './byron-config'
import initShelley from './shelley-config'

const initNetwork = (container: Container) => {
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  const networkProtocol = networkConfig.networkProtocol()

  if (networkProtocol === NETWORK_PROTOCOL.BYRON) {
    initByron(container)
  } else if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
    initShelley(container)
  } else {
    throw new Error(`${networkProtocol} network protocol not supported.`)
  }
}

export default initNetwork
