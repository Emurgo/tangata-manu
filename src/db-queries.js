const upsertBlockHash = 'INSERT INTO block_hashes (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING'
const queries = {
  upsertBlockHash,
}
export default queries
