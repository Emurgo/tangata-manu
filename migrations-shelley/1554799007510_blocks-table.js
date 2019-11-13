exports.shorthands = undefined

const BLOCKS_SCHEMA = `
CREATE TABLE blocks  (
  block_hash   text   PRIMARY KEY,
  epoch integer,
  slot integer
);
`

exports.up = (pgm) => {
  pgm.sql(BLOCKS_SCHEMA)
}

exports.down = false
