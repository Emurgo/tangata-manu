exports.shorthands = undefined

const SQL = `
ALTER TABLE utxos_backup
ADD COLUMN deleted_block_num integer;
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
