/* eslint-disable camelcase */

const fs = require('fs');
const readline = require('readline');
const SqlString = require('sqlstring');

exports.shorthands = undefined;

const SQL = `
CREATE TABLE known_legacy_addresses  (
  address text,
  PRIMARY KEY (address)
);
`

exports.up = async (pgm, run) => {

  pgm.sql(SQL)

  const fileStream = fs.createReadStream('migrations-shelley/data/known-legacy-addresses-byron-mainnet.txt')
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    // ignore comments
    if (line && !line.startsWith('#')) {
      pgm.sql('insert into known_legacy_addresses (address) values ({line})', { line: SqlString.escape(line) })
    }
  }

  run()
};

exports.down = (pgm) => {

};
