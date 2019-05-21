// @flow
import { ContainerModule, interfaces } from 'inversify'

import { NetworkConfig } from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import NetworkConfigImp from '../entities/network-config'

const networkConfigModule = new ContainerModule(async (bind: interfaces.Bind) => {
  bind<NetworkConfig>(SERVICE_IDENTIFIER.NETWORK_CONFIG).toConstantValue(new NetworkConfigImp())
})

export default networkConfigModule
