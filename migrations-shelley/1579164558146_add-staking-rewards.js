exports.shorthands = undefined

const SQL = `
CREATE TABLE staking_rewards  (
    epoch integer,
    account text,
    reward integer,
    around_epoch integer,
    around_slot integer,
    around_time timestamp,
    PRIMARY KEY (epoch, account)
);
`

exports.up = (pgm) => {
  pgm.sql(SQL)
}

exports.down = false
