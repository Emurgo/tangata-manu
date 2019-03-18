// @flow

import { helpers } from 'inversify-vanillajs-helpers'

import cbor from 'cbor'

import { RawDataParser } from '../../interfaces'
import SERVICE_IDENTIFIER from '../../constants/identifiers'

class CustomDataParser implements RawDataParser {
  #logger: any

  constructor(
    logger: any,
  ) {
    this.#logger = logger
  }

  parse(data: string) {
    const parsedData = {}
    this.#logger.info('Parsed data:', parsedData)
    return parsedData
  }
}

helpers.annotate(CustomDataParser, [SERVICE_IDENTIFIER.LOGGER])

export default CustomDataParser
