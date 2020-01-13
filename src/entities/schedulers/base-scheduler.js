// @flow

import type { Logger } from 'bunyan'

import { helpers } from 'inversify-vanillajs-helpers'

import type { Scheduler } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

class BaseScheduler implements Scheduler {
  counter: number

  name: string

  logger: Logger

  constructor(logger: Logger) {
    this.counter = 10
    this.name = 'Scheduler'
    this.logger = logger
  }

  async startAsync() {
    this.logger.debug('BaseScheduler.startAsync called.')
    throw Error('BaseScheduler.startAsync should be overriden by child class.')
  }

  async run(name: string = '') {
    if (name !== '') {
      this.name = name
    }
    if (this.counter > 10) {
      this.logger.warn(`${this.name}: restarted too many times (${this.counter}). Shutting it down.`)
      return
    }
    this.logger.debug(`${this.name}.startAsync : starting (counter=${this.counter})`)
    this.startAsync().then(res => {
      this.logger.error(`${this.name}.startAsync exited successfully. This is unexpected to happen by itself! (result=${res})`)
      this.logger.debug(`${this.name}.startAsync : Restarting`)
      ++this.counter
      this.run()
    }, err => {
      this.logger.error('GitHubLoader.startAsync exited with an error:', err)
      this.logger.debug('GitHubLoader.startAsync : Restarting')
      ++this.counter
      this.run()
    })
  }
}

helpers.annotate(BaseScheduler,
  [
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default BaseScheduler