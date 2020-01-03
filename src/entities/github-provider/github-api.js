// @flow

import urljoin from 'url-join'

import { helpers } from 'inversify-vanillajs-helpers'

import { Logger } from 'bunyan'
import axios from 'axios'

import SERVICE_IDENTIFIER from '../../constants/identifiers'

const GITHUB_ROOTS = {
  API: 'https://api.github.com',
  PLAIN: 'https://github.com',
}

class GitHubApi {
  #gitHubRepo: string

  #gitHubAuthUser: string

  #gitHubAuthToken: string

  logger: Logger

  constructor(
    logger: Logger,
    gitHubRepo: string,
    gitHubAuthUser: string,
    gitHubAuthToken: string,
  ) {
    this.logger = logger
    this.#gitHubRepo = gitHubRepo
    this.#gitHubAuthUser = gitHubAuthUser
    this.#gitHubAuthToken = gitHubAuthToken
  }

  repoPath(path: string): string {
    return urljoin('repos', this.#gitHubRepo, path)
  }

  async getImpl(endpointUrl: string, options?: {}) {
    const opts = options || {}
    this.logger.debug(`Calling GitHub @ ${endpointUrl}`)
    try {
      const resp = await axios(endpointUrl,
        {
          responseType: 'json',
          ...opts,
          ...(this.#gitHubAuthUser ? {
            auth: {
              username: this.#gitHubAuthUser,
              password: this.#gitHubAuthToken,
            },
          } : {}),
        })
      return resp
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        const error = new Error('GitHub is not accessible (ECONNREFUSED)')
        error.name = 'GITHUB_INACCESSIBLE'
        throw error
      }
      throw e
    }
  }

  async getPlain(path: string, options?: {}) {
    return this.getImpl(urljoin(GITHUB_ROOTS.PLAIN, path), options)
  }

  async getApi(path: string, options?: {}) {
    return this.getImpl(urljoin(GITHUB_ROOTS.API, path), options)
  }

  async getMasterZip(options?: {}) {
    const resp = await this.getPlain(urljoin(this.#gitHubRepo, 'archive/master.zip'), {
      responseType: 'arraybuffer',
      ...(options || {}),
    })
    if (resp.status !== 200) {
      throw new Error(`Failed to download master zip: ${resp.status} (${resp.statusText})`)
    }
    return resp.data
  }
}

helpers.annotate(GitHubApi, [
  SERVICE_IDENTIFIER.LOGGER,
  'gitHubRepo',
  'gitHubAuthUser',
  'gitHubAuthToken',
])

export default GitHubApi
