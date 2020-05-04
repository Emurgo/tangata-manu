// @flow

import server from './server'
import { RustModule } from './rustLoader'

// Don't check client certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

RustModule.load.then(() => {
  return server()
})
