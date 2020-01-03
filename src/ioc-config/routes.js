// @flow

import { Container } from 'inversify'
import { TYPE } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'

import { TxController, AccountInfoController } from '../api'
import type { NetworkConfig } from '../interfaces'
import { NETWORK_PROTOCOL } from '../entities/network-config'
import SERVICE_IDENTIFIER from '../constants/identifiers'

const initRoutes = (container: Container) => {
  const networkConfig = container.get<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG)
  const networkProtocol = networkConfig.networkProtocol()

  container.bind<IController>(TYPE.Controller).to(TxController).whenTargetNamed('TxController')

  if (networkProtocol === NETWORK_PROTOCOL.SHELLEY) {
    container.bind<IController>(TYPE.Controller).to(AccountInfoController).whenTargetNamed('AccountInfoController')
  }
}

export default initRoutes
