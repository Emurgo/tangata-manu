exports.shorthands = undefined

const SQL = `
ALTER TABLE blocks
ADD COLUMN slot_leader text;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
