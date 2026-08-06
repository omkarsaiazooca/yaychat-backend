import { IModel } from "./base";

export interface ShoperPalBtcyCredit extends IModel {
  email: string;
  amount: number;
  assetSymbol: string;
  assetName: string;
  network: string;
  walletType: string;
  source: string;
  sourceOrderId?: string;
  sourceRewardId: string;
  rewardType: string;
  idempotencyKey: string;
  walletTransactionId?: string;
  status: string;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
