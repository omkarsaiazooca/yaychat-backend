export interface LinkedAccountBonusLog {
  _id?: any;
  mainEmail: string;
  secondaryEmail: string;
  coinSymbol: string;
  amount: number;
  source?: string;
  metadata?: Record<string, any>;
  earnedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
