exports.shorthands = undefined

const SQL = `
CREATE TABLE accounts  (
  epoch integer,
  slot integer,
  tx_ordinal integer,
  block_num integer,
  operation_id text UNIQUE,
  operation_type integer,
  account text,
  value integer,
  balance integer,
  spending_counter integer,
  PRIMARY KEY (operation_id, account)
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
