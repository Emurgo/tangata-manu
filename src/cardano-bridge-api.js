import urljoin from 'url-join'
import axios from 'axios'

export default class CardanoBridgeApi {
  constructor(baseUrl, template = 'testnet') {
    this.baseUrl = baseUrl
    this.template = template
    this.networkBaseUrl = urljoin(baseUrl, template)
  }

  async getJson(path) {
    const resp = await this.get(path)
    return resp.getJson()
  }

  async get(path) {
    const endpointUrl = urljoin(this.networkBaseUrl, path)
    const resp = await axios(endpointUrl)
    return resp
  }

  async getTip() {
    const resp = await this.get('/tip')
    return resp
  }

  async getEpochById(id) {
    const resp = await this.get(`/epoch/${id}`)
    return resp
  }
}
