// @flow

export interface RawDataParser {
  parseBlock(data: string): any;
  parseEpoch(data: string): any;
}
