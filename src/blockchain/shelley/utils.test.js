// @flow

import { expect } from 'chai'
import shelleyUtils from './utils'
import { RustModule } from '../../rustLoader'

beforeAll(async () => {
  await RustModule.load()
})

test(nameof(shelleyUtils.rawTxToObj), () => {
  // Yoroi transfer from single small UTXO
  const tx = Buffer.from(
    '00d7000201010000000000000f4240915f2e6865fb31cc93410efb6c0e580ca74862374b3da461e20135c01f312e7c038e2840fed90d2138761d8a14a4cbed08ed00cf908b07f94ec5fa9db6f4d7e74f00000000000ce3490007cc5b01ab460562479f3e7fdf782b11636c4a1b721c19b9c1609bc7360b518ef3748736afd541361c4fb90b2963723fe9a10d237a024530d378181df4bf2c68537a174e354cf938a3eff28567545f683361e8c90718396ff70db337bfdfe81953e390507b27ae712955d5d9861decb6e7a63fda7338ad2286ad685f00539407',
    'hex',
  )
  const shelleyTx = shelleyUtils.rawTxToObj(
    tx,
    RustModule.WalletV3.AddressDiscrimination.Test,
    {
      txTime: new Date(0),
    },
  )
  expect(shelleyTx).to.deep.equal({
    inputs: [
      {
        type: 'utxo',
        txId: '915f2e6865fb31cc93410efb6c0e580ca74862374b3da461e20135c01f312e7c',
        idx: 0,
      }
    ],
    outputs: [
      {
        type: 'utxo',
        address: '038e2840fed90d2138761d8a14a4cbed08ed00cf908b07f94ec5fa9db6f4d7e74f',
        value: 844617,
      },
    ],
    witnesses: [],
    id: 'd6d7dd41ac6b059a420247f8cda38960217db30835f2c230d27c756cb962fdf3',
    txBody: '00d7000201010000000000000f4240915f2e6865fb31cc93410efb6c0e580ca74862374b3da461e20135c01f312e7c038e2840fed90d2138761d8a14a4cbed08ed00cf908b07f94ec5fa9db6f4d7e74f00000000000ce3490007cc5b01ab460562479f3e7fdf782b11636c4a1b721c19b9c1609bc7360b518ef3748736afd541361c4fb90b2963723fe9a10d237a024530d378181df4bf2c68537a174e354cf938a3eff28567545f683361e8c90718396ff70db337bfdfe81953e390507b27ae712955d5d9861decb6e7a63fda7338ad2286ad685f00539407',
    blockNum: undefined,
    blockHash: undefined,
    status: undefined,
    txOrdinal: undefined,
    isGenesis: undefined,
    certificate: undefined,
    txTime: new Date('1970-01-01T00:00:00.000Z'),
  })
})

test(nameof(shelleyUtils.publicKeyBechToHex), () => {
  const hex = shelleyUtils.publicKeyBechToHex('ed25519_pk164yyfmwglls0g8kxs63pn86drqkaga69pmpdtvj3mpm30rekdwqsrkply6')
  expect(hex).to.be.equal('d54844edc8ffe0f41ec686a2199f4d182dd477450ec2d5b251d877178f366b81')
})
