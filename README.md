# yoroi-importer
New Yoroi data-importer (replacement for the `project-icarus-importer`)

# Setup

## Pre-requisites

* NodeJS v10.14.2. We recommend [nvm](https://github.com/creationix/nvm) to install it
* [Postgres 11.2] (https://www.postgresql.org/) as DB engine. For development purposes we
  suggest using Docker but local installation could be used as well (not both,
  obviously). For Mac, we recommend https://postgresapp.com.

## Configuration

All the environment specific configurations can be found in `$PROJ_ROOT/config` folder.
They are loaded using [config](https://www.npmjs.com/package/config) package.

## Development environment

We recommend using [Docker](https://hub.docker.com/_/postgres/) to quickly setup the DB in dev environment:

`docker run --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgres`

And then, to create the db, you need to do:

```
docker exec -it postgres psql -U postgres;
create database yoroi_blockchain_importer;
```

1.  Clone this repo, `git@github.com:Emurgo/yoroi-importer.git`
1.  Select correct NodeJs version, `nvm use`
1.  Install dependencies, `yarn install`
1.  Run tests, `yarn test`
1.  Init database schema, `yarn run migrate up`
1.  Start the app, `yarn run dev`.


## Create database schema migration
We use [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for migrations. Migrations are located in `migrations/` folder. To create e new one, execute:
1.  `yarn run migrate create <short> <description>`

# Run development environment

1. Start postgres, `docker run --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgres`
1. Go to `cardano-http-bridge` directory, `cd cardano-http-bridge`
1. Run `cardano-http-bridge`, `cargo run --package cardano-http-bridge --bin cardano-http-bridge start --port 8082 --template=testnet`
1. Go to `yoroi-importer` directory, `cd yoroi-importer`
1. Load genesis data,`yarn run load-genesis`
1. Start the app, `yarn run dev`.
