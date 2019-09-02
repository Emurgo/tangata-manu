// @flow

import type { Block } from '../../blockchain'

class BlockData {
  block: Block

  constructor(block: Block) {
    this.block = block
  }

  toPlainObject() {
    return { ...this.block }
  }
}

export default BlockData
