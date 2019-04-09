// @flow
import urljoin from 'url-join'
import axios from 'axios'

import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataProvider, RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'


class CardanoBridgeApi implements RawDataProvider {
  #baseUrl: string

  #template: string

  #networkBaseUrl: string

  #parser: any

  constructor(
    baseUrl: string,
    template: string,
    parser: RawDataParser,
  ) {
    this.#parser = parser
    this.#baseUrl = baseUrl
    this.#template = template
    this.#networkBaseUrl = urljoin(baseUrl, template)
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

  async getStatus(): Promise<string> {
    const resp = await this.getJson('/status')
    const { data } = resp
    return data
  }

  async getBlockByHeight(height: number) {
    const resp = await this.get(`/height/${height}`)
    const { data } = resp
    return this.#parser.parseBlock(data)
  }
}

helpers.annotate(CardanoBridgeApi,
  [
    'cardanoBridge.baseUrl',
    'cardanoBridge.template',
    SERVICE_IDENTIFIER.RAW_DATA_PARSER])

export default CardanoBridgeApi
