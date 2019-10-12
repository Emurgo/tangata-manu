import server from './server'

const wasm = import('js-chain-libs/js_chain_libs.js')

// Don't check client certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

wasm.then((jschainlibs) => {
  global.jschainlibs = jschainlibs
  return server()
})
