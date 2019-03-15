// @flow

import 'reflect-metadata'

import { Container } from 'inversify'
import { defaultEagerBinderModule } from 'inversify-config-injection'

import CardanoBridgeApi from './entities'
import { RawDataProvider } from './interfaces'
import SERVICE_IDENTIFIER from './constants/identifiers'

const container = new Container()
container.load(defaultEagerBinderModule)
container.bind<RawDataProvider>(SERVICE_IDENTIFIER.RAW_DATA_PROVIDER).to(CardanoBridgeApi)

export default container
