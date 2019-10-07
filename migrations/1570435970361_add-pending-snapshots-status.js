exports.shorthands = undefined

const SQL = `
ALTER TABLE pending_snapshots
ADD COLUMN status text;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
