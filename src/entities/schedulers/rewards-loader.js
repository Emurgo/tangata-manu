// @flow

import path from 'path'

import type { Logger } from 'bunyan'

import chokidar from 'chokidar'
import fs from 'fs'
import csv from 'csv-parser'

import { helpers } from 'inversify-vanillajs-helpers'

import type { Database, NetworkConfig } from '../../interfaces'
import type { ShelleyTxType } from '../../blockchain/shelley/tx'

import utils from '../../blockchain/shelley/utils'

import SERVICE_IDENTIFIER from '../../constants/identifiers'

import BaseScheduler from './base-scheduler'

const getEpochFromPath = (path: string): number => {
  const epochFromPathRe = /reward\-info\-(?<epoch>\d+)-/g
  const matchResult = epochFromPathRe.exec(path)
  if (matchResult !== null && matchResult !== undefined) {
    const { groups } = matchResult
    const epoch = groups !== null && groups !== undefined ? groups.epoch : -1
    return parseInt(epoch, 10)
  }
  return -1
}

class RewardsLoaderImpl extends BaseScheduler {
  jormunRewardsDirPath: string

  networkDiscrimination: number

  db: Database<ShelleyTxType>

  constructor(
    logger: Logger,
    jormunRewardsDirPath: string,
    db: Database<ShelleyTxType>,
    networkConfig: NetworkConfig,
  ) {
    super(logger)
    this.name = 'RewardsLoader'
    this.jormunRewardsDirPath = path.resolve(jormunRewardsDirPath)
    this.networkDiscrimination = networkConfig.networkDiscrimination()
    this.db = db
  }


  async run(): Promise<void> {
    const logger = this.logger;
    const loaderName = this.name;
    logger.debug(`[${loaderName}]: Subscribe for changes to ${this.jormunRewardsDirPath} dir.`)
    chokidar.watch(this.jormunRewardsDirPath).on('all', (event, path) => {
      const epoch = getEpochFromPath(path)
      if (epoch >= 0) {
        const csvData = []
        fs.createReadStream(path)
          .pipe(csv())
          .on('data', (data) => {
            const type = data.type;
            const isPool = type === 'pool';
            const isAccount = type === 'account';
            if (isPool || isAccount) {
              const identifier = isAccount ?
                utils.identifierToAddress(data.identifier, this.networkDiscrimination)
                : data.identifier
              csvData.push({
                epoch,
                identifier,
                type,
                received: data.received,
              })
            }
          })
          .on('end', () => {
            this.db.storeStakingRewards(csvData).then(res => {
              logger.debug(`[${loaderName}]: Updated rewards data from '${path}'`)
            }, err => {
              logger.error(`[${loaderName}]: Failed to store rewards from '${path}'!`, err)
            })
          })
      }
    })
  }
}

helpers.annotate(RewardsLoaderImpl,
  [
    SERVICE_IDENTIFIER.LOGGER,
    'jormunRewardsDirPath',
    SERVICE_IDENTIFIER.DATABASE,
    SERVICE_IDENTIFIER.NETWORK_CONFIG,
  ])

export default RewardsLoaderImpl
