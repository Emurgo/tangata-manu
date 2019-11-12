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

exports.up = async (pgm) => {

  await pgm.db.query(SQL)

  const fileStream = fs.createReadStream('migrations-shelley/data/known-legacy-addresses-byron-mainnet.txt')
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  console.log('Inserting the known legacy addresses dump')
  let lfsChecked = false
  let counter = 0
  for await (const line of rl) {
    // ignore comments or blank lines
    const strippedLine = line.trim()
    if (!lfsChecked) {
      if (strippedLine.startsWith('version https://git-lfs.github.com/spec')) {
        throw Error(`The full legacy address dump file is located on Git LFS,
        you need to download it manually or install a tool to sync it (see https://git-lfs.github.com)`)
      }
      lfsChecked = true
    }
    if (strippedLine && !strippedLine.startsWith('#')) {
      const insertSql = Q.insert({
          replaceSingleQuotes: true
        })
        .into(TABLE_NAME)
        .setFields({ address: strippedLine })
        .toString()

      await pgm.db.query(insertSql)
      if (++counter % 100000 === 0) {
        console.log(`Inserted ${counter} legacy addresses`)
      }
    }
  }

  console.log(`Finished. Total: ${counter} legacy addresses`)
};

exports.down = (pgm) => {

};
