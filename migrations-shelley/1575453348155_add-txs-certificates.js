exports.shorthands = undefined

const SQL = `
ALTER TABLE txs
ADD COLUMN certificates text[];
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
