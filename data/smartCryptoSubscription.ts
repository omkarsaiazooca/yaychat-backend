export type SmartCryptoSubscriptionStatus =
  | "pending"
  | "active"
  | "manual_pending"
  | "cancelled"
  | "failed";

export interface SmartCryptoSubscription {
  email: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentReference?: string;
  status: SmartCryptoSubscriptionStatus;
  paypalPlanId?: string;
  paypalProductId?: string;
  paypalSubscriptionId?: string;
  paypalApprovalUrl?: string;
  nextBillingDate?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
