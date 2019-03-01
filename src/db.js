import pg from 'pg'

const createDb = async (dbSettings) => (new pg.Pool(dbSettings))

export default createDb
