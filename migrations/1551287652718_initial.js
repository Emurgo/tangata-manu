exports.shorthands = undefined

const INITIAL_SCHEMA = `
-- Tables
CREATE TABLE utxos  ( utxo_id   text      PRIMARY KEY
                    , tx_hash   text
          					, tx_index	integer
          					, receiver	text
          					, amount 	  bigint
                    );

CREATE TABLE bestblock ( best_block_num bigint );

CREATE TABLE txs 	( hash		          text      PRIMARY KEY
                  , inputs_address 		text[]
                  , inputs_amount 		bigint[]
        					, outputs_address   text[]
                  , outputs_amount    bigint[]
        					, block_num         bigint    NULL
                  , block_hash        text      NULL
        					, time              timestamp with time zone NULL
                  , tx_state          text      DEFAULT true
                  , last_update       timestamp with time zone
                  , tx_body           text      DEFAULT NULL
                  );

CREATE TABLE tx_addresses ( tx_hash  text     REFERENCES txs ON DELETE CASCADE
											    , address  text
                          , PRIMARY KEY (tx_hash, address)
											    );

-- Indexes
CREATE INDEX ON utxos (receiver);
CREATE INDEX ON txs (hash);
CREATE INDEX ON txs (hash, last_update);
CREATE INDEX ON tx_addresses (tx_hash);
CREATE INDEX ON tx_addresses (address);
`

const METADATA_SCHEMA = `
-- Schema
CREATE SCHEMA yoroi_metadata;

-- Tables
CREATE TABLE yoroi_metadata.api_statuses  ( id      serial    NOT NULL PRIMARY KEY
                                          , status  boolean   NOT NULL
                                          , time    timestamp with time zone NULL
                                          );

-- Indexes
CREATE INDEX ON yoroi_metadata.api_statuses (id);

-- Set status first entry
INSERT INTO yoroi_metadata.api_statuses (status, time) VALUES (TRUE, now());
`

exports.up = (pgm) => {
  pgm.sql(INITIAL_SCHEMA)
  pgm.sql(METADATA_SCHEMA)
}

exports.down = false
