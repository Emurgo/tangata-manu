exports.shorthands = undefined

const SQL = `
INSERT INTO bestblock(best_block_num)
VALUES (-1)
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
