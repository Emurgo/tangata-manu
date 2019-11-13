exports.shorthands = undefined

const SQL = `
CREATE TABLE transient_snapshots  (
  tx_hash   text,
  block_hash text,
  block_height integer,
  status text,
  PRIMARY KEY (tx_hash, block_hash)
);
`

exports.up = (pgm) => {
    pgm.sql(SQL)
}

exports.down = false
