/* eslint-disable camelcase */

const fs = require('fs');
const readline = require('readline');
const squel = require('squel');

const Q = squel.useFlavour('postgres')

exports.shorthands = undefined;

const TABLE_NAME = `known_legacy_addresses`

const SQL = `
CREATE TABLE ${TABLE_NAME}  (
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

  const rows = []
  for await (const line of rl) {
    // ignore comments or blank lines
    const strippedLine = line.trim()
    if (strippedLine && !strippedLine.startsWith('#')) {
      rows.push({ address: strippedLine })
    }
  }

  const insertSql = Q.insert({
      replaceSingleQuotes: true
    })
    .into(TABLE_NAME)
    .setFieldsRows(rows)
    .toString()

  pgm.sql(insertSql)

  run()
};

exports.down = (pgm) => {

};
