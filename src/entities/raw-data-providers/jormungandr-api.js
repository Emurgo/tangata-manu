// @flow

import urljoin from 'url-join'
import axios from 'axios'

import type { Logger } from 'bunyan'
import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataProvider, RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'
import type { NetworkConfig } from '../../interfaces'

// these two are for getting the network instead of using NetworkConfig
import utils from '../../utils'


class JormungandrApi implements RawDataProvider {
  #networkBaseUrl: string

  #parser: any

  #idToHeight: any

  logger: Logger

  constructor(
    networkConfig: NetworkConfig,
    parser: RawDataParser,
    logger: Logger,
    defaultNetwork: string,
  ) {
    // TODO: change NetworkConfig? the old bridge had different networks since they
    // were just a proxy, but jormungandr nodes don't.
    const networkName = process.env.importer_network || defaultNetwork
    const network = utils.getNetworkConfig(networkName)
    this.#networkBaseUrl = urljoin(network.bridgeUrl, 'api/v0')
    this.#parser = parser
    this.logger = logger
  }

  // not sure if needed
  async getJson(path: string) {
    const resp = await this.get(path, {
      responseType: 'json',
    })
    return resp
  }

  async get(path: string, options?: {}) {
    const opts = options || {}
    const endpointUrl = urljoin(this.#networkBaseUrl, path)
    this.logger.debug(`jormungandr: endpointUrl = ${endpointUrl}`)
    try {
      const resp = await axios(endpointUrl,
        {
          responseType: 'arraybuffer',
          ...opts,
        })
      return resp
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        const error = new Error('jormungandr is not accessible (ECONNREFUSED)')
        error.name = 'NODE_INACCESSIBLE'
        throw error
      }
      throw e
    }
  }

  async post(path: string, payload: Buffer, options?: {}) {
    const endpointUrl = urljoin(this.#networkBaseUrl, path)
    let resp
    try {
      resp = await axios.post(endpointUrl, payload, options)
    } catch (e) {
      resp = e.response
    }
    return resp
  }

  async getTip() {
    const resp = await this.get('tip')
    return resp
  }

  // payload is base64 encoded raw binary signed transaction
  async postSignedTx(payload: string): Promise<any> {
    // Jormungandr expects a binary POST input
    const config = {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }
    const payloadBinary = Buffer.from(payload, 'base64')
    const resp = await this.post('txs/signed', payloadBinary, config)
    return resp
  }

  // This would need some further investigating into Jormungandr storage format
  async getEpoch(id: number) {
    this.logger.debug(`getEpoch: ${id}`)
    // const resp = await this.get(`/epoch/${id}`)
    // return resp.data
    throw new Error('JormungandrApi::getEpoch() not implemented')
  }

  // TODO: remove when height endpoint exists
  async parseBlock(raw: any) {
    return this.#parser.parseBlock(raw)
  }

  async getBlock(id: string): Promise<string> {
    this.logger.debug(`jormun GET BLOCK: ${id}`)
    const resp = await this.get(`block/${id}`)
    const { data } = resp
    return data
  }

  // TODO: remove once we support querying by height
  async getNextBlockId(id: string): Promise<string> {
    this.logger.debug(`getNextBlockId(${id})`)
    const resp = await this.get(`block/${id}/next_id`)
    const { data } = resp
    this.logger.debug(` = ${data}`)
    return data
  }

  async getGenesis(hash: string): Promise<Object> {
    this.logger.debug(`getGenesis: ${hash}`)
    // const resp = await this.getJson(`/genesis/${hash}`)
    // const { data } = resp
    // return data
    // not supported right now in jormungandr, so we're hardcoding this for now
    // as something empty to not cause any issues.
    return {
      protocolConsts: {
        protocolMagic: null,
      },
      nonAvvmBalances: [],
      avvmDistr: [],
    }
  }

  // Does not contain the same information. Partly requested here: https://github.com/input-output-hk/jormungandr/issues/769
  async getStatus(): Promise<any> {
    // TODO: wait for jormungandr to be updated - mocking out some info for now instead
    const resp = await this.getJson('/node/stats')
    const { data } = resp
    const x = {
      height: data.lastBlockHeight,
      slot: [Math.floor(data.lastBlockHeight / 21600), data.lastBlockHeight % 21600],
      hash: '<fake hash>', // we aren't actually reading this afaik
    }
    return {
      tip: {
        local: x,
        remote: x,
      },
      packedEpochs: Math.floor(data.lastBlockHeight / 21600),
    }
  }

  // Currently does not exist yet, see: https://github.com/input-output-hk/jormungandr/issues/768
  async getBlockByHeight(height: number) {
    this.logger.debug(`getBlockByHeight: ${height}`)
    // const resp = await this.get(`/height/${height}`)
    // const { data } = resp
    // return this.#parser.parseBlock(data)
    throw new Error('JormungandrApi::getBlockByHeight() not implemented')
  }

  // // See comment on getEpoch()
  // async getParsedEpochById(id: number, omitEbb: boolean = false) {
  //   // const resp = await this.get(`/epoch/${id}`)
  //   // const { data } = resp
  //   // const blocksIterator = this.#parser.parseEpoch(data, { omitEbb })
  //   // return blocksIterator
  //   throw new Error("JormungandrApi::getParsedEpochById() not implemented")
  // }
}

helpers.annotate(JormungandrApi, [
  SERVICE_IDENTIFIER.NETWORK_CONFIG,
  SERVICE_IDENTIFIER.RAW_DATA_PARSER,
  SERVICE_IDENTIFIER.LOGGER,
  'defaultNetwork',
])

export default JormungandrApi
