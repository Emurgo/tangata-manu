// @flow
import { TYPE } from 'inversify-restify-utils'
import { Controller as IController } from 'inversify-restify-utils/lib/interfaces'

import TxController from '../api'

const initRoutes = (container) => {
  container.bind<IController>(TYPE.Controller).to(TxController).whenTargetNamed('TxController')
}

export default initRoutes
