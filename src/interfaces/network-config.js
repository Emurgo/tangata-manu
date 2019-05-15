// @flow

export interface NetworkConfig {
  networkName(): string;
  genesisHash(): string;
  startTime(): number;
  networkUrl(): string;
}
