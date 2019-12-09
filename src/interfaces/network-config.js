// @flow

export interface NetworkConfig {
  networkName(): string;
  genesisHash(): string;
  startTime(): number;
  slotsPerEpoch(): number;
  slotDurationSeconds(): number;
  networkUrl(): string;
  networkMagic(): number;
  networkProtocol(): string;
  networkDiscrimination(): number;
}
