exports.shorthands = undefined

const SQL = `
ALTER TABLE blocks
ADD COLUMN block_height integer;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
