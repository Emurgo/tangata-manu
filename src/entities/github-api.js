// @flow

import urljoin from 'url-join'
import axios from 'axios'

import { helpers } from 'inversify-vanillajs-helpers'

import SERVICE_IDENTIFIER from "../constants/identifiers";
import { Logger } from "bunyan";


class GitHubApi implements RawDataProvider {

  #gitHubRootUrl: string

  #gitHubRepo: string

  #gitHubAuthUser: string

  #gitHubAuthToken: string

  logger: Logger

  constructor(
    logger: Logger,
    gitHubRootUrl: string,
    gitHubRepo: string,
    gitHubAuthUser: string,
    gitHubAuthToken: string,
  ) {
    this.logger = logger
    this.#gitHubRootUrl = gitHubRootUrl
    this.#gitHubRepo = gitHubRepo
    this.#gitHubAuthUser = gitHubAuthUser
    this.#gitHubAuthToken = gitHubAuthToken
  }

  repoPath(path: string): string {
    return urljoin('repos', this.#gitHubRepo, path)
  }

  async get(path: string, options?: {}) {
    const opts = options || {}
    const endpointUrl = urljoin(this.#gitHubRootUrl, path)
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
            }
          }: {})
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

  async getClosedPullRequests(page: number) {
    const resp = await this.get(this.repoPath(`pulls?state=closed&sort=updated&direction=asc&base=master&page=${page}`))
    if (resp.status !== 200) {
      throw new Error(`Failed to query pull requests: ${resp.status} (${resp.statusText})`)
    }
    return resp.data
  }
}

helpers.annotate(GitHubApi, [
  SERVICE_IDENTIFIER.LOGGER,
  'gitHubRootUrl',
  'gitHubRepo',
  'gitHubAuthUser',
  'gitHubAuthToken',
])

export default GitHubApi
