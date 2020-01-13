// @flow

import _ from 'lodash'
import blake from 'blakejs'
import AdmZip from 'adm-zip'

import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type {
  Scheduler,
  StorageProcessor,
} from '../../interfaces'
import type { PoolOwnerInfoEntryType } from '../../interfaces/storage-processor'

import SERVICE_IDENTIFIER from '../../constants/identifiers'
import GitHubApi from './github-api'
import { sleep } from '../../utils'
import { shelleyUtils } from '../../blockchain/shelley'

const ERROR_META = {
}

class GitHubLoader implements Scheduler {
  storageProcessor: StorageProcessor

  gitHubApi: GitHubApi

  logger: Logger

  checkGitHubMillis: number

  constructor(
    checkGitHubSeconds: number,
    storageProcessor: StorageProcessor,
    gitHubApi: GitHubApi,
    logger: Logger,
  ) {
    this.storageProcessor = storageProcessor
    this.gitHubApi = gitHubApi
    this.checkGitHubMillis = checkGitHubSeconds * 1000
    logger.debug('[GitHubLoader] Checking GitHub every', checkGitHubSeconds, 'seconds')
    this.logger = logger
  }

  async checkGitHub({
    existingKeysWithHashes,
  } : {
    existingKeysWithHashes: { [string]: string }
  }) {
    const data = await this.gitHubApi.getMasterZip()
    const zip = new AdmZip(data)
    const mapped = zip.getEntries()
      .map(e => {
        const match = e.entryName.match(/incentivized-testnet-stakepool-registry-master\/registry\/([^.]*)\.(json|sig)/)
        return match ? { key: match[1], ext: match[2], text: zip.readAsText(e) } : null
      })
      .filter(Boolean)
    const grouped = _.chain(mapped).groupBy('key').mapValues((vs, key) => {
      const { json: jsonEntry, sig: sigEntry } = _.keyBy(vs, 'ext')
      if (!jsonEntry) {
        this.logger.warn(`[GitHubLoader] No JSON found for key: ${key}! Ignoring`)
        return null
      } if (!sigEntry) {
        this.logger.warn(`[GitHubLoader] No SIG found for key: ${key} (JSON=${jsonEntry.text})! Ignoring`)
        return null
      }
      const [json, sig] = [jsonEntry.text, sigEntry.text]
      try {
        const hash = blake.blake2bHex(`${json}:${sig}`, null, 32)
        return { json: JSON.parse(json), sig, hash }
      } catch (e) {
        this.logger.warn(`[GitHubLoader] Failed to parse json from: ${json}`, e)
        return null
      }
    }).pickBy(Boolean)
      .value()
    const entries = Object.entries(grouped).map(([owner, { json, sig, hash }]) => {
      const ownerHex = shelleyUtils.publicKeyBechToHex(owner)
      if (existingKeysWithHashes[ownerHex] === hash) {
        // Owner record matches, ignore
        return null
      }
      const entry: PoolOwnerInfoEntryType = {
        owner: ownerHex,
        hash,
        info: json,
        sig,
        meta: {},
      }
      return entry
    }).filter(Boolean)
    this.logger.debug(`[GitHubLoader] Found ${entries.length} new or updated pool owner info entries`)
    if (entries.length > 0) {
      try {
        await this.storageProcessor.storePoolOwnersInfo(entries)
      } catch (e) {
        this.logger.error('[GitHubLoader] Failed to store pool owner info entries!', e)
      }
      const newOrUpdatedHashes = _.chain(entries).keyBy('owner').mapValues('hash').value()
      return { existingKeysWithHashes: { ...existingKeysWithHashes, ...newOrUpdatedHashes } }
    }
    return { existingKeysWithHashes }
  }

  async startAsync() {
    this.logger.info('[GitHubLoader] GitHub loader async: starting chain syncing loop')
    const currentMillis = () => new Date().getTime()
    const existingKeysWithHashes = await this.storageProcessor.getLatestPoolOwnerHashes()
    let iterationState = { existingKeysWithHashes }
    for (;;) {
      const millisStart = currentMillis()
      let errorSleep = 0
      try {
        iterationState = await this.checkGitHub(iterationState)
      } catch (e) {
        const meta = ERROR_META[e.name]
        if (meta) {
          errorSleep = meta.sleep
          this.logger.warn(`[GitHubLoader]: failed to check GitHub :: ${meta.msg}. Sleeping and retrying (err_sleep=${errorSleep})`)
        } else {
          throw e
        }
      }
      const millisEnd = currentMillis()
      const millisPassed = millisEnd - millisStart
      this.logger.debug(`[GitHubLoader] async: loop finished (millisPassed=${millisPassed})`)
      const millisSleep = errorSleep || (this.checkGitHubMillis - millisPassed)
      if (millisSleep > 0) {
        this.logger.debug('[GitHubLoader] async: sleeping for', millisSleep)
        await sleep(millisSleep)
      }
    }
  }
}

helpers.annotate(GitHubLoader,
  [
    'checkGitHubSeconds',
    SERVICE_IDENTIFIER.STORAGE_PROCESSOR,
    SERVICE_IDENTIFIER.GITHUB_API,
    SERVICE_IDENTIFIER.LOGGER,
  ])

export default GitHubLoader
