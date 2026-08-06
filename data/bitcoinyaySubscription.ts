export type BitcoinyaySubscriptionProvider = "stripe" | "paypal";
export type BitcoinyaySubscriptionStatus =
  | "pending"
  | "active"
  | "cancelled"
  | "failed"
  | "upgrading"
  | "downgrading";

export interface BitcoinyaySubscriptionEvent {
  type: string;
  payload?: Record<string, any>;
  createdAt: Date;
}

export interface BitcoinyaySubscription {
  email: string;
  userId?: string;
  planKey: string;
  planName: string;
  provider: BitcoinyaySubscriptionProvider;
  amount: number;
  currency: string;
  miningSpeed: number;
  status: BitcoinyaySubscriptionStatus;
  couponCode?: string;
  couponDiscountPercent?: number;
  miningInterval?: "month" | "year" | "week" | "day";
  metadata?: Record<string, any>;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionItemId?: string;
  stripePriceId?: string;
  stripeProductId?: string;
  miningSubscriptionOrderId?: string;
  paypalPlanId?: string;
  paypalProductId?: string;
  paypalSubscriptionId?: string;
  paypalApprovalUrl?: string;
  events: BitcoinyaySubscriptionEvent[];
  lastPaymentStatus?: string;
  pendingPlanKey?: string;
  pendingPlanName?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BitcoinyaySubscriptionDocument = BitcoinyaySubscription & {
  _id?: string;
};
