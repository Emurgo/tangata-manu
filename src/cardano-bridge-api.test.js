import CardanoBridgeApi from './cardano-bridge-api'

it('can create object', async () => {
  const baseUrl = 'http://localhost:8082'
  const api = new CardanoBridgeApi(baseUrl)
  expect(api.baseUrl).toBe(baseUrl)
})
