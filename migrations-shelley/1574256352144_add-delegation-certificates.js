exports.shorthands = undefined

const SQL = `
CREATE TABLE delegation_certificates  (
  epoch integer,
  slot integer,
  tx_ordinal integer,
  cert_ordinal integer,
  block_num integer,
  tx_hash text,
  cert_id text PRIMARY KEY,
  account text,
  pool text,
  UNIQUE (cert_id, pool)
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
