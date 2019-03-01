exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addConstraint('block_hashes', 'uniq_hash', {unique: 'hash'})
};

exports.down = (pgm) => {

};
