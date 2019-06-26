// @flow
import RawDataParser from './custom-data-parser'

class MockDataParser extends RawDataParser {
  parseBlock(blob: Buffer) {
    const block = super.parseBlock(blob)
    if (block.height === 1100) {
      block.prevHash = '2762761e539b8b89f7d925dcdc1386b798dbcd85cbabfa70809c68f7674edc0e'
    }
    return block
  }
}

export default MockDataParser
