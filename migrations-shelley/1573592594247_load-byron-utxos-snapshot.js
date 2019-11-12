/* eslint-disable camelcase */

const fs = require('fs');
const readline = require('readline');
const squel = require('squel');

const Q = squel.useFlavour('postgres')

exports.shorthands = undefined;

exports.up = async (pgm) => {

  const fileStream = fs.createReadStream('migrations-shelley/data/byron-mainnet-snapshot-balances.txt')
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  console.log('Inserting the Byron snapshot balances')
  let counter = 0
  for await (const line of rl) {
    // ignore comments or blank lines
    const strippedLine = line.trim()
    if (strippedLine && !strippedLine.startsWith('#')) {

      const splitLine = strippedLine.split(/\s+/)
      if (splitLine.length !== 2) {
        console.log(`Ignoring weird line: ${strippedLine}`)
        continue
      }

      const [address, valueStr] = splitLine
      const value = parseInt(valueStr)

      const fakeTxHash = `txhash${counter}`
      const fakeIndex = 0
      const fakeUtxoId = `${fakeTxHash}${fakeIndex}`

      const insertSql = Q.insert({
        replaceSingleQuotes: true
      })
        .into('utxos')
        .setFields({
          utxo_id: fakeUtxoId,
          tx_hash: fakeTxHash,
          tx_index: fakeIndex,
          receiver: address,
          amount: value,
          block_num: 0,
        })
        .toString()

      await pgm.db.query(insertSql)
      if (++counter % 100000 === 0) {
        console.log(`Inserted ${counter} Byron utxos`)
      }
    }
  }

  console.log(`Finished. Total: ${counter} Byron utxos`)
};

exports.down = (pgm) => {

};
