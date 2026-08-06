export const STOP_MINING_CREDIT_SOURCES = [
  "manual_stop",
  "auto_stop",
  "ad_stop",
] as const;

export type StopMiningCreditSource =
  (typeof STOP_MINING_CREDIT_SOURCES)[number];

export type MiningCreditSource = StopMiningCreditSource;

export interface MiningCreditEvent {
  email?: string;
  coinSymbol: string;
  amount: number;
  creditedAt: Date;
  source: MiningCreditSource | string;
  miningPlan?: string;
  miningRate?: number;
  sessionHours?: number;
  sessionStartedAt?: Date;
  dedupeKey?: string;
}
