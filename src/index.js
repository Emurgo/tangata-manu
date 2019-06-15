// @flow
import minimist from 'minimist'

import server from './server'

const argv = minimist(process.argv.slice(2))


// Don't check client certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

server(argv)
