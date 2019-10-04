exports.shorthands = undefined

const SQL = `
CREATE TABLE pending_snapshots  (
  tx_hash   text,
  block_hash text,
  bloch_height integer,
  PRIMARY KEY (tx_hash, block_hash)
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
