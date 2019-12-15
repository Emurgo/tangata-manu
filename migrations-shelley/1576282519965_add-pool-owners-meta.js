/* eslint-disable camelcase */

exports.shorthands = undefined;

const SQL = `
CREATE TABLE pool_owners_info (
  id serial primary key,
  owner text,
  hash text,
  time timestamp,
  info text,
  sig text,
  meta text
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
};

exports.down = false;
