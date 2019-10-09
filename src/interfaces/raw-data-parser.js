// @flow

export interface RawDataParser {
  parseBlock(data: Buffer): any;
  parseEpoch(data: Buffer): any;
}
