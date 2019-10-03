// @flow

// TODO: is this right?
const SLOTS_IN_EPOCH = 21600

export type HeaderType = Array<any>

export default class Block {
  hash: string

  prevHash: string

  slot: number

  epoch: number

  height: number

  txs: ?any

  constructor({
    hash, slot, epoch, height, txs, prevHash,
  }: {hash: string,
    slot: number,
    epoch: number,
    height: number,
    txs: ?any,
    prevHash: string}) {
    this.hash = hash
    this.prevHash = prevHash
    this.slot = slot
    this.epoch = epoch
    this.height = height
    this.txs = txs
  }

  // what is this for?
  // serialize() {
  //   return {
  //     block_hash: this.hash,
  //     epoch: this.epoch,
  //     slot: this.slot,
  //     block_height: this.height,
  //   }
  // }

  static parseBlock(blob: Buffer, networkStartTime: number): Block {
    // Read header
    const headerSize = blob.readUInt16BE(0)
    const headerBuffer = blob.subarray(2, 2 + headerSize)
    const epochId = headerBuffer.readUint32BE(2 + 4)
    const slotId = headerBuffer.readUint32BE(2 + 4 + 4)
    const chainLength = headerBuffer.readUint32BE(2 + 4 + 4 + 4)
    const contentHash = headerBuffer.subarray(2 + 4 + 4 + 4 + 4).toString('hex')
    const parentHash = headerBuffer.subarray(2 + 4 + 4 + 4 + 4 + 32).toString('hex')
    // we probably shouldn't hardcode this?
    const blockTime = new Date(
      (networkStartTime
      + (epochId * SLOTS_IN_EPOCH + slotId) * 20)
      * 1000).toUTCString()

    // Read body
    const bodyBuffer = blob.subarray(2 + headerSize)
    let txs = []
    for (let i = 0; i < bodyBuffer.byteLength(); ) {
      const fragmentSize = blob.readUInt16BE(i)
      i += 2
      const fragmentType = blob.readUInt8(i)
      i += 1
      switch (fragmentType) {
        case 0:
          // Initial - ignored?
          break
        case 1:
          // legacy UTXO - TODO: possibly implement?
          //txs.push(parseLegacyTx(blob.subarray(i, i + fragmentSize)))
          break
        case 2:
          // shelley UTXO
          /*txs.push(parseShelleyTx(blob.subarray(i, i + fragmentSize), {
            txTime: blockTime,
            txOrdinal: txs.length,
            blockNum: chainLength,  // is this right or is it off by 1?
            blockHash: contentHash, // is this right?
          }))*/
          break
        case 3:
        case 4:
        case 5:
        case 6:
          // certificates/pool stuff - TODO: implement
          break
        case 7:
        case 8:
          // updates - ignored
          break
        default:
          // TODO: log/throw error/something here?
          break
      }
      i += fragmentSize
    }
    // TODO: is height 1 higher than chainLength?
    return new Block(contentHash, slotId, epochId, chainLength, txs, parentHash)
  }
}
