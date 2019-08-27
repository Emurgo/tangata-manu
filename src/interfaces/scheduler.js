// @flow

export interface Scheduler {
  startAsync(): Promise<void>;
}
