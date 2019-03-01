import CardanoBridgeApi from './cardano-bridge-api'

it('get blockchain tip', async () => {
  const api = new CardanoBridgeApi('http://localhost:8082')
  const resp = await api.getEpochById(3)
  console.log(typeof resp.data)
})