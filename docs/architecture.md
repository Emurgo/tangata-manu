# `yoroi-importer` Architecture Overview
# General overview
`yoroi-importer` is an ETL tool for Cardano blockchain. Importer receives blocks from the blockchain, parses them, and stores in a structured way to the database.


# Components Overview
## Overview
Importer uses [InversifyJS](http://inversify.io/) to support pluggable components. Basic components config is located in [ioc_config.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/ioc_config/ioc_config.js) . 
There are couple of core components:

 * [Genesis](#genesis): process genesis data.
 * [Scheduler](#scheduler): check for updates in the blockchain.
 * [RawDataProvider](#rawdataprovider): download epochs and blocks from the blockchain.
 * [RawDataParser](#rawdataparser): parse epochs and blocks from binary representation to js objects.
 * [NetworkConfig](#networkconfig): provide importer configuration for other components.
 * [Database](#database): store/retrieve data from database.

## <a name="genesis"></a>Genesis
### Source: [genesis-provider.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/genesis-provider.js)
On startup `yoroi-importer` checks whether the network genesis is stored in the database. If not - the genesis is uploaded automatically. The `genesis` component is responsible for retrieving the JSON genesis file and for parsing the data (like converting genesis `avvmDistr` or `nonAvvmBalances` to UTXOs).

## <a name="scheduler"></a>Scheduler
### Source: [cron.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/cron.js)
### Overview
Every [checkTipCronTime](https://github.com/Emurgo/yoroi-importer/blob/master/config/default.json#L19) scheduler requests [RawDataProvider](#rawdataprovider) for updates from the blockchain. Depending on how far behind the current local DB tip is from the remote state there are two cases:

  * Local tip height is behind for one or more epochs. More details are in the ["Full Epoch Processing"](#fullepochprocessing)
  * Local tip height is behind for less than a full epoch. More details are in the ["Single Blocks Processing"](#singleblocksprocessing)

### Full epochs processing
From performance suggestions, if local last parsed epoch is lower then remote one, `yoroi-importer` tries to download and process full epochs instead of single blocks. If local epoch is the same as remote, [`EPOCH_DOWNLOAD_THRESHOLD`](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/cron.js#L20) control whether to download full epoch or switch to single block processing.

### Single blocks processing
When local block height is up-to-date with remote, `yoroi-importer` processes blocks one by one. If newly fetched block's parent hash differs from the latest one stored in the database, `yoroi-importer` assumes that [blockchain reorganization](https://en.bitcoin.it/wiki/Chain_Reorganization) happen. In that case `yoroi-importer` start the [rollback](#rollback) operation.

### <a name="rollback"></a>Rollback
#### Overview
In general rollback operation means that we reset database state to certain older block height. Number of blocks to rollback is configured by [`rollbackBlocksCount`](https://github.com/Emurgo/yoroi-importer/blob/master/config/default.json#L20)

#### UTXOs backup
Every new transaction uses some `UTXOs` as inputs. Therefore `UTXOs` become spent and are deleted from `utxos` table. When rollback happens, we need to restore `UTXOs` which were spent in the blocks of height bigger than the rollback target point. For that purpose `yoroi-importer` moves all spent `UTXOs` from `utxos` table to `utxos_backup` table. On rollback `UTXOs` that need to be recovered are then moved back from `utxos_backup` to `utxos` table.


## <a name="rawdataprovider"></a>RawDataProvider
### Source: [cardano-bridge-api.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/raw-data-providers/cardano-brdige-api.js)
Request raw data from `cardano-http-bridge`, parse it with [RawDataParser](#rawdataparser) and provide parsed data to other components.

## <a name="rawdataparser"></a>RawDataParser
### Source: [custom-data-parser.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/raw-data-parsers/custom-data-parser.js)
Mainly used by [RawDataProvider](#rawdataprovider) to parse raw data to JS objects.


## <a name="networkconfig"></a>NetworkConfig
### Source: [network-config.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/network-config.js)

Configs for different environments are located in [`config`](https://github.com/Emurgo/yoroi-importer/tree/master/config) folder. Configuration for each network is stored in [`default.json`](https://github.com/Emurgo/yoroi-importer/blob/master/config/default.json)

## <a name="database"></a>Database
### Source: [database.js](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/database.js)

### Database structure

#### `bestblock`
Store height of the latest stored block.

| Column name | Description |
|----------|-------------|
| `best_block_num` | Height of latest stored block |

#### `blocks`
Store blocks metadata.

| Column name | Description |
|----------|-------------|
| `block_hash` | Block hash  |
| `epoch` |    Block epoch   |
| `slot` | Block slot |
| `block_height` |Block height|

#### `pgmigrations`
Table used to support database migrations by [node-pg-migrate](https://github.com/salsita/node-pg-migrate)

#### `tx_addresses`
Store already used addresses.

| Column name | Description |
|----------|-------------|
| `tx_hash` | Hash of transaction where the address was used |
| `address` | Address |

#### `txs`
Store data related to transactions.

| Column name | Description |
|----------|-------------|
| `hash` | Transaction hash |
| `inputs_address[]` | List of inputs addresses |
|`inputs_amount[]`|List of inputs amounts|
|`outputs_address[]`|List of outputs addresses|
|`outputs_amount[]`|List of outputs amounts|
|`block_num`|Block height|
|`block_hash`|Block hash|
|`time`|Tranaction time|
|`tx_state`|Transaction state(`Pending`, `Successful`, `Pending`)|
|`last_update`|Time, when transaction status was updated|
|`tx_body`|base64 encoded transaction body|


#### `utxos`
Store unspent transaction outputs(utxos)

| Column name | Description |
|----------|-------------|
| `utxo_id` | UTXO id consist of `tx_hash+tx_index` |
| `tx_hash` | Transaction hash|
|`tx_index`|Index of transaction output|
|`receiver`|Receiver address|
|`amount`|Amount|
|`block_num`|Block height|


#### `utxos_backup`
Table used to restore utxos for `utxos` table after rollback.

| Column name | Description |
|----------|-------------|
| `utxo_id` | utxo id consist of `tx_hash+tx_index` |
| `tx_hash` | Transaction hash|
|`tx_index`|Index of transaction output|
|`receiver`|Receiver address|
|`amount`|Amount|
|`block_num`|Block height|
|`deleted_block_num`|Height of block, where UTXO was used|

### Blocks bulk insert
To speed up epoch processing we cache blocks data and upload them in one transaction. Size of cache is controlled by [`BLOCKS_CACHE_SIZE`](https://github.com/Emurgo/yoroi-importer/blob/master/src/entities/cron.js#L23])


# API
## `POST /api/txs/signed`
Allows you to send a signed transaction to the network. The transaction will then be disseminated to the different node.

The body of the request is a JSON with the serialized signed transaction in base64 with the following format
### Example
```
{
    "signedTx": "goOfggDYGFgkglggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/5+CgtgYWCGDWBz9PnIoa40sFCzLwMLn+UVjOaRTzU6Wtf50npvsoAAa/moZtxkD6P+ggYIA2BhYhYJYQPRJ3yEtBixg/AmPLmVQ5qvdocgI7+LNE4rnE24YiW4GKxsT8AM8LDke8p7xizOMEW9eB5OFZigGi182w8yCErJYQHepDmtCsTSt2mcv48lddbB3EZtorHq3TY8D2n55j2gRa95oV4FvYNMG40zrpm3nGM0AtwMYJgEs6Ys3yAn3iAw=" 
}
```
