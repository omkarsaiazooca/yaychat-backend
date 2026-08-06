export type SmartCryptoPlanId = "sub-300" | "sub-500" | "sub-1000" | "sub-5000";

export interface SmartCryptoSubscriptionPlan {
  planId: SmartCryptoPlanId;
  name: string;
  amount: number;
  currency: string;
  description: string;
  interval: "month";
}

export const SMART_CRYPTO_SUBSCRIPTION_PLANS: SmartCryptoSubscriptionPlan[] = [
  {
    planId: "sub-300",
    name: "Smart Crypto 300",
    amount: 300,
    currency: "USD",
    description: "Monthly smart crypto research updates, alerts, and risk rules.",
    interval: "month",
  },
  {
    planId: "sub-500",
    name: "Smart Crypto 500",
    amount: 500,
    currency: "USD",
    description: "Monthly smart crypto research updates, alerts, and risk rules.",
    interval: "month",
  },
  {
    planId: "sub-1000",
    name: "Smart Crypto 1000",
    amount: 1000,
    currency: "USD",
    description: "Monthly smart crypto research updates, alerts, and risk rules.",
    interval: "month",
  },
  {
    planId: "sub-5000",
    name: "Smart Crypto 5000",
    amount: 5000,
    currency: "USD",
    description: "Monthly smart crypto research updates, alerts, and risk rules.",
    interval: "month",
  },
];

export const SMART_CRYPTO_PLAN_MAP = SMART_CRYPTO_SUBSCRIPTION_PLANS.reduce(
  (acc, plan) => {
    acc[plan.planId] = plan;
    return acc;
  },
  {} as Record<SmartCryptoPlanId, SmartCryptoSubscriptionPlan>
);
