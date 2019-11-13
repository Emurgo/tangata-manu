exports.shorthands = undefined

const SQL = `
ALTER TABLE txs
ADD COLUMN tx_ordinal integer;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
