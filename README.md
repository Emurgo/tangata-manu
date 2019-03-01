# yoroi-importer
New Yoroi data-importer (replacement for the `project-icarus-importer`)

yarn install
yarn run test
yarn run dev
yarn run migrate create migration description
DATABASE_URL=postgres://postgres:mysecretpassword@localhost:5432/yoroi_blockchain_importer yarn run migrate up