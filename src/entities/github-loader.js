// @flow

import _ from 'lodash'

import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import type {
  Scheduler,
  StorageProcessor,
} from '../interfaces'
import SERVICE_IDENTIFIER from '../constants/identifiers'
import GitHubApi from "./github-api";

const ERROR_META = {
}

const GITHUB_PR_PAGE_LIMIT = 30

const sleep = millis => new Promise(resolve => setTimeout(resolve, millis))

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
    logger.debug('Checking GitHub every', checkGitHubSeconds, 'seconds')
    this.logger = logger
  }

  async checkGitHub({
    pullRequestPage = 1,
    pullRequestUpdatedAtTimestamp = null,
  }: {
    pullRequestPage: number,
    pullRequestUpdatedAtTimestamp: number,
  }) {
    this.logger.debug('[GitHubLoader] Checking GitHub Pull Requests')
    let latestUpdatedAtTimestamp = pullRequestUpdatedAtTimestamp
    for (let prPage = pullRequestPage; /* NO SIMPLE EXIT CONDITION */; prPage += 1) {
      const prs = await this.gitHubApi.getClosedPullRequests(prPage)
      const pagePromises = []
      for (const pr of prs) {
        const {
          number: pullRequestNumber,
          title: pullRequestTitle,
          updated_at: pullRequestUpdatedAt,
          merged_at: pullRequestMergedAt,
          html_url: pullRequestHtmlUrl,
        } = pr
        const updatedAtTimestamp = Date.parse(pullRequestUpdatedAt)
        if (!pullRequestMergedAt || updatedAtTimestamp < pullRequestUpdatedAtTimestamp) {
          // Ignore declined PRs
          // Also skip any PRs on the same page that were already processed before
          continue
        }
        const pullRequestMergedAtTimestamp = Date.parse(pullRequestMergedAt)
        latestUpdatedAtTimestamp = updatedAtTimestamp
        const prMeta = {
          pullRequestNumber,
          pullRequestTitle,
          pullRequestUpdatedAt,
          pullRequestUpdatedAtTimestamp: updatedAtTimestamp,
          pullRequestMergedAt,
          pullRequestMergedAtTimestamp,
          pullRequestHtmlUrl,
        }
        const promise = this.gitHubApi.listPullRequestFiles(pullRequestNumber).then(async fileDescriptors => {
          if (fileDescriptors.length === 0) {
            return null
          }
          const mappedDescriptors = fileDescriptors.map(d => {
            const {
              filename: name,
              blob_url: blobUrl,
              raw_url: rawUrl,
            } = d
            const match = name.match(/registry\/([^.]*)\.(json|sig)/)
            if (!match) {
              this.logger.warn(`[GitHubLoader] A pull-request file does not match the expected pattern: ${name}`, prMeta)
            }
            return { name, blobUrl, rawUrl, key: match[1], ext: match[2] }
          })
          const groupedDescriptors = _.groupBy(mappedDescriptors, 'key')
          const filePromises = Object.entries(groupedDescriptors).flatMap(([ key, descriptors ]) => {
            if (descriptors.length !== 2) {
              this.logger.warn(`[GitHubLoader] Unexpected number of file descriptors for the same key: ${key}`, {
                descriptors,
                prMeta,
              })
              return null
            }
            const unexpectedExts = _.difference(_.map(descriptors, 'ext'), ['json', 'sig'])
            if (unexpectedExts.length > 0) {
              this.logger.warn(`[GitHubLoader] Unexpected file extensions for key: ${key}`, {
                descriptors,
                prMeta,
              })
              return null
            }
            const filePromises = descriptors.map(d => this.gitHubApi.getImpl(d.rawUrl).then(res => {
              if (res.status !== 200) {
                this.logger.error(`[GitHubLoader] Failed to load raw files body: pr=${pullRequestNumber}, file=${d.rawUrl}`, res)
                return null
              }
              return { ...d, body: res.data }
            }, err => {
              this.logger.error(`[GitHubLoader] Failed to load raw files body: pr=${pullRequestNumber}, file=${d.rawUrl}`, err)
            }))
            return filePromises
          }).filter(Boolean);
          const resolvedFiles = (await Promise.all(filePromises)).filter(Boolean)
          return _.chain(resolvedFiles)
            .groupBy('key')
            .mapValues(files => ({ prMeta, files: _.keyBy(files, 'ext') }))
            .value()
        }, err => {
          this.logger.error(`[GitHubLoader] Failed to query list of files for PR number ${pullRequestNumber}:`, err)
        })
        pagePromises.push(promise)
      }
      const pageResults = _.flatten((await Promise.all(pagePromises)).filter(Boolean))
      const page = _.assign({}, ...pageResults)
      this.logger.debug(`[GitHubLoader] Loaded ${Object.keys(page).length} entries from page ${prPage}`)
      for (const e of Object.entries(page)) {
        this.logger.debug(`>>>`, JSON.stringify(e, null, 2))
      }
      if (prs.length < GITHUB_PR_PAGE_LIMIT) {
        // Finishing iteration, because last page is reached
        return {
          pullRequestPage: prPage,
          pullRequestUpdatedAtTimestamp: latestUpdatedAtTimestamp,
        }
      }
    }
  }

  async startAsync() {
    this.logger.info('GitHub loader async: starting chain syncing loop')
    const currentMillis = () => new Date().getTime()
    let iterationState = {}
    for (;;) {
      const millisStart = currentMillis()
      let errorSleep = 0
      try {
        iterationState = await this.checkGitHub(iterationState)
      } catch (e) {
        const meta = ERROR_META[e.name]
        if (meta) {
          errorSleep = meta.sleep
          this.logger.warn(`Scheduler async: failed to check GitHub :: ${meta.msg}. Sleeping and retrying (err_sleep=${errorSleep})`)
        } else {
          throw e
        }
      }
      const millisEnd = currentMillis()
      const millisPassed = millisEnd - millisStart
      this.logger.debug(`GitHub loader async: loop finished (millisPassed=${millisPassed}, iterationState=${JSON.stringify(iterationState)})`)
      const millisSleep = errorSleep || (this.checkGitHubMillis - millisPassed)
      if (millisSleep > 0) {
        this.logger.debug('GitHub loader async: sleeping for', millisSleep)
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
