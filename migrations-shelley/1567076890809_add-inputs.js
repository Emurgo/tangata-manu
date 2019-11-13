exports.shorthands = undefined

const SQL = `
ALTER TABLE txs
ADD COLUMN inputs json;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
