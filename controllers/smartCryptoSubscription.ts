import axios from "axios";
import { keys } from "../config/keys";
import smartCryptoPaypalPlans from "../config/smartCryptoPaypalPlans.json";
import {
  SMART_CRYPTO_PLAN_MAP,
  SMART_CRYPTO_SUBSCRIPTION_PLANS,
  SmartCryptoPlanId,
} from "../config/smartCryptoSubscriptionPlans";
import { getPriceByName } from "./priceAPI";
import { OrderStatus, OrderType } from "../data/order";
import { Transaction } from "../data/transaction";
import { SmartCrypto } from "../data/smartCrypto";
import { OrderService } from "../services/order.service";
import { SmartCryptoService } from "../services/smartCrypto.service";
import { SmartCryptoSubscriptionService } from "../services/smartCryptoSubscription.service";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";
import { PaymentTypes } from "../data/common";
import { adjustBalancesNoTxn } from "../helpers/walletHelpers";
import { v1 as uuidv1 } from "uuid";
import { UserRoleTypes } from "../data/user";
import { TygaPayOperations } from "../platform/tygapay.operations";

const subscriptionService = new SmartCryptoSubscriptionService();
const transactionService = new TransactionService();
const orderService = new OrderService();
const smartCryptoService = new SmartCryptoService();
const userService = new UserService();

const env = keys.env.key || "development";
const envMode = env.toLowerCase();
const testOverride = String(
  process.env.SMARTCRYPTO_USE_TEST_PROVIDERS ?? ""
)
  .trim()
  .toLowerCase();
const useSandbox =
  !["false", "0", "no"].includes(testOverride) ||
  ["development", "dev", "test"].includes(envMode);

const payPalBaseUrl = useSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";
const payPalClientId = useSandbox
  ? keys.paypal_client_id_test.key
  : keys.paypal_client_id_live.key;
const payPalSecret = useSandbox
  ? keys.paypal_secret_key_test.key
  : keys.paypal_secret_key_live.key;

const defaultSuccessUrl =
  process.env.SMARTCRYPTO_SUBSCRIPTION_SUCCESS_URL ||
  "https://cex.indexx.ai/indexx-exchange/dashboard";
const defaultCancelUrl =
  process.env.SMARTCRYPTO_SUBSCRIPTION_CANCEL_URL ||
  "https://cex.indexx.ai/indexx-exchange/dashboard";

type PaypalPlanConfig = Record<string, { planId?: string; productId?: string }>;
const paypalPlanConfig: PaypalPlanConfig =
  (smartCryptoPaypalPlans as any)[useSandbox ? "sandbox" : "live"] || {};

type PaymentMethodKind = "paypal" | "manual" | "wallet";

function isSmartCryptoPlanId(value: string): value is SmartCryptoPlanId {
  return Object.prototype.hasOwnProperty.call(SMART_CRYPTO_PLAN_MAP, value);
}

function normalizeEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizePaymentMethod(methodRaw: string): {
  method: string;
  kind: PaymentMethodKind;
} | null {
  const value = String(methodRaw || "").trim().toLowerCase();
  if (!value) return null;

  if (["paypal", "credit card", "card"].includes(value)) {
    return { method: "paypal", kind: "paypal" };
  }
  if (
    [
      "ach",
      "wire",
      "wire transfer",
      "wiretransfer",
      "zelle",
      "tygapay",
      "tygapy",
      "typapay",
      "venmo",
    ].includes(value)
  ) {
    const normalized = value
      .replace("wire transfer", "wire")
      .replace("wiretransfer", "wire")
      .replace("tygapy", "tygapay")
      .replace("typapay", "tygapay");
    return { method: normalized, kind: "manual" };
  }
  if (
    ["usd", "usd balance", "asset wallet", "wallet", "balance"].includes(value)
  ) {
    return { method: "usd_balance", kind: "wallet" };
  }

  return null;
}

const manualRedirectUrlMap: Record<string, string | undefined> = {
  zelle: process.env.SMARTCRYPTO_REDIRECT_ZELLE,
  venmo: process.env.SMARTCRYPTO_REDIRECT_VENMO,
  ach: process.env.SMARTCRYPTO_REDIRECT_ACH,
  wire: process.env.SMARTCRYPTO_REDIRECT_WIRE,
  tygapay: process.env.SMARTCRYPTO_REDIRECT_TYGAPAY,
};

function getManualRedirectUrl(method: string): string | undefined {
  const normalized = String(method || "").trim().toLowerCase();
  return (
    manualRedirectUrlMap[normalized] ||
    process.env.SMARTCRYPTO_REDIRECT_MANUAL
  );
}

function extractTygaPayRedirectUrl(payload: any): string | undefined {
  const data = payload?.data ?? payload;
  const candidates = [
    data?.paymentUrl,
    data?.redirectUrl,
    data?.checkoutUrl,
    data?.url,
    data?.link,
  ];
  return candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

function mapManualPaymentType(method: string): PaymentTypes {
  const normalized = String(method || "").trim().toLowerCase();
  switch (normalized) {
    case "ach":
      return PaymentTypes.ACH;
    case "wire":
      return PaymentTypes.Wire;
    case "zelle":
      return PaymentTypes.Zelle;
    case "venmo":
      return PaymentTypes.Venmo;
    case "tygapay":
      return PaymentTypes.TygaPay;
    default:
      return PaymentTypes.BankDirect;
  }
}

function buildManualOrderPayload(params: {
  subscriptionId: string;
  user: any;
  plan: { amount: number; currency: string };
  paymentMethod: string;
  portfolioName?: string;
  managedBy?: string;
}) {
  const outCurrencyName = params.portfolioName
    ? `${params.portfolioName}|${params.managedBy || ""}`.trim()
    : "Smart Crypto Subscription";

  return {
    orderId: params.subscriptionId,
    status: OrderStatus.Quoted,
    orderType: OrderType.Subscription,
    orderRate: { rate: 0, currency: params.plan.currency },
    receiverAccount: {},
    paymentType: mapManualPaymentType(params.paymentMethod),
    breakdown: {
      inCurrenyName: params.plan.currency,
      inAmount: params.plan.amount,
      outCurrencyName,
      outAmount: 0,
    },
    user: {
      userId: params.user?._id,
      email: params.user?.email,
      firstName: params.user?.firstName || "",
      lastName: params.user?.lastName || "",
      isVerified: params.user?.verification?.activated || false,
      language: params.user?.language || "",
    },
    created: new Date(),
    exchangeFees: 0,
    isCaptainPerformingOrder: false,
    captainBeeEmail: "",
  };
}

async function getPayPalToken(): Promise<string> {
  if (!payPalClientId || !payPalSecret) {
    throw new Error("PayPal credentials are not configured");
  }
  const credentials = Buffer.from(`${payPalClientId}:${payPalSecret}`).toString(
    "base64"
  );
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

async function createPayPalSubscription(
  planId: string,
  email: string,
  returnUrl: string,
  cancelUrl: string
) {
  const token = await getPayPalToken();
  const payload: any = {
    plan_id: planId,
    application_context: {
      brand_name: "Indexx Exchange",
      locale: "en-US",
      shipping_preference: "NO_SHIPPING",
      user_action: "SUBSCRIBE_NOW",
      payment_method: {
        payer_selected: "PAYPAL",
        payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
      },
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  if (email) {
    payload.subscriber = { email_address: email };
  }

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
  return response.data;
}

export const getSmartCryptoSubscriptionPlans = async (req: any, res: any) => {
  res.json({ success: true, data: SMART_CRYPTO_SUBSCRIPTION_PLANS });
};

export const getSmartCryptoSubscription = async (req: any, res: any) => {
  try {
    const userId = String(req.query.userId || "");
    const email = normalizeEmail(req.query.email || "");
    const authEmail = normalizeEmail(req.user?.email || "");

    if (!userId && !email) {
      return res
        .status(400)
        .json({ success: false, error: "userId or email is required" });
    }

    if (authEmail) {
      const authUser = await userService.findOne({ email: authEmail } as any);
      if (!authUser) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      if (userId && String(authUser._id) !== String(userId)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      if (email && authEmail !== email) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
    }

    const filter: any = {};
    if (userId) filter.userId = userId;
    if (email) filter.email = email;

    const subscription = await subscriptionService.findLatest(filter);
    return res.json({ success: true, data: subscription });
  } catch (err) {
    console.error("Error fetching smart crypto subscription:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const createSmartCryptoSubscription = async (req: any, res: any) => {
  try {
    const {
      planId,
      amount,
      currency,
      paymentMethod,
      paymentReference,
      returnUrl,
      cancelUrl,
      portfolioName,
      planManagedBy,
      managedBy,
      notes,
      email
    } = req.body || {};

    if (!planId || !paymentMethod) {
      return res
        .status(400)
        .json({ success: false, error: "userId, planId, and paymentMethod are required" });
    }

    const planKey = String(planId || "").trim();
    if (!isSmartCryptoPlanId(planKey)) {
      return res.status(400).json({ success: false, error: "Invalid planId" });
    }
    const plan = SMART_CRYPTO_PLAN_MAP[planKey];

    const parsedAmount = Number(amount ?? plan.amount);
    if (!Number.isFinite(parsedAmount)) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }
    if (parsedAmount !== plan.amount) {
      return res.status(400).json({ success: false, error: "Amount does not match plan" });
    }

    const currencyCode = String(currency || plan.currency).toUpperCase();
    if (currencyCode !== plan.currency) {
      return res.status(400).json({ success: false, error: "Invalid currency" });
    }

    const normalized = normalizePaymentMethod(paymentMethod);
    if (!normalized) {
      return res.status(400).json({ success: false, error: "Unsupported payment method" });
    }

    const authEmail = normalizeEmail(email || "");
    if (authEmail) {
      const authUser = await userService.findOne({ email: authEmail } as any);
      if (!authUser) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
    }

    const user = await userService.findOne({email:String(authEmail)}).catch(() => null);
    if (!user || !(user as any).email) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const portfolio = String(portfolioName || "").trim();
    const manager = String(planManagedBy || managedBy || "").trim();
    const noteText = String(notes || "").trim();

    if (normalized.kind === "paypal") {
      const paypalPlan = paypalPlanConfig[plan.planId];
      if (!paypalPlan?.planId) {
        return res
          .status(500)
          .json({ success: false, error: "PayPal plan is not configured" });
      }

      const subscription = await createPayPalSubscription(
        paypalPlan.planId,
        email,
        String(returnUrl || defaultSuccessUrl),
        String(cancelUrl || defaultCancelUrl)
      );

      const approvalUrl = (subscription.links || []).find(
        (link: any) => link.rel === "approve" || link.rel === "approval_url"
      )?.href;

      if (!approvalUrl) {
        await subscriptionService.create({
          email,
          planId: plan.planId,
          planName: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          paymentMethod: normalized.method,
          paymentReference: paymentReference ? String(paymentReference) : undefined,
          status: "failed",
          paypalPlanId: paypalPlan.planId,
          paypalProductId: paypalPlan.productId,
          paypalSubscriptionId: subscription.id,
          metadata: {
            provider: "paypal",
            planId: paypalPlan.planId,
            error: "approval_url_missing",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return res.status(500).json({
          success: false,
          error: "PayPal approval URL missing",
        });
      }

      const record = await subscriptionService.create({
        email,
        planId: plan.planId,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        paymentMethod: normalized.method,
        paymentReference: paymentReference ? String(paymentReference) : undefined,
        status: "pending",
        paypalPlanId: paypalPlan.planId,
        paypalProductId: paypalPlan.productId,
        paypalSubscriptionId: subscription.id,
        paypalApprovalUrl: approvalUrl,
        nextBillingDate: subscription?.billing_info?.next_billing_time
          ? new Date(subscription.billing_info.next_billing_time)
          : undefined,
        metadata: {
          provider: "paypal",
          planId: paypalPlan.planId,
          portfolioName: portfolio || undefined,
          managedBy: manager || undefined,
          notes: noteText || undefined,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return res.json({
        success: true,
        data: {
          subscriptionId: (record as any)?._id || null,
          status: record.status,
          approvalUrl,
          provider: "paypal",
        },
      });
    }

    if (normalized.kind === "wallet") {
      try {
        await adjustBalancesNoTxn(email, { symbol: "USD", amount: plan.amount });
      } catch (err: any) {
        const message = err?.message || "Unable to debit USD balance";
        return res.status(400).json({ success: false, error: message });
      }

      const nextBillingDate = new Date();
      nextBillingDate.setUTCMonth(nextBillingDate.getUTCMonth() + 1);

      const transaction: Transaction = {
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: email,
        to: "Smart Crypto Subscription",
        amount: plan.amount,
        info: "Smart crypto monthly subscription",
        status: OrderStatus.Completed,
        currencyRef: "USD",
        walletType: "Asset Wallet",
        transactionType: "SMART_CRYPTO_SUBSCRIPTION",
        exchangeName: "CEX",
        email,
        txDate: new Date(),
        benificaryAddress: "",
        amountInvested: plan.amount,
        notes: `Smart Crypto Monthly Subscription - ${plan.amount} ${plan.currency}`,
      };
      await transactionService.create(transaction);

      const record = await subscriptionService.create({
        email,
        planId: plan.planId,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        paymentMethod: normalized.method,
        paymentReference: paymentReference ? String(paymentReference) : undefined,
        status: "active",
        nextBillingDate,
        metadata: {
          provider: "wallet",
          portfolioName: portfolio || undefined,
          managedBy: manager || undefined,
          notes: noteText || undefined,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return res.json({
        success: true,
        data: {
          subscriptionId: (record as any)?._id || null,
          status: record.status,
          message: "USD balance debited; subscription active.",
        },
      });
    }

    const redirectUrl = getManualRedirectUrl(normalized.method);
    const record = await subscriptionService.create({
      email,
      planId: plan.planId,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      paymentMethod: normalized.method,
      paymentReference: paymentReference ? String(paymentReference) : undefined,
      status: "manual_pending",
      metadata: {
        provider: "manual",
        portfolioName: portfolio || undefined,
        managedBy: manager || undefined,
        notes: noteText || undefined,
        manualRedirectUrl: redirectUrl || undefined,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let tygaPayOrder: any = null;
    let finalRedirectUrl = redirectUrl || null;

    if (normalized.method === "tygapay") {
      try {
        const tygaOps = new TygaPayOperations(req, res);
        tygaPayOrder = await tygaOps.createNewOrder(
          email,
          String((record as any)?._id || ""),
          plan.amount
        );
        const tygaRedirect = extractTygaPayRedirectUrl(tygaPayOrder);
        if (tygaRedirect) {
          finalRedirectUrl = tygaRedirect;
        }

        await subscriptionService.updatePart(
          { _id: (record as any)?._id },
          {
            $set: {
              paymentReference:
                tygaPayOrder?.data?.orderId ||
                (paymentReference ? String(paymentReference) : undefined),
              "metadata.tygapayOrderId": tygaPayOrder?.data?.orderId,
              "metadata.tygapayRedirectUrl": tygaRedirect || undefined,
              "metadata.manualRedirectUrl": tygaRedirect || redirectUrl || undefined,
            },
          }
        );
      } catch (error) {
        console.error("TygaPay order creation failed:", error);
      }
    }

    const orderPayload = buildManualOrderPayload({
      subscriptionId: String((record as any)?._id || ""),
      user,
      plan,
      paymentMethod: normalized.method,
      portfolioName: portfolio || undefined,
      managedBy: manager || undefined,
    });

    return res.json({
      success: true,
      status: 200,
      data: {
        ...orderPayload,
        subscriptionId: (record as any)?._id || null,
        subscriptionStatus: record.status,
        message:
          "Manual payment selected. Please contact support to finalize activation.",
        redirectUrl: finalRedirectUrl,
        providerResponse: tygaPayOrder || undefined,
      },
    });
  } catch (err) {
    console.error("Error creating smart crypto subscription:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

async function resolveSmartCryptoPlan(subscription: any): Promise<SmartCrypto | null> {
  const metadata = (subscription as any)?.metadata || {};
  const portfolioName = String(metadata?.portfolioName || "").trim();
  const managedBy = String(metadata?.managedBy || "").trim();

  if (portfolioName && managedBy) {
    return smartCryptoService.findLatest({
      portfolioName,
      managedBy,
      isActive: true,
    });
  }

  const amount = Number(subscription?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return smartCryptoService.findOne({
    totalInvestment: amount,
    isActive: true,
  });
}

async function applySmartCryptoAllocation(subscription: any, amountUsd: number) {
  const smartCryptoPlan = await resolveSmartCryptoPlan(subscription);
  if (!smartCryptoPlan || !Array.isArray(smartCryptoPlan.cryptocurrencies)) {
    return { applied: false, reason: "smart-crypto-plan-not-found" };
  }

  const currencies = smartCryptoPlan.cryptocurrencies;
  if (!currencies.length) {
    return { applied: false, reason: "smart-crypto-plan-empty" };
  }

  const email = normalizeEmail(subscription?.email || "");
  if (!email) {
    return { applied: false, reason: "missing-email" };
  }

  const perAssetUsd = amountUsd / currencies.length;
  const metadata = (subscription as any)?.metadata || {};
  const notes =
    String(metadata?.notes || "").trim() ||
    `Smart Crypto Monthly ${smartCryptoPlan.portfolioName || ""}`.trim();

  for (const element of currencies) {
    const token = String(element.token || "").toUpperCase().trim();
    if (!token) {
      continue;
    }
    const adminFees = await orderService.getAdminFees(token);
    const finalUsdAmount = perAssetUsd - (perAssetUsd * adminFees) / 100;
    const latestBaseRate = await getPriceByName(token);
    const rate = Number(latestBaseRate?.data || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    await orderService.updateSmartCrypto(
      email,
      token,
      finalUsdAmount / rate,
      false,
      0,
      "",
      "INVESTMENT",
      perAssetUsd,
      notes,
      adminFees,
      "paypal",
      rate
    );
  }

  return { applied: true };
}

function resolveSubscriptionStatus(eventType: string) {
  const normalized = eventType.toUpperCase();
  if (normalized === "BILLING.SUBSCRIPTION.ACTIVATED") return "active";
  if (
    normalized === "BILLING.SUBSCRIPTION.CANCELLED" ||
    normalized === "BILLING.SUBSCRIPTION.EXPIRED" ||
    normalized === "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    return "cancelled";
  }
  if (normalized === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") return "failed";
  return null;
}

export const handleSmartCryptoPaypalWebhook = async (req: any, res: any) => {
  try {
    const eventType = String(req.body?.event_type || "").trim();
    const resource = req.body?.resource || {};
    const subscriptionId = String(
      resource?.billing_agreement_id || resource?.id || ""
    ).trim();
    const saleId = String(resource?.id || "").trim();

    if (!eventType || !subscriptionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid webhook payload" });
    }

    const status = resolveSubscriptionStatus(eventType);
    const nextBilling = resource?.billing_info?.next_billing_time
      ? new Date(resource.billing_info.next_billing_time)
      : undefined;

    const subscription = await subscriptionService.findOne({
      paypalSubscriptionId: subscriptionId,
    });

    const isPaymentCompleted = eventType.toUpperCase() === "PAYMENT.SALE.COMPLETED";

    if (isPaymentCompleted && subscription) {
      const metadata = (subscription as any)?.metadata || {};
      const lastSaleId = String(metadata?.lastPaymentSaleId || "").trim();
      if (saleId && saleId === lastSaleId) {
        return res.json({ success: true, skipped: true });
      }

      await applySmartCryptoAllocation(subscription, Number(subscription?.amount ?? 0));
    }

    const update: any = {
      "metadata.lastWebhookEvent": eventType,
      "metadata.lastWebhookAt": new Date(),
    };
    if (isPaymentCompleted && saleId) {
      update["metadata.lastPaymentSaleId"] = saleId;
      update["metadata.lastPaymentAt"] = new Date();
    }
    if (nextBilling) {
      update.nextBillingDate = nextBilling;
    }
    if (status) {
      update.status = status;
    }

    await subscriptionService.updatePart(
      { paypalSubscriptionId: subscriptionId },
      { $set: update }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Smart crypto PayPal webhook error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const confirmSmartCryptoManualPayment = async (req: any, res: any) => {
  try {
    const authEmail = normalizeEmail(req.user?.email || "");
    if (!authEmail) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const adminUser = await userService.findOne({ email: authEmail } as any);
    if (
      !adminUser ||
      ![UserRoleTypes.Admin, UserRoleTypes.SuperAdmin, UserRoleTypes.CustomerSupport].includes(
        adminUser.role
      )
    ) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { subscriptionId, paymentReference, paidAt } = req.body || {};
    if (!subscriptionId) {
      return res
        .status(400)
        .json({ success: false, error: "subscriptionId is required" });
    }

    const subscription = await subscriptionService
      .findById(String(subscriptionId))
      .catch(() => null);
    if (!subscription) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    if (subscription.status !== "manual_pending") {
      return res.status(409).json({
        success: false,
        error: `Subscription status must be manual_pending (current: ${subscription.status})`,
      });
    }

    if (String(subscription.paymentMethod || "").toLowerCase() === "paypal") {
      return res
        .status(400)
        .json({ success: false, error: "PayPal subscriptions are webhook-driven" });
    }

    const amount = Number(subscription.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }

    const metadata = (subscription as any)?.metadata || {};
    const reference = String(paymentReference || "").trim();
    if (reference && String(metadata?.lastManualPaymentReference || "") === reference) {
      return res.json({ success: true, skipped: true });
    }

    const allocation = await applySmartCryptoAllocation(subscription, amount);
    if (!allocation.applied) {
      return res.status(400).json({
        success: false,
        error: allocation.reason || "Allocation failed",
      });
    }

    const nextBillingDate = new Date();
    nextBillingDate.setUTCMonth(nextBillingDate.getUTCMonth() + 1);

    const update: any = {
      status: "active",
      nextBillingDate,
      "metadata.lastManualPaymentAt": paidAt ? new Date(paidAt) : new Date(),
      "metadata.lastManualConfirmedBy": authEmail,
      "metadata.lastManualConfirmedAt": new Date(),
    };

    if (reference) {
      update.paymentReference = reference;
      update["metadata.lastManualPaymentReference"] = reference;
    }

    await subscriptionService.updatePart({ _id: (subscription as any)._id }, { $set: update });

    return res.json({
      success: true,
      data: {
        subscriptionId: (subscription as any)?._id,
        status: "active",
      },
    });
  } catch (err) {
    console.error("Error confirming smart crypto manual payment:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
