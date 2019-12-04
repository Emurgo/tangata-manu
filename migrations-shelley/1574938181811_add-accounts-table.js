exports.shorthands = undefined

const SQL = `
CREATE TABLE accounts  (
  epoch integer,
  slot integer,
  tx_ordinal integer,
  block_num bigint,
  operation_id text,
  operation_type integer,
  account text,
  value bigint,
  balance bigint,
  spending_counter integer,
  PRIMARY KEY (operation_id, account)
);
CREATE INDEX ON accounts (operation_id);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
