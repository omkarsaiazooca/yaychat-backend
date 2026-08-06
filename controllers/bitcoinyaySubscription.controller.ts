import axios from "axios";
import { Request, Response } from "express";
import Stripe from "stripe";
import { keys } from "../config/keys";
import stripePriceOverrides from "../config/bitcoinyayStripePrices.json";
import paypalPlanOverrides from "../config/bitcoinyayPaypalPlans.json";
import { getRedis } from "../cache/redis";
import { BitcoinyaySubscriptionService } from "../services/bitcoinyaySubscription.service";
import {
  BitcoinyaySubscription,
  BitcoinyaySubscriptionDocument,
} from "../data/bitcoinyaySubscription";
import { BitcoinyaySubscriptionModel } from "../models/bitcoinyaySubscription";
import { SubscriptionService } from "../services/subscription.service";
import { OrderService } from "../services/order.service";
import { PaymentTypes } from "../data/common";
import {
  Order,
  OrderBreakdown,
  OrderStatus,
  OrderType,
  Rates,
} from "../data/order";
import {
  INDEPENDENCE_WEEK_END_DISPLAY_UTC,
  INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE,
  INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT,
  INDEPENDENCE_WEEK_EMMM_PROMO_CODE,
  INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT,
  INDEPENDENCE_WEEK_PROMO_CODE,
  INDEPENDENCE_WEEK_START_UTC,
  isIndependenceWeekPromoActive,
} from "../helpers/quantumBtcyBonus";

const env = keys.env.key || "development";
const envMode = env.toLowerCase();
const testOverride = String(process.env.BITCOINYAY_USE_TEST_PROVIDERS ?? "true")
  .trim()
  .toLowerCase();
const shouldUseTestProviders = !["false", "0", "no"].includes(testOverride);
const useStripeTestKey = true;

console.log(
  `[Bitcoinyay] env= ${envMode}, stripeMode=${
    useStripeTestKey ? "test" : "live"
  }`
);
const usePaypalSandbox =
  shouldUseTestProviders || envMode === "development" || envMode === "dev";

const getConfiguredStripeSecretKey = (...values: Array<string | undefined>) =>
  values.find(
    (value) =>
      typeof value === "string" &&
      value !== "undefined" &&
      value !== "null" &&
      value.startsWith("sk_")
  );

const stripeKey = keys.stripe_test.key;
const stripe = new Stripe(stripeKey, {
  apiVersion: "2022-08-01",
});

console.log({ stripeKey: keys.env.key });
// const stripeLiveKey = keys.stripe_live.key;
const stripe_publish_key =
  keys.env.key === "development" || envMode === "dev"
    ? keys.stripe_pk_test.key
    : keys.stripe_live.key;

const stripeLive = stripe_publish_key
  ? new Stripe(stripe_publish_key, {
      apiVersion: "2022-08-01",
    })
  : undefined;
const stripeMainKey = getConfiguredStripeSecretKey(
  keys.stripe_live.key,
  keys.stripe_bitcoinyay_test.key
);
const stripeMain = stripeMainKey
  ? new Stripe(stripeMainKey, {
      apiVersion: "2022-08-01",
    })
  : undefined;

type StripePriceOverrides = Record<string, string>;
const stripePriceOverridesMap: StripePriceOverrides = stripePriceOverrides;
type PaypalOverride = {
  planId?: string;
  productId?: string;
};
const paypalPlanOverridesMap: Record<string, PaypalOverride> =
  paypalPlanOverrides;

const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_BASE_URL = "https://api-m.paypal.com";
const payPalBaseUrl = usePaypalSandbox
  ? PAYPAL_SANDBOX_BASE_URL
  : PAYPAL_LIVE_BASE_URL;
const payPalClientId = usePaypalSandbox
  ? keys.paypal_client_id_test.key
  : keys.paypal_client_id_live.key;
const payPalSecret = usePaypalSandbox
  ? keys.paypal_secret_key_test.key
  : keys.paypal_secret_key_live.key;

const paypalCouponPlanCache: Record<string, string> = {};

const getConfiguredSecret = (...values: Array<string | undefined>) =>
  values.find(
    (value) =>
      typeof value === "string" &&
      value !== "undefined" &&
      value !== "null" &&
      value.startsWith("whsec_")
  );

const stripeWebhookSecret = getConfiguredSecret(
  keys.bitcoinyay_stripe_webhook?.key,
  keys.stripe_webhook.key
);
const stripeWebhookSecretMain = getConfiguredSecret(
  keys.bitcoinyay_stripe_webhook_main?.key,
  keys.stripe_webhook_main?.key,
  stripeWebhookSecret
);
const paypalWebhookId = keys.paypal_webhook_id?.key;
const PAYPAL_VERIFY_PATH = "/v1/notifications/verify-webhook-signature";
const paypalWebhookIdMain = keys.paypal_webhook_id_live?.key ?? paypalWebhookId;

export type MiningInterval = "month" | "week" | "day";

export interface PlanDefinition {
  key: string;
  name: string;
  description: string;
  miningSpeed: number;
  amount: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  paypalPlanId: string;
  paypalProductId: string;
  miningInterval?: MiningInterval;
  durationMonths?: number;
}

interface CouponDefinition {
  code: string;
  percentOff: number;
  description: string;
}

interface PaypalWebhookHeaders {
  transmission_id?: string | string[];
  transmission_time?: string | string[];
  cert_url?: string | string[];
  auth_algo?: string | string[];
  transmission_sig?: string | string[];
}

const BASE_SUCCESS_URL =
  process.env.BITCOINYAY_SUBSCRIPTION_SUCCESS_URL ||
  "https://bitcoinyay.com/subscription-success";
const BASE_CANCEL_URL =
  process.env.BITCOINYAY_SUBSCRIPTION_CANCEL_URL ||
  "https://bitcoinyay.com/subscription-cancelled";
const BITCOINYAY_COIN_SYMBOL = process.env.BITCOINYAY_COIN_SYMBOL || "BTCY";

// --- HOLI promo (UTC): March 3 -> March 7 inclusive (ends March 8 00:00 UTC) ---
const HOLI_COUPON_CODE = "HOLI20";
const HOLI_COUPON_PERCENT_OFF = 20;
const HOLI_CLAIM_LIMIT = 100;
const HOLI_START_UTC = new Date(Date.UTC(2026, 2, 3, 0, 0, 0)); // Mar = 2
const HOLI_END_UTC_EXCLUSIVE = new Date(Date.UTC(2026, 2, 8, 0, 0, 0));

function isHoliPromoActive(now = new Date()): boolean {
  return now >= HOLI_START_UTC && now < HOLI_END_UTC_EXCLUSIVE;
}

function holiPromoEligible(plan: PlanDefinition): boolean {
  // Keep multi-month bundles out of promo (different proration/expectations).
  // Monthly + weekly are supported (PayPal coupon plan uses interval-specific billing cycles).
  const interval = plan.miningInterval ?? "month";
  const isMonthlyOrWeekly = interval === "month" || interval === "week";
  const isMultiMonth = Boolean(plan.durationMonths && plan.durationMonths > 1);
  return isMonthlyOrWeekly && !isMultiMonth;
}

function holiPromoTtlSeconds(now = new Date()): number {
  const ms = HOLI_END_UTC_EXCLUSIVE.getTime() - now.getTime();
  return Math.max(1, Math.floor(ms / 1000));
}

const HOLI_CLAIM_LUA = `
local setKey = KEYS[1]
local limit = tonumber(ARGV[1])
local member = ARGV[2]
local ttl = tonumber(ARGV[3])

if redis.call("SISMEMBER", setKey, member) == 1 then
  return 1
end

local count = tonumber(redis.call("SCARD", setKey))
if count >= limit then
  return 0
end

redis.call("SADD", setKey, member)
if ttl and ttl > 0 then
  redis.call("EXPIRE", setKey, ttl)
end

return 1
`;

const INDEPENDENCE_WEEK_POWER_COUPON_CODE = INDEPENDENCE_WEEK_PROMO_CODE;
const INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE = INDEPENDENCE_WEEK_EMMM_PROMO_CODE;

function independenceWeekPowerPromoEligible(plan: PlanDefinition): boolean {
  const interval = plan.miningInterval ?? "month";
  const isMonthlyOrWeekly = interval === "month" || interval === "week";
  const isMultiMonth = Boolean(plan.durationMonths && plan.durationMonths > 1);
  return isMonthlyOrWeekly && !isMultiMonth;
}

function withIndependenceWeekPowerPromo(
  plan: PlanDefinition,
  emmmBettorEligible = false
) {
  if (!isIndependenceWeekPromoActive() || !independenceWeekPowerPromoEligible(plan)) {
    return plan;
  }

  const promoCode = emmmBettorEligible
    ? INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE
    : INDEPENDENCE_WEEK_POWER_COUPON_CODE;
  const percentOff = emmmBettorEligible
    ? INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT
    : INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT;
  const discountAmount = Number(
    (plan.amount * (percentOff / 100)).toFixed(2)
  );
  return {
    ...plan,
    activePromo: {
      code: promoCode,
      type: "discount",
      percentOff,
      discountAmount,
      finalAmount: Number((plan.amount - discountAmount).toFixed(2)),
      startsAt: INDEPENDENCE_WEEK_START_UTC.toISOString(),
      endsAt: INDEPENDENCE_WEEK_END_DISPLAY_UTC.toISOString(),
      description: emmmBettorEligible
        ? "Independence Week EMMM bettor automatic 30% discount on Power Mining."
        : "Independence Week automatic 20% discount on Power Mining.",
    },
  };
}

function independenceWeekEmmmBetQuery(email: string) {
  return {
    "user.email": email,
    status: OrderStatus.Completed,
    "breakdown.outCurrencyName": "EMMM",
    $and: [
      {
        $or: [
          { orderType: { $in: ["EMMMNuggetBet", "EMMMTrade", "Sell"] } },
          { paymentType: "EMMM" },
          { merchantName: "EMMM" },
        ],
      },
      {
        $or: [
          {
            orderCompletedOn: {
              $gte: INDEPENDENCE_WEEK_START_UTC,
              $lt: INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE,
            },
          },
          {
            created: {
              $gte: INDEPENDENCE_WEEK_START_UTC,
              $lt: INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE,
            },
          },
        ],
      },
    ],
  };
}

// PayPal API field limits (Billing Plans API)
const PAYPAL_PLAN_NAME_MAX = 127;
const PAYPAL_PLAN_DESCRIPTION_MAX = 127;

function truncateForPaypal(input: string, max: number): string {
  const s = String(input ?? "");
  return s.length <= max ? s : s.slice(0, max).trim();
}

async function claimHoliPromoOrThrow(email: string): Promise<void> {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  if (!normalizedEmail) return;

  const redis = getRedis();
  const key = `btcy:coupon:${HOLI_COUPON_CODE.toLowerCase()}:claims`;
  const allowed = await redis.eval(HOLI_CLAIM_LUA, {
    keys: [key],
    arguments: [
      String(HOLI_CLAIM_LIMIT),
      normalizedEmail,
      String(holiPromoTtlSeconds()),
    ],
  });

  if (Number(allowed) !== 1) {
    const err: any = new Error("HOLI promo limit reached");
    err.httpStatus = 409;
    err.publicMessage = `Coupon ${HOLI_COUPON_CODE} has reached its limit (${HOLI_CLAIM_LIMIT} users).`;
    throw err;
  }
}

const COUPON_MAP: Record<string, CouponDefinition> = {
  BTCY10: { code: "BTCY10", percentOff: 10, description: "10% off first month" },
  BTCY20: { code: "BTCY20", percentOff: 20, description: "20% off first month" },
  BTCY30: { code: "BTCY30", percentOff: 30, description: "30% off first month" },
  BTCY50: { code: "BTCY50", percentOff: 50, description: "50% off first month" },
  HBD30: { code: "HBD30", percentOff: 30, description: "30% off first month" },
  HOLI20: {
    code: "HOLI20",
    percentOff: HOLI_COUPON_PERCENT_OFF,
    description:
      "Website-only offer (not valid in the app). Limited to the first 100 users.",
  },
  [INDEPENDENCE_WEEK_POWER_COUPON_CODE]: {
    code: INDEPENDENCE_WEEK_POWER_COUPON_CODE,
    percentOff: INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT,
    description: "Independence Week automatic 20% discount on Power Mining.",
  },
  [INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE]: {
    code: INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE,
    percentOff: INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT,
    description:
      "Independence Week EMMM bettor automatic 30% discount on Power Mining.",
  },
};

const STRIPE_TEST_PLAN_IDS: Record<
  string,
  { priceId: string; productId: string }
> = {
  electric: {
    priceId: "price_1TSFTkEbqha0tw36t3pzKSMg",
    productId: "prod_TS5nlirzs8pB8J",
  },
  turbo: {
    priceId: "price_1TSFTkEbqha0tw367hXV5O3x",
    productId: "prod_TS5n8MB5toez0P",
  },
  nuclear: {
    priceId: "price_1SaJB1Ebqha0tw36UIpouyUZ",
    productId: "prod_TS5n44TP74ECyg",
  },
  weeklyElectric: {
    priceId: "price_1ShsdAEbqha0tw36IqY8kqym",
    productId: "prod_TfD3Vrvyf5vawl",
  },
  weeklyTurbo: {
    priceId: "price_1ShsdDEbqha0tw36tEoaPNpu",
    productId: "prod_TfD3RaThTobNMZ",
  },
  weeklyNuclear: {
    priceId: "price_1ShsdFEbqha0tw36FdBZRo1D",
    productId: "prod_TfD378BprVTUbI",
  },
  event15x1day: {
    priceId: "price_1ShsdIEbqha0tw36JcBl056k",
    productId: "prod_TfD3M86QTp2bss",
  },
  event15x3day: {
    priceId: "price_1ShsdLEbqha0tw362a7KwTpM",
    productId: "prod_TfD3cxtZhxWwk9",
  },
  event15x7day: {
    priceId: "price_1ShsdOEbqha0tw36XYx1vbyp",
    productId: "prod_TfD3rgwlDjDX9w",
  },
};

const LOYALTY_DURATION_MONTHS = 3;
const LOYALTY_DISCOUNT_RATE = 0.05;

function loyaltyAmount(monthlyAmount: number): number {
  const discounted =
    monthlyAmount * LOYALTY_DURATION_MONTHS * (1 - LOYALTY_DISCOUNT_RATE);
  return Number(discounted.toFixed(2));
}

const BASE_BITCOINYAY_PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  electric: {
    key: "electric",
    name: "Electric Power",
    description: "Always-on electric throughput with referral bonuses.",
    miningSpeed: 4.5,
    amount: 35,
    currency: "USD",
    stripePriceId: "price_1Sla5uEbqha0tw36g3DCsFhv",
    stripeProductId: "prod_Tj2ATJyPuzw1m0",
    paypalPlanId: "P-4L131203NV519154FNFMUF4I",
    paypalProductId: "PROD-3MC164632F725654N",
    miningInterval: "month",
  },
  turbo: {
    key: "turbo",
    name: "Turbo Power",
    description: "Double electric throughput with automated boosts.",
    miningSpeed: 9,
    amount: 75,
    currency: "USD",
    stripePriceId: "price_1Sla5rEbqha0tw36dWpcMxxQ",
    stripeProductId:
      keys.env.key === "development"
        ? "prod_TS5n44TP74ECyg"
        : "prod_Tj2AT00yBfLTgy",
    paypalPlanId: "P-9J344408XV004424DNFMUF4Q",
    paypalProductId: "PROD-8HU837254S338560U",
    miningInterval: "month",
  },
  nuclear: {
    key: "nuclear",
    name: "Nuclear Power",
    description: "Maximum AI-driven yield with VIP support and bonuses.",
    miningSpeed: 13.5,
    amount: 100,
    currency: "USD",
    stripePriceId:
      keys.env.key === "development"
        ? "price_1SaJB1Ebqha0tw36UIpouyUZ"
        : "price_1Sla5oEbqha0tw36XbCtNxl8",
    stripeProductId:
      keys.env.key === "development"
        ? "prod_TS5n44TP74ECyg"
        : "prod_Tj2Aseq75EFNdC",
    paypalPlanId: "P-6CH28265FP275831HNFMUF4Q",
    paypalProductId: "PROD-1C2450465S9323619",
    miningInterval: "month",
  },
  electric3month: {
    key: "electric3month",
    name: "Electric Power (3-Month Loyalty)",
    description:
      "Three months of Electric Power with a 5% loyalty discount and 4.5 BTCY/h speed.",
    miningSpeed: 4.5,
    amount: loyaltyAmount(35),
    currency: "USD",
    stripePriceId: "price_tbd_electric3month",
    stripeProductId: "prod_tbd_electric3month",
    paypalPlanId: "P-TBD-ELECTRIC-3M",
    paypalProductId: "PROD-TBD-ELECTRIC-3M",
    miningInterval: "month",
    durationMonths: 3,
  },
  turbo3month: {
    key: "turbo3month",
    name: "Turbo Power (3-Month Loyalty)",
    description:
      "Three months of Turbo Power with a 5% loyalty discount and 9 BTCY/h speed.",
    miningSpeed: 9,
    amount: loyaltyAmount(75),
    currency: "USD",
    stripePriceId: "price_tbd_turbo3month",
    stripeProductId: "prod_tbd_turbo3month",
    paypalPlanId: "P-TBD-TURBO-3M",
    paypalProductId: "PROD-TBD-TURBO-3M",
    miningInterval: "month",
    durationMonths: 3,
  },
  nuclear3month: {
    key: "nuclear3month",
    name: "Nuclear Power (3-Month Loyalty)",
    description:
      "Three months of Nuclear Power with a 5% loyalty discount and 13.5 BTCY/h speed.",
    miningSpeed: 13.5,
    amount: loyaltyAmount(100),
    currency: "USD",
    stripePriceId: "price_tbd_nuclear3month",
    stripeProductId: "prod_tbd_nuclear3month",
    paypalPlanId: "P-TBD-NUCLEAR-3M",
    paypalProductId: "PROD-TBD-NUCLEAR-3M",
    miningInterval: "month",
    durationMonths: 3,
  },
  weeklyElectric: {
    key: "weeklyElectric",
    name: "Electric Mining Weekly Pass",
    description: "One-week Electric boost (4.5 BTCY/h).",
    miningSpeed: 4.5,
    amount: 10,
    currency: "USD",
    stripePriceId: "price_1SlY3PEbqha0tw36hG3VrndQ",
    stripeProductId: "prod_Tj03WvrwGcYzV5",
    paypalPlanId: "P-40L59009TB2336745NFMUSJI",
    paypalProductId: "PROD-06F2086535009581K",
    miningInterval: "week",
  },
  weeklyTurbo: {
    key: "weeklyTurbo",
    name: "Turbo Mining Weekly Pass",
    description: "One-week Turbo boost (9 BTCY/h).",
    miningSpeed: 9,
    amount: 20,
    currency: "USD",
    stripePriceId: "price_1SlY3QEbqha0tw36SPeZkhTO",
    stripeProductId: "prod_Tj03FF28t6vG00",
    paypalPlanId: "P-66B74744BK8686024NFMUSKA",
    paypalProductId: "PROD-9LH463985C762334Y",
    miningInterval: "week",
  },
  weeklyNuclear: {
    key: "weeklyNuclear",
    name: "Nuclear Mining Weekly Pass",
    description: "One-week Nuclear boost (13.5 BTCY/h).",
    miningSpeed: 13.5,
    amount: 30,
    currency: "USD",
    stripePriceId: "price_1SlY3SEbqha0tw36FcZ99hyP",
    stripeProductId: "prod_Tj03aEve12Gfp3",
    paypalPlanId: "P-9AP99579HU428870LNFMUSKI",
    paypalProductId: "PROD-61K18693HR186124B",
    miningInterval: "week",
  },
  event15x1day: {
    key: "event15x1day",
    name: "15x Speed Mining - 1 Day",
    description: "New Year's lightning pass with 15x speed for one day.",
    miningSpeed: 15,
    amount: 5,
    currency: "USD",
    stripePriceId: "price_1SlY3UEbqha0tw3625Nu5NsH",
    stripeProductId: "prod_Tj03L6KA9bO5VF",
    paypalPlanId: "P-4XU360075G377460MNFMUSKY",
    paypalProductId: "PROD-1G576225881871424",
    miningInterval: "day",
  },
  event15x3day: {
    key: "event15x3day",
    name: "15x Speed Mining - 3 Days",
    description: "Three-day New Year's event pass with 15x speed.",
    miningSpeed: 15,
    amount: 10,
    currency: "USD",
    stripePriceId: "price_1SlY3VEbqha0tw36vcwUrK9a",
    stripeProductId: "prod_Tj03Zypn3S580v",
    paypalPlanId: "P-9CT31412WM7235639NFMUSLA",
    paypalProductId: "PROD-6L962449HK494462U",
    miningInterval: "day",
  },
  event15x7day: {
    key: "event15x7day",
    name: "15x Speed Mining - 7 Days",
    description: "Seven-day New Year's event pass with 15x speed.",
    miningSpeed: 15,
    amount: 20,
    currency: "USD",
    stripePriceId: "price_1SlY3XEbqha0tw36eneCm0pq",
    stripeProductId: "prod_Tj037cOt3dnjMv",
    paypalPlanId: "P-5HT76950AP326125GNFMUSLQ",
    paypalProductId: "PROD-22556536BH4182233",
    miningInterval: "day",
  },
};

function getStripePriceOverride(planKey: string, fallback: string): string {
  const envKey = `BITCOINYAY_STRIPE_PRICE_${planKey.toUpperCase()}`;
  const overrideFromEnv = process.env[envKey];
  if (overrideFromEnv) {
    return overrideFromEnv;
  }

  const overrideFromConfig = stripePriceOverridesMap[planKey];
  if (overrideFromConfig) {
    return overrideFromConfig;
  }

  return fallback;
}

function buildPlanCatalog(
  useTestStripe: boolean
): Record<string, PlanDefinition> {
  const entries = Object.entries(BASE_BITCOINYAY_PLAN_DEFINITIONS) as [
    string,
    PlanDefinition
  ][];

  return Object.fromEntries(
    entries.map(([planKey, plan]) => {
      const testStripeIds = useTestStripe
        ? STRIPE_TEST_PLAN_IDS[planKey]
        : undefined;
      const stripePriceId =
        testStripeIds?.priceId ??
        getStripePriceOverride(planKey, plan.stripePriceId);
      const stripeProductId = testStripeIds?.productId ?? plan.stripeProductId;
      const paypalOverride = paypalPlanOverridesMap[planKey];
      return [
        planKey,
        {
          ...plan,
          stripePriceId,
          stripeProductId,
          paypalPlanId: paypalOverride?.planId ?? plan.paypalPlanId,
          paypalProductId: paypalOverride?.productId ?? plan.paypalProductId,
        },
      ];
    })
  ) as Record<string, PlanDefinition>;
}

export const BITCOINYAY_PLAN_MAP = buildPlanCatalog(useStripeTestKey);

export function getBitcoinyayPlanCatalog(useTestStripe?: boolean) {
  return buildPlanCatalog(
    typeof useTestStripe === "boolean" ? useTestStripe : useStripeTestKey
  );
}

export const BITCOINYAY_PLAN_LOOKUP: Record<string, PlanDefinition> =
  Object.fromEntries(
    Object.entries(BITCOINYAY_PLAN_MAP).map(([planKey, plan]) => [
      planKey.toLowerCase(),
      plan,
    ])
  );

function buildPlanLookup(useTestStripe: boolean): Record<string, PlanDefinition> {
  return Object.fromEntries(
    Object.entries(getBitcoinyayPlanCatalog(useTestStripe)).map(
      ([planKey, plan]) => [planKey.toLowerCase(), plan]
    )
  ) as Record<string, PlanDefinition>;
}

function isStripeTestPlanReference(record: {
  stripePriceId?: string;
  stripeProductId?: string;
}): boolean {
  const testPlans = Object.values(getBitcoinyayPlanCatalog(true));
  return testPlans.some(
    (plan) =>
      (!!record.stripePriceId && plan.stripePriceId === record.stripePriceId) ||
      (!!record.stripeProductId && plan.stripeProductId === record.stripeProductId)
  );
}

export class BitcoinyaySubscriptionController {
  private readonly service = new BitcoinyaySubscriptionService();
  private readonly subscriptionService = new SubscriptionService();
  private readonly orderService = new OrderService();

  async purchaseSubscription(req: Request, res: Response): Promise<void> {
    return this.purchaseSubscriptionInternal(req, res, false);
  }

  async purchaseTestSubscription(req: Request, res: Response): Promise<void> {
    return this.purchaseSubscriptionInternal(req, res, true);
  }

  private async purchaseSubscriptionInternal(
    req: Request,
    res: Response,
    useTestStripe: boolean
  ): Promise<void> {
    try {
      const email = String(req.body.email || "").toLowerCase();
      const provider = String(req.body.provider || "").toLowerCase();
      const planKey = String(req.body.planKey || "").toLowerCase();
      console.log(
        `[Bitcoinyay] purchase request: email=${email}, provider=${provider}, plan=${planKey}, stripeMode=${
          useTestStripe ? "test" : "live"
        }`
      );
      const metadata = req.body.metadata || {};
      let couponCode = req.body.couponCode
        ? String(req.body.couponCode).toUpperCase()
        : undefined;

      if (!email || !provider || !planKey) {
        res.status(400).json({
          success: false,
          error: "email, provider, and planKey are required",
        });
        return;
      }
      if (!["stripe", "paypal"].includes(provider)) {
        res.status(400).json({
          success: false,
          error: "provider must be stripe or paypal",
        });
        return;
      }

      const planLookup = buildPlanLookup(useTestStripe);
      const plan = planLookup[planKey];
      if (!plan) {
        res.status(400).json({
          success: false,
          error: `Unknown planKey "${planKey}"`,
        });
        return;
      }

      const eligibleForIndependenceWeekPowerPromo =
        !couponCode &&
        isIndependenceWeekPromoActive() &&
        independenceWeekPowerPromoEligible(plan);
      let autoAppliedPromoCode: string | undefined;
      let autoAppliedEmmmPowerPromo = false;
      if (eligibleForIndependenceWeekPowerPromo) {
        const emmmBetOrder = await this.orderService.findOne(
          independenceWeekEmmmBetQuery(email)
        );
        autoAppliedEmmmPowerPromo = Boolean(emmmBetOrder);
        autoAppliedPromoCode = autoAppliedEmmmPowerPromo
          ? INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE
          : INDEPENDENCE_WEEK_POWER_COUPON_CODE;
        couponCode = autoAppliedPromoCode;
      }

      const stripeClient = useTestStripe ? stripe : stripeMain;
      if (provider === "stripe" && !stripeClient) {
        res.status(500).json({
          success: false,
          error: useTestStripe
            ? "Stripe test secret key is not configured"
            : "Stripe live secret key is not configured",
        });
        return;
      }

      const coupon = couponCode ? COUPON_MAP[couponCode] : undefined;

      if (couponCode === HOLI_COUPON_CODE) {
        if (!coupon || coupon.percentOff !== HOLI_COUPON_PERCENT_OFF) {
          res.status(400).json({
            success: false,
            error: `Coupon "${couponCode}" not found`,
          });
          return;
        }
        if (!isHoliPromoActive()) {
          res.status(400).json({
            success: false,
            error: `Coupon "${HOLI_COUPON_CODE}" is not active`,
          });
          return;
        }
        if (!holiPromoEligible(plan)) {
          res.status(400).json({
            success: false,
            error: `Coupon "${HOLI_COUPON_CODE}" is not applicable to this plan`,
          });
          return;
        }
        await claimHoliPromoOrThrow(email);
      }

      if (
        couponCode === INDEPENDENCE_WEEK_POWER_COUPON_CODE ||
        couponCode === INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE
      ) {
        if (!isIndependenceWeekPromoActive()) {
          res.status(400).json({
            success: false,
            error: `Coupon "${couponCode}" is not active`,
          });
          return;
        }
        if (!independenceWeekPowerPromoEligible(plan)) {
          res.status(400).json({
            success: false,
            error: `Coupon "${couponCode}" is not applicable to this plan`,
          });
          return;
        }
        if (couponCode === INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE) {
          const emmmBetOrder = await this.orderService.findOne(
            independenceWeekEmmmBetQuery(email)
          );
          if (!emmmBetOrder) {
            res.status(400).json({
              success: false,
              error: `Coupon "${INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE}" requires a completed EMMM bet during the promo period`,
            });
            return;
          }
        }
      }

      const eventSeed = {
        email,
        provider,
        planKey: plan.key,
        planName: plan.name,
        stripeMode: useTestStripe ? "test" : "live",
      };
      const effectiveMetadata = {
        ...metadata,
        ...(autoAppliedPromoCode
          ? {
              autoAppliedPromoCode,
              autoAppliedEmmmPowerPromo,
            }
          : {}),
      };

      const newRecord: BitcoinyaySubscription = {
        email,
        planKey: plan.key,
        planName: plan.name,
        provider: provider as any,
        amount: plan.amount,
        currency: plan.currency,
        miningSpeed: plan.miningSpeed,
        status: "pending",
        couponCode: coupon?.code,
        couponDiscountPercent: coupon?.percentOff,
        miningInterval: plan.miningInterval ?? "month",
        metadata: effectiveMetadata,
        stripePriceId: plan.stripePriceId,
        stripeProductId: plan.stripeProductId,
        paypalPlanId: plan.paypalPlanId,
        paypalProductId: plan.paypalProductId,
        events: [
          {
            type: "purchase.initiated",
            payload: {
              ...eventSeed,
              couponCode,
              autoAppliedPromoCode,
              autoAppliedEmmmPowerPromo,
            },
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = (await this.service.create(
        newRecord
      )) as BitcoinyaySubscriptionModel;
      if (!created || !created._id) {
        res.status(500).json({
          success: false,
          error: "Failed to create subscription record",
        });
        return;
      }
      const recordId = String(created._id);
      console.log(created._id);
      const miningSubscriptionOrderId =
        await this.createMiningSubscriptionWebOrder(
          recordId,
          email,
          provider,
          plan,
          useTestStripe,
          effectiveMetadata,
          coupon
        );
      await this.service.updatePart(
        { _id: recordId },
        {
          $set: {
            miningSubscriptionOrderId,
            updatedAt: new Date(),
          },
          $push: {
            events: {
              type: "mining.subscription.order.created",
              payload: { orderId: miningSubscriptionOrderId },
              createdAt: new Date(),
            },
          },
        }
      );

      if (provider === "stripe") {
        const session = await this.createStripeSession(
          stripeClient!,
          email,
          plan,
          coupon,
          recordId,
          effectiveMetadata
        );
        await this.service.updatePart(
          { _id: recordId },
          {
            $set: {
              stripeCheckoutSessionId: session.id,
              amount: plan.amount,
              updatedBy: email,
            },
            $push: {
              events: {
                type: "stripe.session.created",
                payload: {
                  sessionId: session.id,
                  url: session.url,
                  paymentStatus: session.payment_status,
                },
                createdAt: new Date(),
              },
            },
          }
        );
        await this.updateMiningSubscriptionWebOrder(miningSubscriptionOrderId, {
          merchantStatus: "stripe.session.created",
          merchantReferenceId: session.id,
          notes: JSON.stringify({
            bitcoinyaySubscriptionId: recordId,
            checkoutSessionId: session.id,
            provider,
            stripeMode: useTestStripe ? "test" : "live",
          }),
        });
        res.status(201).json({
          success: true,
          data: {
            recordId,
            orderId: miningSubscriptionOrderId,
            sessionId: session.id,
            sessionUrl: session.url,
          },
        });
        return;
      }

      if (provider === "paypal") {
        const subscription = await this.createPaypalSubscription(
          email,
          plan,
          recordId,
          coupon
        );
        await this.service.updatePart(
          { _id: recordId },
          {
            $set: {
              paypalApprovalUrl: subscription.approvalUrl,
              paypalPlanId: plan.paypalPlanId,
              paypalProductId: plan.paypalProductId,
              paypalSubscriptionId: subscription.id,
            },
            $push: {
              events: {
                type: "paypal.subscription.created",
                payload: subscription.raw,
                createdAt: new Date(),
              },
            },
          }
        );
        await this.updateMiningSubscriptionWebOrder(miningSubscriptionOrderId, {
          merchantStatus: "paypal.subscription.created",
          merchantReferenceId: subscription.id,
          notes: JSON.stringify({
            bitcoinyaySubscriptionId: recordId,
            paypalSubscriptionId: subscription.id,
            provider,
          }),
        });
        res.status(201).json({
          success: true,
          data: {
            recordId: created._id,
            orderId: miningSubscriptionOrderId,
            approvalUrl: subscription.approvalUrl,
            agreementId: subscription.id,
            subscriptionId: subscription.id,
          },
        });
        return;
      }

      await this.service.updatePart(
        { _id: created._id },
        {
          $set: { status: "failed", updatedAt: new Date() },
        }
      );
      res.status(400).json({
        success: false,
        error: "Unsupported provider",
      });
    } catch (error: any) {
      console.error("purchaseSubscription error:", error);
      if (error?.httpStatus && error?.publicMessage) {
        res
          .status(error.httpStatus)
          .json({ success: false, error: error.publicMessage });
        return;
      }
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async validateCoupon(req: Request, res: Response): Promise<void> {
    try {
      const planKey = String(req.body.planKey || "").toLowerCase();
      const couponCode = String(req.body.couponCode || "").toUpperCase();
      const provider = String(req.body.provider || "stripe").toLowerCase();
      const email = String(req.body.email || "").toLowerCase().trim();

      if (!planKey || !couponCode) {
        res.status(400).json({
          success: false,
          error: "planKey and couponCode are required",
        });
        return;
      }

      const plan = BITCOINYAY_PLAN_LOOKUP[planKey];
      if (!plan) {
        res.status(400).json({
          success: false,
          error: `Unknown planKey "${planKey}"`,
        });
        return;
      }

      const coupon = COUPON_MAP[couponCode];
      if (!coupon) {
        res.status(404).json({
          success: false,
          error: `Coupon "${couponCode}" not found`,
        });
        return;
      }

      if (couponCode === HOLI_COUPON_CODE) {
        if (!isHoliPromoActive()) {
          res.status(400).json({
            success: false,
            error: `Coupon "${HOLI_COUPON_CODE}" is not active`,
          });
          return;
        }
        if (!holiPromoEligible(plan)) {
          res.status(400).json({
            success: false,
            error: `Coupon "${HOLI_COUPON_CODE}" is not applicable to this plan`,
          });
          return;
        }
      }

      if (
        couponCode === INDEPENDENCE_WEEK_POWER_COUPON_CODE ||
        couponCode === INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE
      ) {
        if (!isIndependenceWeekPromoActive()) {
          res.status(400).json({
            success: false,
            error: `Coupon "${couponCode}" is not active`,
          });
          return;
        }
        if (!independenceWeekPowerPromoEligible(plan)) {
          res.status(400).json({
            success: false,
            error: `Coupon "${couponCode}" is not applicable to this plan`,
          });
          return;
        }
        if (couponCode === INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE) {
          if (!email) {
            res.status(400).json({
              success: false,
              error: "email is required to validate the EMMM bettor promo",
            });
            return;
          }
          const emmmBetOrder = await this.orderService.findOne(
            independenceWeekEmmmBetQuery(email)
          );
          if (!emmmBetOrder) {
            res.status(400).json({
              success: false,
              error: `Coupon "${INDEPENDENCE_WEEK_EMMM_POWER_COUPON_CODE}" requires a completed EMMM bet during the promo period`,
            });
            return;
          }
        }
      }

      const basePrice = plan.amount;
      const discountPercent = coupon.percentOff;
      const discountAmount = Number(
        (basePrice * (discountPercent / 100)).toFixed(2)
      );
      const finalPrice = Number((basePrice - discountAmount).toFixed(2));
      let providerCouponId: string | undefined;
      if (provider === "stripe") {
        providerCouponId = await this.ensureStripeCoupon(coupon);
      }

      res.json({
        success: true,
        data: {
          provider,
          planKey: plan.key,
          planName: plan.name,
          currency: plan.currency,
          basePrice,
          discountPercent,
          discountAmount,
          finalPrice,
          couponCode: coupon.code,
          couponDescription: coupon.description,
          stripeCouponId: providerCouponId,
        },
      });
    } catch (error: any) {
      console.error("validateCoupon error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { email, provider, status, limit = "25", page = "1" } = req.query;

      const filters: any = {};
      if (email) filters.email = String(email).toLowerCase();
      if (provider) filters.provider = String(provider).toLowerCase();
      if (status) filters.status = String(status);

      const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 200);
      const parsedPage = Math.max(Number(page) || 1, 1);
      const skip = (parsedPage - 1) * parsedLimit;
      const [data, total] = await Promise.all([
        this.service.listWithFilters(filters, parsedLimit, skip, {
          createdAt: -1,
        }),
        this.service.countWithFilters(filters),
      ]);

      res.json({
        success: true,
        page: parsedPage,
        limit: parsedLimit,
        total,
        data,
      });
    } catch (error: any) {
      console.error("getHistory error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async getPlanCatalog(req: Request, res: Response): Promise<void> {
    try {
      const requested = String(req.query.environment || "").toLowerCase();
      let useTest: boolean | undefined;
      if (requested === "test") {
        useTest = true;
      } else if (requested === "main") {
        useTest = false;
      }
      const email = String(req.query.email || "").toLowerCase().trim();
      const emmmBetOrder =
        email && isIndependenceWeekPromoActive()
          ? await this.orderService.findOne(independenceWeekEmmmBetQuery(email))
          : undefined;
      const emmmBettorEligible = Boolean(emmmBetOrder);
      const baseCatalog = getBitcoinyayPlanCatalog(useTest);
      const catalog = Object.fromEntries(
        Object.entries(baseCatalog).map(([planKey, plan]) => [
          planKey,
          withIndependenceWeekPowerPromo(plan, emmmBettorEligible),
        ])
      );
      const activeEnvironment =
        useTest === true
          ? "test"
          : useTest === false
          ? "main"
          : useStripeTestKey
          ? "test"
          : "main";
      res.json({
        success: true,
        environment: activeEnvironment,
        emmmBettorPromoEligible: emmmBettorEligible,
        data: catalog,
      });
    } catch (error: any) {
      console.error("getPlanCatalog error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async changePlan(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId, newPlanKey } = req.body;
      const emailInput = String(req.body.email || "").toLowerCase();
      const providerInput = String(req.body.provider || "").toLowerCase();
      if (!newPlanKey || (!subscriptionId && !emailInput)) {
        res.status(400).json({
          success: false,
          error: "newPlanKey and (subscriptionId or email) are required",
        });
        return;
      }
      const downgradeToFree = newPlanKey === "free";
      let requestedUseTestStripe =
        String(req.body.environment || "").toLowerCase() === "test" ||
        String(req.body.stripeMode || "").toLowerCase() === "test";
      let planLookup = buildPlanLookup(requestedUseTestStripe);
      let plan = downgradeToFree
        ? undefined
        : planLookup[newPlanKey.toLowerCase()];
      if (!plan && !downgradeToFree) {
        res.status(400).json({
          success: false,
          error: `Unknown plan key "${newPlanKey}"`,
        });
        return;
      }
      const invalidPlan =
        !downgradeToFree &&
        Boolean(plan?.durationMonths) &&
        (plan?.durationMonths ?? 0) > 1;
      if (invalidPlan) {
        res.status(400).json({
          success: false,
          error: `change-plan is available only for 1-month/weekly/one-day tiers`,
        });
        return;
      }

      let record = await this.service.findById(subscriptionId);
      if (!record) {
        const fallbackRecord = await this.service.findOne({
          $or: [
            { stripeSubscriptionId: subscriptionId },
            { paypalSubscriptionId: subscriptionId },
            { stripeCheckoutSessionId: subscriptionId },
          ],
        });
        if (fallbackRecord) {
          console.warn(
            "changePlan matched subscription using provider IDs",
            subscriptionId
          );
        }
        record = fallbackRecord;
      }
      if (!record && emailInput) {
        const fallbackByEmail = await this.service.findLatest({
          email: emailInput,
          status: { $in: ["active", "pending", "upgrading", "downgrading"] },
        });
        if (fallbackByEmail) {
          console.warn(
            "changePlan matched subscription using email",
            emailInput
          );
        }
        record = fallbackByEmail;
      }
      if (!record) {
        if (downgradeToFree) {
          res.json({
            success: true,
            message: "No active subscription to downgrade",
          });
          return;
        }
        if (!emailInput || !providerInput) {
          res.status(400).json({
            success: false,
            error:
              "email and provider are required to start a new subscription",
          });
          return;
        }
        if (!["stripe", "paypal"].includes(providerInput)) {
          res.status(400).json({
            success: false,
            error: "provider must be stripe or paypal",
          });
          return;
        }
        req.body = {
          ...req.body,
          email: emailInput,
          provider: providerInput,
          planKey: plan!.key,
        };
        if (requestedUseTestStripe) {
          await this.purchaseTestSubscription(req, res);
        } else {
          await this.purchaseSubscription(req, res);
        }
        return;
      }

      const recordDoc = record as BitcoinyaySubscriptionDocument;
      const useTestStripeForRecord =
        record.provider === "stripe" && isStripeTestPlanReference(record);
      if (record.provider === "stripe") {
        planLookup = buildPlanLookup(useTestStripeForRecord);
        plan = downgradeToFree
          ? undefined
          : planLookup[newPlanKey.toLowerCase()];
        if (!plan && !downgradeToFree) {
          res.status(400).json({
            success: false,
            error: `Unknown plan key "${newPlanKey}"`,
          });
          return;
        }
      }
      const recordId =
        recordDoc._id?.toString?.() || String(recordDoc._id || subscriptionId);
      if (!recordId) {
        res.status(404).json({ success: false, error: "Record not found" });
        return;
      }

      const planChangeEvent = {
        type: "plan.change.requested",
        payload: {
          from: record.planKey,
          to: downgradeToFree ? "free" : plan!.key,
          provider: record.provider,
        },
        createdAt: new Date(),
      };

      const planAmount = plan?.amount ?? record.amount;
      const planSpeed = plan?.miningSpeed ?? record.miningSpeed;
      const planInterval =
        plan?.miningInterval ?? record.miningInterval ?? "month";
      const updatePayload: any = {
        planKey: downgradeToFree ? record.planKey : plan!.key,
        planName: downgradeToFree ? record.planName : plan!.name,
        amount: planAmount,
        miningSpeed: planSpeed,
        miningInterval: planInterval,
        updatedAt: new Date(),
        pendingPlanKey: undefined,
        pendingPlanName: undefined,
      };
      let paypalReviseResult:
        | { approvalUrl?: string; subscriptionId?: string; raw: any }
        | undefined;

      if (record.provider === "stripe") {
        const stripeClient = useTestStripeForRecord ? stripe : stripeMain;
        if (!stripeClient) {
          res.status(500).json({
            success: false,
            error: useTestStripeForRecord
              ? "Stripe test secret key is not configured"
              : "Stripe live secret key is not configured",
          });
          return;
        }
        if (!record.stripeSubscriptionId) {
          res.status(400).json({
            success: false,
            error: "Stripe subscription Id is missing",
          });
          return;
        }

        const itemId =
          record.stripeSubscriptionItemId ||
          (await this.fetchFirstSubscriptionItem(
            stripeClient,
            record.stripeSubscriptionId
          ));
        if (!itemId) {
          res.status(400).json({
            success: false,
            error: "Cannot locate subscription item to update",
          });
          return;
        }

        if (downgradeToFree) {
          await stripeClient.subscriptions.update(record.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          updatePayload.pendingPlanKey = "free";
          updatePayload.pendingPlanName = "Free";
          delete updatePayload.planKey;
          delete updatePayload.planName;
        } else {
          await stripeClient.subscriptions.update(record.stripeSubscriptionId, {
            items: [{ id: itemId, price: plan!.stripePriceId }],
            proration_behavior: "create_prorations",
          });
          updatePayload.stripePriceId = plan!.stripePriceId;
          updatePayload.stripeProductId = plan!.stripeProductId;
          updatePayload.stripeSubscriptionItemId = itemId;
        }
      } else {
        if (downgradeToFree) {
          updatePayload.pendingPlanKey = "free";
          updatePayload.pendingPlanName = "Free";
        } else {
          if (!record.paypalSubscriptionId) {
            res.status(400).json({
              success: false,
              error: "PayPal subscription Id is missing",
            });
            return;
          }
          paypalReviseResult = await this.revisePaypalSubscription(
            record.paypalSubscriptionId,
            plan!,
            recordId
          );
          updatePayload.pendingPlanKey = plan!.key;
          updatePayload.pendingPlanName = plan!.name;
        }
        delete updatePayload.planKey;
        delete updatePayload.planName;
        delete updatePayload.amount;
        delete updatePayload.miningSpeed;
        delete updatePayload.miningInterval;
      }

      await this.service.updatePart(
        { _id: recordId },
        {
          $set: updatePayload,
          $push: { events: planChangeEvent },
        }
      );

      await this.updateMiningSubscriptionWebOrder(
        record.miningSubscriptionOrderId,
        {
          merchantStatus: downgradeToFree
            ? "plan.change.downgrade_to_free"
            : record.provider === "paypal"
            ? paypalReviseResult?.approvalUrl
              ? "paypal.subscription.revise.approval_required"
              : "paypal.subscription.revise.requested"
            : "plan.change.completed",
          productId: downgradeToFree
            ? record.stripePriceId || record.paypalPlanId
            : record.provider === "paypal"
            ? plan!.paypalPlanId
            : plan!.stripePriceId,
          usdValue: planAmount,
          breakdown: {
            inCurrenyName: plan?.currency || record.currency || "USD",
            inAmount: planAmount,
            outCurrencyName: downgradeToFree ? "Free" : plan!.name,
            outAmount: planSpeed,
            finalAmountAfterDiscount: planAmount,
          },
          notes: JSON.stringify({
            bitcoinyaySubscriptionId: recordId,
            from: record.planKey,
            to: downgradeToFree ? "free" : plan!.key,
            provider: record.provider,
            paypalApprovalUrl: paypalReviseResult?.approvalUrl,
            stripeMode:
              record.provider === "stripe"
                ? useTestStripeForRecord
                  ? "test"
                  : "live"
                : undefined,
          }),
        }
      );

      if (record.provider === "stripe" && !downgradeToFree && plan) {
        await this.subscriptionService.subscribeUser(
          record.email,
          plan.name,
          "Stripe",
          BITCOINYAY_COIN_SYMBOL
        );
      }

      res.json({
        success: true,
        message:
          record.provider === "paypal" && paypalReviseResult?.approvalUrl
            ? "Plan change requires PayPal approval"
            : "Plan change scheduled",
        data: plan,
        approvalUrl: paypalReviseResult?.approvalUrl,
        paypalSubscriptionId: paypalReviseResult?.subscriptionId,
      });
    } catch (error: any) {
      console.error("changePlan error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    return this.handleStripeWebhookInternal(
      req,
      res,
      stripe,
      stripeWebhookSecret,
      "Stripe"
    );
  }

  async handleStripeWebhookMain(req: Request, res: Response): Promise<void> {
    if (!stripeMain) {
      res
        .status(500)
        .json({ success: false, error: "Stripe live key is not configured" });
      return;
    }
    const webhookSecret = stripeWebhookSecretMain || stripeWebhookSecret;
    if (!webhookSecret) {
      res.status(500).json({
        success: false,
        error: "Stripe webhook secret not configured",
      });
      return;
    }
    return this.handleStripeWebhookInternal(
      req,
      res,
      stripeMain,
      webhookSecret,
      "Stripe (main)"
    );
  }

  private async handleStripeWebhookInternal(
    req: Request,
    res: Response,
    stripeClient: Stripe,
    webhookSecret: string | undefined,
    label: string
  ): Promise<void> {
    try {
      const sig = req.headers["stripe-signature"];
      if (!sig || Array.isArray(sig)) {
        res.status(400).json({
          success: false,
          error: "Missing/invalid Stripe-Signature header",
        });
        return;
      }

      if (!webhookSecret) {
        res.status(500).json({
          success: false,
          error: `${label} webhook secret not configured`,
        });
        return;
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : (req as any).rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        res.status(400).json({
          success: false,
          error: "Raw request body not available for signature verification",
        });
        return;
      }

      const event = stripeClient.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );

      console.log(`✅ ${label} webhook verified: ${event.type} (${event.id})`);

      const dataObject = event.data.object as any;
      await this.processStripeWebhook(event.type, dataObject, stripeClient);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error(`${label} webhook failed:`, error);
      res.status(400).json({ success: false, error: error?.message });
    }
  }

  async handlePaypalWebhook(req: Request, res: Response): Promise<void> {
    return this.handlePaypalWebhookInternal(
      req,
      res,
      usePaypalSandbox,
      paypalWebhookId
    );
  }

  async handlePaypalWebhookMain(req: Request, res: Response): Promise<void> {
    return this.handlePaypalWebhookInternal(
      req,
      res,
      false,
      paypalWebhookIdMain
    );
  }

  private async handlePaypalWebhookInternal(
    req: Request,
    res: Response,
    useSandbox: boolean,
    webhookId?: string
  ): Promise<void> {
    try {
      const headers: PaypalWebhookHeaders = {
        transmission_id: req.headers["paypal-transmission-id"],
        transmission_time: req.headers["paypal-transmission-time"],
        cert_url: req.headers["paypal-cert-url"],
        auth_algo: req.headers["paypal-auth-algo"],
        transmission_sig: req.headers["paypal-transmission-sig"],
      };

      await this.verifyPaypalWebhookSignature(
        headers,
        req.body,
        webhookId,
        useSandbox
      );

      const eventType = req.body.event_type;
      const resource = req.body.resource || {};
      await this.processPaypalWebhook(eventType, resource);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("PayPal webhook error:", error);
      res.status(400).json({ success: false, error: error?.message });
    }
  }

  private async verifyPaypalWebhookSignature(
    headers: PaypalWebhookHeaders,
    body: any,
    webhookId: string | undefined,
    useSandbox: boolean
  ): Promise<void> {
    if (!webhookId) {
      return;
    }

    const config = this.getPaypalWebhookConfig(useSandbox);
    if (!config.clientId || !config.secret) {
      throw new Error(
        `PayPal credentials are not configured for ${
          useSandbox ? "sandbox" : "live"
        } mode`
      );
    }

    const payload = {
      transmission_id: headers.transmission_id,
      transmission_time: headers.transmission_time,
      cert_url: headers.cert_url,
      auth_algo: headers.auth_algo,
      transmission_sig: headers.transmission_sig,
      webhook_id: webhookId,
      webhook_event: body,
    };
    const token = Buffer.from(`${config.clientId}:${config.secret}`).toString(
      "base64"
    );
    const response = await axios.post(
      `${config.baseUrl}${PAYPAL_VERIFY_PATH}`,
      payload,
      {
        headers: {
          Authorization: `Basic ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const status = response.data?.verification_status;
    if (status !== "SUCCESS") {
      throw new Error(
        `PayPal webhook verification failed (${status ?? "UNKNOWN"})`
      );
    }
  }

  private getPaypalWebhookConfig(useSandbox: boolean) {
    if (useSandbox) {
      return {
        baseUrl: PAYPAL_SANDBOX_BASE_URL,
        clientId: keys.paypal_client_id_test.key,
        secret: keys.paypal_secret_key_test.key,
      };
    }

    return {
      baseUrl: PAYPAL_LIVE_BASE_URL,
      clientId: keys.paypal_client_id_live.key,
      secret: keys.paypal_secret_key_live.key,
    };
  }

  private async processStripeWebhook(
    eventType: string,
    resource: any,
    stripeClient: Stripe
  ): Promise<void> {
    if (!resource) return;

    if (eventType === "checkout.session.completed") {
      if (!this.isBitcoinyaySubscriptionSession(resource)) {
        console.log(
          "[Bitcoinyay] Ignoring Stripe checkout session not tagged for Bitcoinyay subscriptions",
          resource?.id
        );
        return;
      }
      await this.handleStripeSession(resource, stripeClient);
    } else if (eventType === "invoice.payment_succeeded") {
      await this.handleStripeInvoice(resource);
    }
  }

  private isBitcoinyaySubscriptionSession(session: any): boolean {
    const metadata = session?.metadata || {};
    const provider = String(metadata?.provider || "")
      .trim()
      .toLowerCase();
    const hasRecordId = Boolean(metadata?.bitcoinyaySubscriptionId);
    const hasPlanKey = Boolean(metadata?.planKey);
    const isSubscriptionMode = String(session?.mode || "")
      .trim()
      .toLowerCase() === "subscription";

    return hasRecordId || (provider === "stripe" && hasPlanKey && isSubscriptionMode);
  }

  private async handleStripeSession(
    session: any,
    stripeClient: Stripe
  ): Promise<void> {
    const recordId = session.metadata?.bitcoinyaySubscriptionId;
    let record = recordId
      ? await this.service.findById(recordId)
      : await this.service.findOne({ stripeCheckoutSessionId: session.id });

    const subscription =
      session.subscription &&
      typeof session.subscription === "string" &&
      (await stripeClient.subscriptions.retrieve(session.subscription, {
        expand: ["items.data.plan.product"],
      }));

    if (!record && subscription?.metadata?.bitcoinyaySubscriptionId) {
      record = await this.service.findById(
        subscription.metadata.bitcoinyaySubscriptionId
      );
    }

    if (!record && subscription?.id) {
      record = await this.service.findOne({
        stripeSubscriptionId: subscription.id,
      });
    }

    if (!record && this.isBitcoinyaySubscriptionSession(session) && session.customer_email) {
      record = await this.service.findLatest({
        email: String(session.customer_email).toLowerCase(),
        provider: "stripe",
        status: { $in: ["pending", "active"] },
      });
    }

    if (!record) {
      console.warn("Stripe session has no matching record", session.id);
      return;
    }

    const recordDoc = record as BitcoinyaySubscriptionDocument;

    const updates: any = {
      status: "active",
      lastPaymentStatus: session.payment_status,
      updatedAt: new Date(),
    };

    if (subscription) {
      updates.stripeSubscriptionId = subscription.id;
      const firstItem = subscription.items?.data?.[0];
      if (firstItem) {
        updates.stripeSubscriptionItemId = firstItem.id;
        updates.stripePriceId = firstItem.price?.id;
        const product = firstItem.price?.product;
        updates.stripeProductId =
          typeof product === "string" ? product : product?.id;
      }
    }

    await this.service.updatePart(
      { _id: recordDoc._id },
      {
        $set: updates,
        $push: {
          events: {
            type: "stripe.checkout.completed",
            payload: session,
            createdAt: new Date(),
          },
        },
      }
    );

    await this.subscriptionService.subscribeUser(
      recordDoc.email,
      recordDoc.planName,
      "Stripe",
      BITCOINYAY_COIN_SYMBOL
    );
    await this.completeMiningSubscriptionWebOrder(recordDoc, {
      provider: "stripe",
      merchantStatus: "stripe.checkout.completed",
      merchantReferenceId: session.id,
      payload: session,
    });
  }

  private async handleStripeInvoice(invoice: any): Promise<void> {
    const metadata =
      invoice?.lines?.data?.[0]?.metadata || invoice?.metadata || {};
    const recordId = metadata?.bitcoinyaySubscriptionId;
    let record =
      (recordId && (await this.service.findById(recordId))) ||
      (invoice?.subscription &&
        (await this.service.findOne({
          stripeSubscriptionId: invoice.subscription,
        })));

    if (!record) {
      console.warn("Invoice webhook has no matching record", invoice.id);
      return;
    }

    const recordDoc = record as BitcoinyaySubscriptionDocument;

    await this.service.updatePart(
      { _id: recordDoc._id },
      {
        $set: {
          lastPaymentStatus: invoice.status,
          updatedAt: new Date(),
        },
        $push: {
          events: {
            type: "stripe.invoice.paid",
            payload: invoice,
            createdAt: new Date(),
          },
        },
      }
    );
  }

  private async processPaypalWebhook(
    eventType: string,
    resource: any
  ): Promise<void> {
    if (!resource) return;
    const match = await this.findPaypalRecord(resource);
    if (!match) {
      console.warn("PayPal webhook cannot find record", eventType, resource);
      return;
    }

    const update: any = {
      $set: {
        updatedAt: new Date(),
        lastPaymentStatus: (resource.status || resource.state) as string,
      },
      $push: {
        events: {
          type: `paypal.${eventType.toLowerCase()}`,
          payload: resource,
          createdAt: new Date(),
        },
      },
    };

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      update.$set.status = "active";
      update.$set.paypalSubscriptionId = resource.id;
      this.applyPendingPaypalPlanToUpdate(match, update);
      await this.subscriptionService.subscribeUser(
        match.email,
        update.$set.planName || match.planName,
        "PayPal",
        BITCOINYAY_COIN_SYMBOL
      );
      await this.completeMiningSubscriptionWebOrder(match, {
        provider: "paypal",
        merchantStatus: "paypal.subscription.activated",
        merchantReferenceId: resource.id,
        payload: resource,
      });
    } else if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
      this.applyPendingPaypalPlanToUpdate(match, update);
      if (update.$set.planName) {
        await this.subscriptionService.subscribeUser(
          match.email,
          update.$set.planName,
          "PayPal",
          BITCOINYAY_COIN_SYMBOL
        );
        await this.updateMiningSubscriptionWebOrder(
          match.miningSubscriptionOrderId,
          {
            merchantStatus: "paypal.subscription.updated",
            merchantReferenceId: resource.id,
            status: OrderStatus.Completed,
            orderCompletedOn: new Date(),
            productId: update.$set.paypalPlanId,
            usdValue: update.$set.amount,
            breakdown: {
              inCurrenyName: update.$set.currency || match.currency || "USD",
              inAmount: update.$set.amount,
              outCurrencyName: update.$set.planName,
              outAmount: update.$set.miningSpeed,
              finalAmountAfterDiscount: update.$set.amount,
            },
          }
        );
      }
    } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
      update.$set.status = "cancelled";
    }

    await this.service.updatePart({ _id: match._id }, update);
  }

  private async findPaypalRecord(
    resource: any
  ): Promise<BitcoinyaySubscriptionDocument | null> {
    const customId =
      resource.custom_id || resource.customid || resource.customID || undefined;
    if (customId) {
      const maybeRecord = (await this.service.findById(
        customId
      )) as BitcoinyaySubscriptionDocument | null;
      if (maybeRecord) {
        return maybeRecord;
      }
    }

    if (resource.billing_agreement_id) {
      const maybeRecord = (await this.service.findOne({
        paypalSubscriptionId: resource.billing_agreement_id,
      })) as BitcoinyaySubscriptionDocument | null;
      if (maybeRecord) return maybeRecord;
    }

    if (resource.id) {
      const maybeRecord = (await this.service.findOne({
        paypalSubscriptionId: resource.id,
      })) as BitcoinyaySubscriptionDocument | null;
      if (maybeRecord) return maybeRecord;
    }

    return null;
  }

  private async createPaypalSubscription(
    email: string,
    plan: PlanDefinition,
    recordId: string,
    coupon?: CouponDefinition
  ) {
    const planId = await this.resolvePaypalPlanId(plan, coupon);
    const startDate = this.getPaypalStartDate();
    const payload = {
      plan_id: planId,
      start_time: startDate,
      custom_id: recordId,
      subscriber: {
        email_address: email,
      },
      application_context: {
        brand_name: "BitcoinYay",
        return_url: `${BASE_SUCCESS_URL}?recordId=${recordId}`,
        cancel_url: `${BASE_CANCEL_URL}?recordId=${recordId}`,
        user_action: "SUBSCRIBE_NOW",
      },
    };

    const token = await this.fetchPaypalAccessToken();
    const response = await axios.post(
      `${payPalBaseUrl}/v1/billing/subscriptions`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const subscription = response.data;
    const approvalUrl = (subscription.links || []).find(
      (link: any) => link.rel === "approve" || link.rel === "approval_url"
    )?.href;
    if (!approvalUrl) {
      throw new Error(
        "PayPal subscription creation did not return an approval URL"
      );
    }
    return {
      approvalUrl,
      id: subscription.id,
      raw: subscription,
    };
  }

  private async fetchPaypalAccessToken(): Promise<string> {
    if (!payPalClientId || !payPalSecret) {
      throw new Error("PayPal credentials are not configured");
    }
    const credentials = Buffer.from(
      `${payPalClientId}:${payPalSecret}`
    ).toString("base64");
    const response = await axios.post(
      `${payPalBaseUrl}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  }

  private async resolvePaypalPlanId(
    plan: PlanDefinition,
    coupon?: CouponDefinition
  ): Promise<string> {
    if (!coupon) {
      if (!plan.paypalPlanId) {
        throw new Error(`PayPal plan ID is missing for plan ${plan.key}`);
      }
      return plan.paypalPlanId;
    }
    return this.ensurePaypalCouponPlan(plan, coupon);
  }

  public async forceActivateSubscription(recordId: string) {
    const record = await this.service.findById(recordId);

    if (!record) {
      throw new Error("Record not found");
    }

    const recordDoc = record as BitcoinyaySubscriptionDocument;
    console.log(recordDoc);

    await this.service.updatePart(
      { _id: recordDoc._id },
      {
        $set: {
          status: "active",
          lastPaymentStatus: "paid",
          updatedAt: new Date(),
        },
        $push: {
          events: {
            type: "manual.payment.success",
            payload: { note: "Forced activation for testing" },
            createdAt: new Date(),
          },
        },
      }
    );

    await this.subscriptionService.subscribeUser(
      recordDoc.email,
      recordDoc.planName,
      "Manual",
      "BTCY"
    );
  }

  private async ensurePaypalCouponPlan(
    plan: PlanDefinition,
    coupon: CouponDefinition
  ): Promise<string> {
    const cacheKey = `${plan.key}:${coupon.code}`;
    if (paypalCouponPlanCache[cacheKey]) {
      return paypalCouponPlanCache[cacheKey];
    }
    if (!plan.paypalProductId) {
      throw new Error(`PayPal product ID missing for plan ${plan.key}`);
    }

    const discountedAmount = Number(
      (plan.amount * (1 - coupon.percentOff / 100)).toFixed(2)
    );
    if (discountedAmount <= 0) {
      throw new Error("Coupon discount would zero out the first payment");
    }

    const intervalUnit =
      (plan.miningInterval ?? "month") === "week" ? "WEEK" : "MONTH";

    // PayPal is strict about `name` / `description` lengths; keep them within limits.
    // This matters for HOLI20 because the coupon description is intentionally long.
    const name = truncateForPaypal(
      `BitcoinYay ${plan.name} (${coupon.code})`,
      PAYPAL_PLAN_NAME_MAX
    );
    const description = truncateForPaypal(
      `${plan.description} (${coupon.description})`,
      PAYPAL_PLAN_DESCRIPTION_MAX
    );

    const payload = {
      product_id: plan.paypalProductId,
      name,
      description,
      billing_cycles: [
        {
          tenure_type: "TRIAL",
          sequence: 1,
          total_cycles: 1,
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          pricing_scheme: {
            fixed_price: {
              currency_code: plan.currency,
              value: discountedAmount.toFixed(2),
            },
          },
        },
        {
          tenure_type: "REGULAR",
          sequence: 2,
          total_cycles: 0,
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          pricing_scheme: {
            fixed_price: {
              currency_code: plan.currency,
              value: plan.amount.toFixed(2),
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: "0",
          currency_code: plan.currency,
        },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: "0",
        inclusive: false,
      },
    };

    const token = await this.fetchPaypalAccessToken();
    const response = await axios.post(
      `${payPalBaseUrl}/v1/billing/plans`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const planId = response.data.id;
    try {
      await axios.post(
        `${payPalBaseUrl}/v1/billing/plans/${planId}/activate`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error: any) {
      if (
        error?.response?.status === 422 &&
        error.response?.data?.name === "UNPROCESSABLE_ENTITY"
      ) {
        console.warn(
          "PayPal plan activation already triggered or not needed",
          error.response?.data?.debug_id,
          error.response?.data?.details
        );
      } else {
        throw error;
      }
    }

    paypalCouponPlanCache[cacheKey] = planId;
    return planId;
  }

  private getPaypalStartDate(): string {
    const date = new Date(Date.now() + 65 * 1000);
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  private async revisePaypalSubscription(
    subscriptionId: string,
    plan: PlanDefinition,
    recordId: string
  ): Promise<{ approvalUrl?: string; subscriptionId?: string; raw: any }> {
    if (!plan.paypalPlanId) {
      throw new Error(`PayPal plan ID is missing for plan ${plan.key}`);
    }

    const token = await this.fetchPaypalAccessToken();
    const response = await axios.post(
      `${payPalBaseUrl}/v1/billing/subscriptions/${subscriptionId}/revise`,
      {
        plan_id: plan.paypalPlanId,
        application_context: {
          brand_name: "BitcoinYay",
          return_url: `${BASE_SUCCESS_URL}?recordId=${recordId}&paypalSubscriptionId=${subscriptionId}`,
          cancel_url: `${BASE_CANCEL_URL}?recordId=${recordId}&paypalSubscriptionId=${subscriptionId}`,
          user_action: "SUBSCRIBE_NOW",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const approvalUrl = (response.data?.links || []).find(
      (link: any) =>
        link.rel === "approve" ||
        link.rel === "approval_url" ||
        link.rel === "payer-action"
    )?.href;

    return {
      approvalUrl,
      subscriptionId,
      raw: response.data,
    };
  }

  private applyPendingPaypalPlanToUpdate(
    record: BitcoinyaySubscriptionDocument,
    update: any
  ): void {
    if (!record.pendingPlanKey || record.pendingPlanKey === "free") return;

    const plan = BITCOINYAY_PLAN_LOOKUP[record.pendingPlanKey.toLowerCase()];
    if (!plan) return;

    update.$set.planKey = plan.key;
    update.$set.planName = plan.name;
    update.$set.amount = plan.amount;
    update.$set.currency = plan.currency;
    update.$set.miningSpeed = plan.miningSpeed;
    update.$set.miningInterval = plan.miningInterval ?? "month";
    update.$set.paypalPlanId = plan.paypalPlanId;
    update.$set.paypalProductId = plan.paypalProductId;
    update.$set.pendingPlanKey = undefined;
    update.$set.pendingPlanName = undefined;
  }

  private createWebOrderId(): string {
    return `WEB${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private providerPaymentType(provider: string): PaymentTypes {
    return provider === "paypal" ? PaymentTypes.Paypal : PaymentTypes.Stripe;
  }

  private async createMiningSubscriptionWebOrder(
    recordId: string,
    email: string,
    provider: string,
    plan: PlanDefinition,
    useTestStripe: boolean,
    metadata: any,
    coupon?: CouponDefinition
  ): Promise<string> {
    const orderId = this.createWebOrderId();
    const paymentType = this.providerPaymentType(provider);
    const orderRate = { rate: 1, currency: plan.currency || "USD" } as Rates;
    const discountPercentage = coupon?.percentOff || 0;
    const finalAmountAfterDiscount = Number(
      (plan.amount * (1 - discountPercentage / 100)).toFixed(2)
    );
    const breakdown = {
      inCurrenyName: plan.currency || "USD",
      inAmount: plan.amount,
      outCurrencyName: plan.name,
      outAmount: plan.miningSpeed,
      finalAmountAfterDiscount,
    } as OrderBreakdown;
    const order = {
      orderId,
      status: OrderStatus.Pending,
      orderType: OrderType.MiningSubscriptionOrder,
      usdValue: finalAmountAfterDiscount,
      merchantStatus: `${provider}.purchase.initiated`,
      merchantReferenceId: recordId,
      merchantName: "BitcoinYay Web",
      orderRate,
      receiverAccount: { accountType: paymentType },
      paymentType,
      breakdown,
      user: {
        userId: String(metadata?.userId || ""),
        email,
        firstName: String(metadata?.firstName || ""),
        lastName: String(metadata?.lastName || ""),
        isVerified: false,
        language: String(metadata?.language || "en"),
        profilePhoto: "",
      },
      transactions: [],
      created: new Date(),
      comments: "BitcoinYay web mining subscription order",
      productId: provider === "paypal" ? plan.paypalPlanId : plan.stripePriceId,
      discountCode: coupon?.code || "",
      discountPercentage,
      subscriptionStartDate: new Date(),
      notes: JSON.stringify({
        source: "bitcoinyay-web",
        bitcoinyaySubscriptionId: recordId,
        provider,
        planKey: plan.key,
        stripeMode: useTestStripe ? "test" : "live",
        couponCode: coupon?.code,
        couponDiscountPercent: coupon?.percentOff,
      }),
    } as unknown as Order;

    await this.orderService.create(order);
    return orderId;
  }

  private async updateMiningSubscriptionWebOrder(
    orderId: string | undefined,
    updates: Record<string, any>
  ): Promise<void> {
    if (!orderId) return;
    await this.orderService.updatePart(
      { orderId },
      {
        $set: {
          ...updates,
          lastUpdated: new Date(),
        },
      }
    );
  }

  private async completeMiningSubscriptionWebOrder(
    record: BitcoinyaySubscriptionDocument,
    params: {
      provider: string;
      merchantStatus: string;
      merchantReferenceId?: string;
      payload?: any;
    }
  ): Promise<void> {
    const orderId = record.miningSubscriptionOrderId;
    if (!orderId) return;

    await this.updateMiningSubscriptionWebOrder(orderId, {
      status: OrderStatus.Completed,
      merchantStatus: params.merchantStatus,
      merchantReferenceId: params.merchantReferenceId,
      orderCompletedOn: new Date(),
      subscriptionStartDate: new Date(),
      productId:
        params.provider === "paypal" ? record.paypalPlanId : record.stripePriceId,
      notes: JSON.stringify({
        bitcoinyaySubscriptionId: record._id,
        provider: params.provider,
        completedBy: params.merchantStatus,
        stripeSubscriptionId: record.stripeSubscriptionId,
        paypalSubscriptionId: record.paypalSubscriptionId,
        couponCode: record.couponCode,
        couponDiscountPercent: record.couponDiscountPercent,
        eventId: params.payload?.id,
      }),
    });
  }

  private async createStripeSession(
    stripeClient: Stripe,
    email: string,
    plan: PlanDefinition,
    coupon: CouponDefinition | undefined,
    recordId: string,
    metadata: any
  ) {
    const sessionMetadata = {
      ...metadata,
      bitcoinyaySubscriptionId: recordId,
      planKey: plan.key,
      provider: "stripe",
      couponCode: coupon?.code,
    };

    const stripeCouponId = coupon
      ? await this.ensureStripeCoupon(coupon, stripeClient)
      : undefined;

    const discounts = stripeCouponId
      ? [
          {
            coupon: stripeCouponId,
          },
        ]
      : undefined;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
      {
        metadata: sessionMetadata,
      };

    const basePayload: Omit<Stripe.Checkout.SessionCreateParams, "line_items"> =
      {
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email,
        metadata: sessionMetadata,
        subscription_data: subscriptionData,
        success_url: `${BASE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: BASE_CANCEL_URL,
        ...(discounts ? { discounts } : {}),
      };

    try {
      return await stripeClient.checkout.sessions.create({
        ...basePayload,
        line_items: [this.buildStripePriceLineItem(plan)],
      });
    } catch (error: any) {
      if (this.shouldFallbackToPriceData(error, plan)) {
        console.warn(
          "Stripe price missing, falling back to price_data",
          plan.key,
          plan.stripePriceId,
          error?.message
        );
        return stripeClient.checkout.sessions.create({
          ...basePayload,
          line_items: [this.buildStripePriceDataLineItem(plan)],
        });
      }
      throw error;
    }
  }

  private buildStripePriceLineItem(
    plan: PlanDefinition
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    return {
      price: plan.stripePriceId,
      quantity: 1,
    };
  }

  private buildStripePriceDataLineItem(
    plan: PlanDefinition
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    const currency = (plan.currency || "USD").toLowerCase();
    const unitAmount = Math.round((plan.amount ?? 0) * 100);
    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData =
      keys.env.key === "development"
        ? {
            currency,
            unit_amount: unitAmount,
            recurring: {
              interval: "month",
            },
          }
        : {
            currency,
            unit_amount: unitAmount,
          };

    if (plan.stripeProductId) {
      priceData.product = plan.stripeProductId;
    } else {
      priceData.product_data = {
        name: plan.name,
        description: plan.description,
      };
    }
    return {
      price_data: priceData,
      quantity: 1,
    };
  }

  private shouldFallbackToPriceData(error: any, plan: PlanDefinition): boolean {
    if (!plan.stripeProductId) {
      return false;
    }

    const message = String(error?.message || "").toLowerCase();
    return message.includes("no such price");
  }

  private async ensureStripeCoupon(
    coupon: CouponDefinition,
    stripeClient: Stripe = stripe
  ) {
    const couponId = `bitcoinyay_${coupon.code.toLowerCase()}`;

    // Fast path: coupon already exists
    try {
      await stripeClient.coupons.retrieve(couponId);
      return couponId;
    } catch (error: any) {
      // proceed to create only if missing
      if (error?.code && error.code !== "resource_missing") {
        throw error;
      }
    }

    try {
      await stripeClient.coupons.create({
        id: couponId,
        percent_off: coupon.percentOff,
        duration: "once",
        // Stripe coupon `name` must be <= 40 chars; keep long description in our API only.
        name: coupon.code,
      });
    } catch (error: any) {
      if (error?.code === "resource_already_exists") {
        return couponId;
      }
      // Do not silently continue — caller will fail later with "No such coupon"
      throw error;
    }
    return couponId;
  }

  private async fetchFirstSubscriptionItem(
    stripeClient: Stripe,
    subscriptionId: string
  ) {
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    return subscription.items?.data?.[0]?.id;
  }
}
