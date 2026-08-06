// interfaces/UserMiningSession.ts

export interface UserMiningSession {
  email: string;
  startedAt: Date;
  endedAt?: Date;
  durationInSeconds?: number;
  minedTokens?: number;
  isActive?: boolean;
  deviceInfo?: string;
  boosted?: boolean;
  miningRate?: number;
  miningPlan?: string;
  _id?: any;
}
