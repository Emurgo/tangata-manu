exports.shorthands = undefined

const SQL = `
CREATE TABLE utxos_backup ( like utxos including all)
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
