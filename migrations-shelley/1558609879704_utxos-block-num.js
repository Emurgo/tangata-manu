exports.shorthands = undefined

const SQL = `
ALTER TABLE utxos
ADD COLUMN block_num integer;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
