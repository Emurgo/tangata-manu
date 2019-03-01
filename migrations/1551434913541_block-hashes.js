exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('block_hashes', {
    id: 'id',
    hash: { type: 'varchar(1000)', notNull: true },
  })
  pgm.createTable('tip', {
    id: 'id',
    hash: { type: 'varchar(1000)', notNull: true },
  })
}

exports.down = (pgm) => {

}
