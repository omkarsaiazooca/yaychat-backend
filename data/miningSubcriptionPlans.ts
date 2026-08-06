export interface SubscriptionPlan {
  name: string;
  speedBoost: number;
  cost: number;
  miningRate: number;
  createdAt?: Date;
  updatedAt?: Date;
  coinSymbol: string;
  productId: string;
  displayName?: string;
  displaySpeed?: string;
  benefits?: string;
  tier?: string;
}
