exports.shorthands = undefined

const SQL = `
CREATE TABLE group_addresses  (
  group_address text PRIMARY KEY,
  utxo_address text,
  account_address text
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
