exports.shorthands = undefined

const SQL = `
ALTER TABLE transient_snapshots
RENAME COLUMN block_height TO block_num;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
