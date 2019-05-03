// @flow
import urljoin from 'url-join'
import axios from 'axios'
import config from 'config'

import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataProvider, RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'


class CardanoBridgeApi implements RawDataProvider {

  #networkBaseUrl: string

  #parser: any

  constructor(
    parser: RawDataParser,
  ) {
    const networkName = config.get('defaultNetwork')
    const defaultNetwork = config.get('networks')[networkName]
    const baseUrl = defaultNetwork['bridge-url'] || config.get('defaultBridgeUrl')
    this.#networkBaseUrl = urljoin(baseUrl, networkName)
    this.#parser = parser
  }

  async getJson(path: string) {
    const resp = await this.get(path, {
      responseType: 'json',
    })
    return resp
  }

  async get(path: string, options) {
    const endpointUrl = urljoin(this.#networkBaseUrl, path)
    const resp = await axios(endpointUrl,
      {
        responseType: 'arraybuffer',
        ...options,
      })
    return resp
  }

  async getTip() {
    const resp = await this.get('/tip')
    return resp
  }

  async getEpoch(id: number) {
    const resp = await this.get(`/epoch/${id}`)
    return resp.data
  }

  async getBlock(id: string): Promise<string> {
    const resp = await this.get(`/block/${id}`)
    const { data } = resp
    return data
  }

  async getGenesis(hash: string): Promise<string> {
    const resp = await this.getJson(`/genesis/${hash}`)
    const { data } = resp
    return data
  }

  async getStatus(): Promise<any> {
    const resp = await this.getJson('/status')
    const { data } = resp
    return data
  }

  async getBlockByHeight(height: number) {
    const resp = await this.get(`/height/${height}`)
    const { data } = resp
    return this.#parser.parseBlock(data)
  }

  async getParsedEpochById(id: number) {
    const resp = await this.get(`/epoch/${id}`)
    const { data } = resp
    return this.#parser.parseEpoch(data)
  }
}

helpers.annotate(CardanoBridgeApi,
  [SERVICE_IDENTIFIER.RAW_DATA_PARSER])

export default CardanoBridgeApi
