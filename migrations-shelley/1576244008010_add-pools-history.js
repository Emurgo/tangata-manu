/* eslint-disable camelcase */

exports.shorthands = undefined;

const SQL = `
CREATE TABLE pool_certificates  (
  epoch integer,
  slot integer,
  tx_ordinal integer,
  cert_ordinal integer,
  block_num integer,
  tx_hash text,
  cert_id text PRIMARY KEY,
  pool text,
  certificate_kind text,
  certificate_kind_id integer,
  payload text,
  parsed text,
  UNIQUE (cert_id, pool)
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
};

exports.down = false;
