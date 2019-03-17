// @flow
import urljoin from 'url-join'
import axios from 'axios'

import { helpers } from 'inversify-vanillajs-helpers'

import { RawDataProvider } from '../../interfaces'


class CardanoBridgeApi implements RawDataProvider {
  #baseUrl: string

  #template: string

  #networkBaseUrl: string

  constructor(
    baseUrl: string,
    template: string,
  ) {
    this.#baseUrl = baseUrl
    this.#template = template
    this.#networkBaseUrl = urljoin(baseUrl, template)
  }

  async getJson(path: string) {
    const resp = await this.get(path)
    return resp.getJson()
  }

  async get(path: string) {
    const endpointUrl = urljoin(this.#networkBaseUrl, path)
    const resp = await axios(endpointUrl)
    return resp
  }

  async getTip() {
    const resp = await this.get('/tip')
    return resp
  }

  async getEpochById(id: number) {
    const resp = await this.get(`/epoch/${id}`)
    return resp
  }
}

helpers.annotate(CardanoBridgeApi,
  ['cardanoBridge.baseUrl', 'cardanoBridge.template'])

export default CardanoBridgeApi
