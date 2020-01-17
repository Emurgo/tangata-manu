// @flow

import type { Logger } from 'bunyan'

import chokidar from 'chokidar'
import _ from 'lodash'
import fs from 'fs'
import csv from 'csv-parser'

import { helpers } from 'inversify-vanillajs-helpers'

import type { Database } from '../interfaces'
import type { ShelleyTxType } from '../blockchain/shelley/tx'

import SERVICE_IDENTIFIER from '../constants/identifiers'

const epochFromPathRe = /reward\-info\-(?<epoch>\d+)-/g

const getEpochFromPath = (path: string): number => {
  const matchResult = epochFromPathRe.exec(path)
  if (matchResult !== null && matchResult !== undefined) {
    const { groups } = matchResult
    const epoch = groups !== null && groups !== undefined ? groups.epoch : 0
    return parseInt(epoch, 10)
  }
  return 0
}

class RewardsLoaderImpl {
  logger: Logger

  name: string

  jormunRewardsDirPath: string

  db: Database<ShelleyTxType>

  constructor(
    logger: Logger,
    jormunRewardsDirPath: string,
    db: Database<ShelleyTxType>,
  ) {
    this.logger = logger
    this.name = 'RewardsLoader'
    this.jormunRewardsDirPath = jormunRewardsDirPath
    this.db = db
  }

  run() {
    this.logger.debug(`[${this.name}]: Subscribe for changes to ${this.jormunRewardsDirPath} dir.`)
    const csvData = []
    chokidar.watch(this.jormunRewardsDirPath).on('file', (event, path) => {
      const epoch = getEpochFromPath(path)
      fs.createReadStream('data.csv')
        .pipe(csv())
        .on('data', (data) => {
          if (data.type === 'pool' || data.type === 'account') {
            csvData.push({
              epoch,
              ...data,
            })
          }
        })
        .on('end', () => {
          this.db.storeStakingRewards(csvData).then(() => {
            csvData.length = 0
          })
        })
    })
  }
}

helpers.annotate(RewardsLoaderImpl,
  [
    SERVICE_IDENTIFIER.LOGGER,
    SERVICE_IDENTIFIER.DATABASE,
    'jormunRewardsDirPath',
  ])

export default RewardsLoaderImpl
