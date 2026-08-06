import { Request, Response } from "express";
import { getPriceByName } from "../controllers/priceAPI";
import { Currency, PaymentTypes, TransactionAccount } from "../data/common";
import {
  Order,
  OrderBreakdown,
  OrderStatus,
  OrderTransaction,
  OrderType,
  Rates,
} from "../data/order";
import { buyIndexxTokensPoints, transactionPoints } from "../data/taskCenter";
import { UserLite, UserRoleTypes, UserWallet } from "../data/user";
import { AppSettingsService } from "../services/appSettings.service";
import { CurrencyService } from "../services/currency.service";
import { OrderService } from "../services/order.service";
import { RewardService } from "../services/reward.service";
import { TaskCenterService } from "../services/taskCenter.service";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";
import { CurrencyOperations } from "./currency.operations";
import { SendEmail } from "./email.operations";
import {
  cancelSubscription,
  capturePayment,
  createPaypalOrder,
  createPaypalOrderForBitcoinYay,
  createPaypalOrderForDeposit,
  createSubscription,
  getSubscriptionDetails,
} from "./paypal.wrapper";
import { PaypalService } from "../services/paypal.service";
import { getLatestFTTPrice } from "../helpers/getFTTPrice";
import { AffilateService } from "../services/affiliate.service";
import { TxOperations } from "./tx.operations";
import { PowerPackService } from "../services/powerPack.service";
import { UserOperations } from "./user.operations";
import { DiscountCodeService } from "../services/discountCode.service";
import { ETFOperations } from "./etf.operations";
import { SubscriptionStatus } from "../data/paypalSubscription";
import { PaypalSubscriptionService } from "../services/paypalSubscription.service";
import { TransactionService } from "../services/transaction.service";
import { PaymentTxLockService } from "../services/paymentTxLock.service";
import { NonPaypalSubscriptionService } from "../services/nonPaypalSubscription.service";
import { NonPaypalSubscription } from "../data/nonPaypalSubscription";
import { ReferralEarningService } from "../services/referralEarning.service";
import { TygaPayOperations } from "./tygapay.operations";
import { startOfMonth, endOfMonth } from "date-fns";
import { generatePDF, generatePDFForWeekly } from "../helpers/generatePDF";
import { ShopOrdersService } from "../services/shop.order.service";
import {
  createFreeGiftCard,
  createGiftCard,
} from "../helpers/createShopGiftCard";
import { SmartCryptoService } from "../services/smartCrypto.service";
import { SubscriptionPlansService } from "../services/miningSubscriptionPlan.service";
import { SubscriptionService } from "../services/subscription.service";
import { MiningService } from "../services/mining.service";
import {
  DEFAULT_GOOGLE_PLAY_PACKAGE_NAME,
  GooglePlaySubscriptionSyncService,
} from "../services/googlePlaySubscriptionSync.service";
import { KycApplicationService } from "../services/kycApplication.service";
import { KybApplicationService } from "../services/kybApplication.service";
import { BTCYBuyHistoryService } from "../services/btcyBuyHistory.service";
import { BitcoinyaySubscriptionService } from "../services/bitcoinyaySubscription.service";
import { KycStatus } from "../data/kycApplication";
import { KybStatus } from "../data/kybApplication";
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { ChatSocketService } from "../services/chatWebsocket.service";
import {
  calculateFeeAmount,
  getOurWalletAddress,
  startPaymentMonitoring,
} from "./cryptoPayment.operations";
import {
  calculateQuantumBtcyOutAmountFromFeeData,
  resolveQuantumBtcyUsdRate,
} from "../helpers/quantumBtcyPricing";
import { applyIndependenceWeekQuantumBtcyBonus } from "../helpers/quantumBtcyBonus";
import { getConfiguredBtcyFeePercent } from "../helpers/btcyFees";
const axios = require("axios");

const shopOrdersService: ShopOrdersService = new ShopOrdersService();
let affilateService: AffilateService = new AffilateService();
let uservice: UserService = new UserService();
let orderService: OrderService = new OrderService();
let nonPaypalSubscriptionService: NonPaypalSubscriptionService =
  new NonPaypalSubscriptionService();
let currencyService: CurrencyService = new CurrencyService();
let appSettingsService: AppSettingsService = new AppSettingsService();
let rewardService: RewardService = new RewardService();
let taskCenterService: TaskCenterService = new TaskCenterService();
let paypalService: PaypalService = new PaypalService();
let paypalSubscriptionService: PaypalSubscriptionService =
  new PaypalSubscriptionService();
let btcyBuyHistoryService: BTCYBuyHistoryService = new BTCYBuyHistoryService();
let paymentTxLockService: PaymentTxLockService = new PaymentTxLockService();
let txservice: TransactionService = new TransactionService();
let powerpackService: PowerPackService = new PowerPackService();
let discountCodeService: DiscountCodeService = new DiscountCodeService();
const referralEarningService: ReferralEarningService =
  new ReferralEarningService();
const smartCryptoService: SmartCryptoService = new SmartCryptoService();
const subscriptionPlansService: SubscriptionPlansService =
  new SubscriptionPlansService();
const userSubscriptionService: SubscriptionService = new SubscriptionService();
const miningService: MiningService = new MiningService();
const bitcoinyaySubscriptionService = new BitcoinyaySubscriptionService();

const googlePlaySubscriptionSyncService: GooglePlaySubscriptionSyncService =
  new GooglePlaySubscriptionSyncService();
const kycApplicationService: KycApplicationService =
  new KycApplicationService();
const kybApplicationService: KybApplicationService =
  new KybApplicationService();

const KYC_REVIEW_MESSAGE =
  "Your KYC is in review. Orders greater than $599 require KYC approval. Please wait 1–3 business days for your KYC approval.";

const applyQuantumBtcyBonus = applyIndependenceWeekQuantumBtcyBonus;

type KycGateStatus = "approved" | "pending" | "missing";

async function resolveKycGateStatus(user: any): Promise<KycGateStatus> {
  if (!user) return "missing";

  const userId = (user as any)?._id?.toString
    ? (user as any)._id.toString()
    : (user as any)?._id;
  const emailLower = String(user?.email || "")
    .toLowerCase()
    .trim();

  const userKycStatus = String(user?.kycStatus || "")
    .toLowerCase()
    .trim();
  if (
    ["completed", "approved"].includes(userKycStatus) ||
    user?.isKYCPass === true
  ) {
    return "approved";
  }
  try {
    const kycCond: any = {};
    const kybCond: any = {};
    const kycOr: any[] = [];
    if (userId) kycOr.push({ userId });
    if (emailLower) {
      kycOr.push({ userEmailLower: emailLower });
      kycOr.push({ userEmail: emailLower });
    }
    if (kycOr.length) kycCond.$or = kycOr;

    const kybOr: any[] = [];
    if (userId) kybOr.push({ userId });
    if (emailLower) {
      kybOr.push({ userEmail: emailLower });
    }
    if (kybOr.length) kybCond.$or = kybOr;

    const [kycLatest, kybLatest] = await Promise.all([
      kycApplicationService.findLatest(kycCond),
      kybApplicationService.findLatest(kybCond),
    ]);

    if (
      kycLatest?.status === KycStatus.APPROVED ||
      kybLatest?.status === KybStatus.APPROVED
    ) {
      return "approved";
    }

    const hasApp = !!kycLatest || !!kybLatest;

    if (
      (kycLatest &&
        [KycStatus.DRAFT, KycStatus.PENDING, KycStatus.UNDER_REVIEW].includes(
          kycLatest.status
        )) ||
      (kybLatest &&
        [KybStatus.DRAFT, KybStatus.PENDING, KybStatus.UNDER_REVIEW].includes(
          kybLatest.status
        ))
    ) {
      return "pending";
    }

    if (
      hasApp &&
      [
        "pending",
        "under_review",
        "under review",
        "in_review",
        "in review",
      ].includes(userKycStatus)
    ) {
      return "pending";
    }

    return "missing";
  } catch (err) {
    console.error("KYC/KYB pending check failed:", err);
    return "missing";
  }
}

type AppleReceipt = {
  unified_receipt: {
    latest_receipt_info?: any[];
    latest_receipt?: string;
  };
  notification_type?: string;
};

type GoogleReceipt = {
  orderId?: string;
  packageName: string;
  productId: string;
  purchaseToken: string;
  purchaseTime?: Date;
  autoRenewing?: boolean;
};

type ParsedReceipt = AppleReceipt | GoogleReceipt;

type Input = {
  txHash?: string; // crypto
  paypalTxnId?: string; // PayPal/Card
  proofUrl?: string; // screenshot for PayPal/Card
  amount?: number; // optional
};

async function findOrder(orderId: string) {
  return orderService.findOne({ orderId });
}

type ClaimCrypto = {
  email: string;
  blockchain: "Ethereum" | "Solana";
  coin: "USDT" | "USDC";
  txHash: string;
  amount?: number;
  paidAt?: string;
};

type ClaimPaypal = {
  email: string;
  paymentMethod: "PayPal" | "USD";
  paypalTxnId?: string;
  processorTxnId?: string;
  proofUrl: string;
  amount?: number;
  paidAt?: string;
};

type ClaimBody = Partial<ClaimCrypto & ClaimPaypal>;

const TOLERANCE = 0.01; // 1%
const LOOKBACK_HOURS = 24;
/**
 * Returns 'USDT' | 'USDC' | 'USD' | 'PAYPAL' based on your stored shape.
 * Your create flows set `currency` to currencyIn (uppercased).
 */
function inferPaymentMethod(
  order: any
): "USDT" | "USDC" | "USD" | "PAYPAL" | "UNKNOWN" {
  const c = String(order?.currency || "").toUpperCase();
  if (c === "USDT" || c === "USDC") return c as any;
  if (c === "USD") return "USD";
  if (c.includes("PAYPAL")) return "PAYPAL"; // in case you stored like 'USD' but commented PayPal in notes
  // Fallback: look into comments/breakdown for hints
  const hint = String(order?.comments || "").toUpperCase();
  if (hint.includes("PAYPAL")) return "PAYPAL";
  return c === "USD" ? "USD" : "UNKNOWN";
}

/**
 * Check duplicate by scanning transactions for matching txHash / trnReference.
 */
function hasDuplicateProof(order: any, txHash?: string, paypalTxnId?: string) {
  const txs: OrderTransaction[] = Array.isArray(order?.transactions)
    ? order.transactions
    : [];
  if (txHash) {
    const dup = txs.find(
      (t) => (t.trnHash || "").toLowerCase() === txHash.toLowerCase()
    );
    if (dup) return true;
  }
  if (paypalTxnId) {
    const dup = txs.find(
      (t) => (t.trnReference || "").toLowerCase() === paypalTxnId.toLowerCase()
    );
    if (dup) return true;
  }
  return false;
}

async function reserveProofIdentifier(input: {
  txId?: string;
  orderId: string;
  email?: string;
  blockchain?: string;
  paymentType?: string;
  amount?: number;
  receiverAddress?: string;
}) {
  const txId = String(input.txId || "").trim();
  if (!txId) {
    return { ok: true as const, existingOrderId: null };
  }

  return paymentTxLockService.claimTxHash({
    txHash: txId,
    orderId: input.orderId,
    email: input.email,
    status: "submitted",
    blockchain: input.blockchain,
    paymentType: input.paymentType,
    amount: input.amount,
    receiverAddress: input.receiverAddress,
  });
}

/**
 * Persist a "proof" transaction (not final confirmation).
 * Keeps the model consistent and avoids duplicates.
 */
async function recordProofTx(
  order: any,
  input: Input,
  method: "USDT" | "USDC" | "USD" | "PAYPAL"
) {
  const now = new Date();
  const txId = input.txHash || input.paypalTxnId || "";

  // build a user proof transaction
  const proofTx: OrderTransaction = {
    currency:
      method === "USDT"
        ? Currency.USDT
        : method === "USDC"
          ? Currency.USDC
          : Currency.USD,
    amount: Number(input.amount || order?.breakdown?.inAmount || 0),
    trnReference: input.paypalTxnId || "",
    trnHash: input.txHash || "",
    walletAddress:
      method === "USDT" || method === "USDC"
        ? String(order?.receiverAccount?.userReceiveAddress || "")
        : "PayPal",
    created: now,
    status: "Submitted", // not completed yet
  };

  const lockClaim = await reserveProofIdentifier({
    txId,
    orderId: order.orderId,
    email: order?.user?.email || "",
    blockchain: order?.blockchainName || "",
    paymentType: method,
    amount: proofTx.amount,
    receiverAddress: proofTx.walletAddress,
  });
  if (!lockClaim.ok) {
    return {
      ok: false as const,
      duplicateOrderId: lockClaim.existingOrderId || null,
    };
  }

  // Idempotent transaction create: only if not exists
  if (!hasDuplicateProof(order, input.txHash, input.paypalTxnId)) {
    const txPayload = {
      email: order?.user?.email || "",
      orderId: order.orderId,
      extRef: txId,
      txId,
      from: method === "PAYPAL" || method === "USD" ? "PayPal/User" : "User",
      to:
        method === "PAYPAL" || method === "USD"
          ? "PaymentProcessor"
          : "Our Wallet",
      amount: proofTx.amount,
      info:
        method === "USDT" || method === "USDC"
          ? `${method} Proof Submitted`
          : `PayPal Proof Submitted`,
      status: OrderStatus.Payment_Submitted, // keep consistent with your enum (or string)
      currencyRef:
        method === "USDT" || method === "USDC" ? method : Currency.USD,
      exchangeName: "PaymentProcessor",
      walletType:
        method === "USDT" || method === "USDC" ? "CORE WALLET" : "PAYPAL",
      transactionType:
        method === "USDT" || method === "USDC"
          ? "CRYPTO_PROOF"
          : "PAYPAL_PROOF",
      txDate: now,
      benificaryAddress: proofTx.walletAddress,
    };

    if (txId) {
      await txservice.upsertOneAndGet(
        { txId },
        {
          $setOnInsert: txPayload,
          $set: txPayload,
        },
        { new: true, setDefaultsOnInsert: true }
      );
    } else {
      await txservice.create(txPayload as any);
    }

    await orderService.updatePart(
      { orderId: order.orderId },
      {
        $set: {
          status: "Payment_Submitted", // <-- staging status
          orderCompletedOn: null,
          // store screenshot url (if provided) safely without clobbering
          ...(input.proofUrl ? { "meta.proofUrl": input.proofUrl } : {}),
        },
        $push: { transactions: proofTx },
      }
    );
  } else {
    // If duplicate, ensure status at least shows submitted
    await orderService.updatePart(
      { orderId: order.orderId },
      {
        $set: {
          status: "Payment_Submitted",
          ...(input.proofUrl ? { "meta.proofUrl": input.proofUrl } : {}),
        },
      }
    );
  }

  // Notify client (socket)
  try {
    ChatSocketService.emitToUser(
      String(order?.user?.email || ""),
      "payment:pending",
      {
        orderId: order.orderId,
        status: "Payment_Submitted",
        method,
        txHash: input.txHash,
        paypalTxnId: input.paypalTxnId,
        proofUrl: input.proofUrl,
      }
    );
  } catch { }

  return { ok: true as const };
}

const GOOGLE_PLAY_PACKAGE_NAME = DEFAULT_GOOGLE_PLAY_PACKAGE_NAME;
const GOOGLE_PLAY_KEY_PATH = path.resolve(
  __dirname,
  "../credentials/google-play-service-account.json"
);

type GooglePlaySubscriptionLookup = {
  autoRenewing?: boolean;
  expiryTimeMillis?: string;
  startTimeMillis?: string;
  userCancellationTimeMillis?: string;
  paymentState?: number;
  cancelReason?: number;
};

function parseDateValue(value: any): Date | null {
  if (value == null || value === "") return null;
  const date =
    value instanceof Date
      ? value
      : new Date(Number.isFinite(Number(value)) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoOrNull(value: any): string | null {
  const date = parseDateValue(value);
  return date ? date.toISOString() : null;
}

function getMiningOrderPrice(order: any): number | null {
  const discounted = Number(order?.breakdown?.finalAmountAfterDiscount);
  if (Number.isFinite(discounted) && discounted > 0) return discounted;

  const inAmount = Number(order?.breakdown?.inAmount);
  if (Number.isFinite(inAmount) && inAmount > 0) return inAmount;

  const amount = Number(order?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;

  return null;
}

function getGooglePaymentStateLabel(state?: number): string | null {
  const labels: Record<number, string> = {
    0: "Pending",
    1: "Received",
    2: "Free trial",
    3: "Pending deferred upgrade/downgrade",
  };
  if (typeof state !== "number") return null;
  return labels[state] ?? String(state);
}

function buildStoredSubscriptionSummary(order: any, now: Date) {
  const startDate =
    parseDateValue(order?.subscriptionStartDate) ||
    parseDateValue(order?.created);
  const endDate =
    parseDateValue(order?.subscriptionEndDate) ||
    parseDateValue(order?.expirationDate);
  const cancelledAt = parseDateValue(order?.subscriptionCancelledAt);
  const currentAccess = endDate ? endDate.getTime() > now.getTime() : null;

  let currentStatus = String(order?.status || "Unknown");
  let statusReason = "derived from stored order fields";

  if (endDate) {
    if (endDate.getTime() <= now.getTime()) {
      currentStatus = "Expired";
      statusReason = "stored end date is in the past";
    } else if (cancelledAt) {
      currentStatus = "Active until expiry";
      statusReason =
        "subscription was cancelled but access remains until stored end date";
    } else if (String(order?.status || "").toLowerCase() === "completed") {
      currentStatus = "Active";
      statusReason = "stored order is completed and end date is in the future";
    }
  }

  return {
    startDate,
    endDate,
    cancelledAt,
    expiredDate: endDate && endDate.getTime() <= now.getTime() ? endDate : null,
    currentAccess,
    currentStatus,
    statusReason,
    statusSource: "stored" as const,
    autoRenewing: null as boolean | null,
    paymentState: null as number | null,
    paymentStateLabel: null as string | null,
  };
}

function buildGooglePlaySubscriptionSummary(
  order: any,
  googleStatus: GooglePlaySubscriptionLookup,
  now: Date
) {
  const stored = buildStoredSubscriptionSummary(order, now);
  const startDate =
    parseDateValue(googleStatus.startTimeMillis) || stored.startDate;
  const endDate =
    parseDateValue(googleStatus.expiryTimeMillis) || stored.endDate;
  const autoRenewing =
    typeof googleStatus.autoRenewing === "boolean"
      ? googleStatus.autoRenewing
      : null;
  const paymentState =
    typeof googleStatus.paymentState === "number"
      ? googleStatus.paymentState
      : null;
  const paymentStateLabel = getGooglePaymentStateLabel(
    paymentState ?? undefined
  );
  const currentAccess = endDate ? endDate.getTime() > now.getTime() : null;

  let currentStatus = "Unknown";
  let statusReason = "live status fetched from Google Play";

  if (!endDate) {
    currentStatus = stored.currentStatus;
    statusReason =
      "Google Play response had no expiry date; fell back to stored status";
  } else if (endDate.getTime() <= now.getTime()) {
    currentStatus = "Expired";
    statusReason = "Google Play expiry is in the past";
  } else if (paymentState === 0) {
    currentStatus = "Pending";
    statusReason = "Google Play payment state is pending";
  } else if (paymentState === 2) {
    currentStatus = autoRenewing ? "Free trial active" : "Free trial ending";
    statusReason = autoRenewing
      ? "Google Play free trial is active"
      : "Google Play free trial is active with auto-renew off";
  } else if (autoRenewing) {
    currentStatus = "Active";
    statusReason = "Google Play reports auto-renewing active subscription";
  } else {
    currentStatus = "Active until expiry";
    statusReason = "Google Play reports access is active until the expiry date";
  }

  const cancelledAt =
    parseDateValue(googleStatus.userCancellationTimeMillis) ??
    stored.cancelledAt;

  return {
    startDate,
    endDate,
    cancelledAt,
    expiredDate: endDate && endDate.getTime() <= now.getTime() ? endDate : null,
    currentAccess,
    currentStatus,
    statusReason,
    statusSource: "google_play" as const,
    autoRenewing,
    paymentState,
    paymentStateLabel,
  };
}

async function getGooglePlayAccessTokenForOrders(): Promise<string> {
  const keyFile = JSON.parse(fs.readFileSync(GOOGLE_PLAY_KEY_PATH, "utf-8"));
  const jwtClient = new google.auth.JWT(
    keyFile.client_email,
    undefined,
    keyFile.private_key,
    ["https://www.googleapis.com/auth/androidpublisher"]
  );

  await jwtClient.authorize();
  const accessToken = await jwtClient.getAccessToken();
  return accessToken.token as string;
}

async function fetchGooglePlaySubscriptionStatus(
  packageName: string,
  productId: string,
  purchaseToken: string,
  accessToken: string
): Promise<GooglePlaySubscriptionLookup | null> {
  try {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      return null;
    }
    throw err;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length || 1)) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

function formatMiningSubscriptionOrder(
  order: any,
  summary: {
    startDate: Date | null;
    endDate: Date | null;
    cancelledAt: Date | null;
    expiredDate: Date | null;
    currentAccess: boolean | null;
    currentStatus: string;
    statusReason: string;
    statusSource: "stored" | "google_play" | "stored_fallback";
    autoRenewing: boolean | null;
    paymentState: number | null;
    paymentStateLabel: string | null;
  },
  googlePlayError: string | null = null,
  couponOverride?: {
    couponCode?: string;
    couponDiscountPercent?: number;
  } | null
) {
  const discountCode =
    order?.discountCode || couponOverride?.couponCode || "";
  const discountPercentage = Number(
    order?.discountPercentage || couponOverride?.couponDiscountPercent || 0
  );

  return {
    orderId: String(order?.orderId || ""),
    email: String(order?.user?.email || "")
      .toLowerCase()
      .trim(),
    planTaken: order?.breakdown?.outCurrencyName || null,
    price: getMiningOrderPrice(order),
    basePrice: Number(order?.breakdown?.inAmount || order?.usdValue || 0),
    discountCode,
    discountPercentage,
    paidCurrency: order?.breakdown?.inCurrenyName || null,
    paymentType: order?.paymentType || null,
    provider: order?.paymentType || null,
    orderStatus: order?.status || null,
    productId: order?.productId || null,
    hasGooglePurchaseToken: !!order?.googlePurchaseToken,
    currentStatus: summary.currentStatus,
    currentAccess: summary.currentAccess,
    statusReason: summary.statusReason,
    statusSource: summary.statusSource,
    autoRenewing: summary.autoRenewing,
    paymentState: summary.paymentState,
    paymentStateLabel: summary.paymentStateLabel,
    startDate: toIsoOrNull(summary.startDate),
    endDate: toIsoOrNull(summary.endDate),
    expiredDate: toIsoOrNull(summary.expiredDate),
    cancelledAt: toIsoOrNull(summary.cancelledAt),
    orderCreated: toIsoOrNull(order?.created),
    lastUpdated: toIsoOrNull(order?.lastUpdated || order?.modified),
    googlePlayError,
  };
}

function parseOrderNotes(notes: any): any {
  if (!notes || typeof notes !== "string") return {};
  try {
    return JSON.parse(notes);
  } catch {
    return {};
  }
}

async function getBitcoinyayCouponLookupForOrders(
  orders: any[]
): Promise<Map<string, { couponCode?: string; couponDiscountPercent?: number }>> {
  const orderIds = orders
    .map((order: any) => String(order?.orderId || ""))
    .filter(Boolean);
  const subscriptionIds = orders
    .map((order: any) => String(parseOrderNotes(order?.notes)?.bitcoinyaySubscriptionId || ""))
    .filter(Boolean);

  if (orderIds.length === 0 && subscriptionIds.length === 0) {
    return new Map();
  }

  const filters: any[] = [];
  if (orderIds.length > 0) {
    filters.push({ miningSubscriptionOrderId: { $in: orderIds } });
  }
  if (subscriptionIds.length > 0) {
    filters.push({ _id: { $in: subscriptionIds } });
  }

  const subscriptions = await bitcoinyaySubscriptionService.find({
    $or: filters,
  });

  const lookup = new Map<
    string,
    { couponCode?: string; couponDiscountPercent?: number }
  >();

  subscriptions.forEach((subscription: any) => {
    const couponCode = subscription?.couponCode || "";
    const couponDiscountPercent = Number(
      subscription?.couponDiscountPercent || 0
    );

    if (!couponCode && !couponDiscountPercent) return;

    const couponInfo = {
      couponCode,
      couponDiscountPercent,
    };

    const orderId = String(subscription?.miningSubscriptionOrderId || "");
    if (orderId) {
      lookup.set(orderId, couponInfo);
    }

    const subscriptionId = String(subscription?._id || "");
    if (!subscriptionId) return;

    orders.forEach((order: any) => {
      const notes = parseOrderNotes(order?.notes);
      if (String(notes?.bitcoinyaySubscriptionId || "") === subscriptionId) {
        lookup.set(String(order?.orderId || ""), couponInfo);
      }
    });
  });

  return lookup;
}

export class OrderOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  get registerFields() {
    return {
      basic: 1,
      authProviders: 1,
      email: 1,
      verification: 1,
    };
  }

  private async resolveBuyQuoteRate(req: any, currencyRes: any): Promise<number> {
    const fallbackRate = Number(currencyRes?.data?.buyPrice ?? 0);
    const outCurrency = String(req?.body?.currencyOut || "").toUpperCase();

    if (outCurrency !== "BTCY") {
      return fallbackRate;
    }

    try {
      const liveBtcyPrice = await getPriceByName("BTCY");
      const liveRate = Number(liveBtcyPrice?.data);
      if (liveBtcyPrice?.status === 200 && Number.isFinite(liveRate) && liveRate > 0) {
        return liveRate;
      }
    } catch (err) {
      console.warn("Failed to fetch live BTCY price, using configured buy price", err);
    }

    return fallbackRate;
  }

  async createUserOrder(req: any, res: any) {
    try {
      const requestedOrderType = String(req.body.orderType || "").trim();
      const requestedPaymentType = String(req.body.paymentType || "")
        .trim()
        .toLowerCase();

      if (
        requestedOrderType === "Buy" &&
        requestedPaymentType === "usd"
      ) {
        return {
          status: 400,
          data: "Buy orders cannot be purchased using USD balance.",
        };
      }

      if (req.body.orderType === "Sell") {
        const inCurrencyName = req.body.currencyIn;
        const outCurrencyName = req.body.currencyOut;

        if (inCurrencyName === "WIBS" || outCurrencyName === "WIBS") {
          return {
            status: 500,
            data: "Selling or swapping WIBS is not allowed.",
          };
        }

        const indexxTokens = [
          "IN500",
          "INEX",
          "DaCrazy",
          "INXC",
          "IUSD+",
          "ALCRYP",
          "AMZN",
          "APPL",
          "BCM",
          "CRYC10",
          "EQSTK",
          "GOOGL",
          "INDXXF",
          "META",
          "MSFT",
          "WIBS",
          "NVDA",
          "PEP",
          "SNP500",
          "TLSA",
          "TOB",
        ];
        let isIndexxToken = indexxTokens.includes(inCurrencyName);
        if (isIndexxToken) {
          return {
            status: 500,
            data: "Selling of Indexx tokens is not allowed.",
          };
        }
      }

      if (req.body.orderType === "Convert") {
        const inCurrencyName = req.body.currencyIn;
        const outCurrencyName = req.body.currencyOut;

        if (inCurrencyName === "WIBS" || outCurrencyName === "WIBS") {
          return {
            status: 500,
            message: "Conversion involving WIBS is not allowed.",
          };
        }

        const allowedTokens = [
          "IN500",
          "INEX",
          "INXC",
          "DaCrazy",
          //"IUSD+",
          "ALCRYP",
          "AMZN",
          "APPL",
          "BCM",
          "CRYC10",
          "WIBS",
          "EQSTK",
          "GOOGL",
          "INDXXF",
          "META",
          "MSFT",
          "NVDA",
          "PEP",
          "SNP500",
          "TLSA",
          "TOB",
        ];

        // Define the function to check if the token conversion is allowed
        const isConversionAllowed = (tokenIn: string, tokenOut: string) => {
          return (
            allowedTokens.includes(tokenIn) && !allowedTokens.includes(tokenOut)
          );
        };

        console.log(
          "isConversionAllowed(inCurrencyName, outCurrencyName)",
          isConversionAllowed(inCurrencyName, outCurrencyName)
        );
        // Check if the token conversion is within the allowed tokens
        if (isConversionAllowed(inCurrencyName, outCurrencyName)) {
          // If either the inCurrency or outCurrency is not in the allowed list, return an error
          return {
            status: 500,
            message:
              "Conversion from or to the specified token is not allowed.",
          };
        }
      }

      let user = await uservice.findOneSelect(
        {
          email: String(String(req.body.email).toLowerCase()).toLowerCase(),
        },
        {}
      );

      if (
        req.body.orderType === "Sell" &&
        String(req.body.currencyIn || "").toUpperCase() === "BTCY"
      ) {
        const hasBuyRecord = await btcyBuyHistoryService.hasAnyBuy(
          String(req.body.email || "").toLowerCase()
        );

        if (!hasBuyRecord) {
          return {
            status: 500,
            data: "BTCY sells are only available to users who have purchased BTCY.",
          };
        }

        const BTCY_NETWORK = "Ying Yang Chain";
        const wallets = Array.isArray((user as any)?.userWallets)
          ? (user as any).userWallets
          : [];
        const hasYingYang = wallets.some(
          (w: any) =>
            String(w?.coinSymbol || "").toUpperCase() === "BTCY" &&
            String(w?.coinNetwork || "").toLowerCase() ===
            BTCY_NETWORK.toLowerCase()
        );

        if (!hasYingYang) {
          return {
            status: 500,
            data: "BTCY sells are only supported on Ying Yang Chain.",
          };
        }

        // Force network server-side (do not rely on UI input)
        req.body.network = BTCY_NETWORK;
        req.body.coinNetwork = BTCY_NETWORK;
        req.body.chain = BTCY_NETWORK;
      }
      let paymentType = req.body.paymentType;
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(req.body.amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (
        orderAmount > 599 &&
        !user.isKYCPass &&
        user.kycStatus !== "Completed" &&
        req.body.orderType === "Buy"
      ) {
        const kycGate = await resolveKycGateStatus(user);
        if (kycGate !== "approved") {
          return {
            status: 500,
            data:
              kycGate === "pending"
                ? KYC_REVIEW_MESSAGE
                : isHoneyBeeOrder
                  ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
                  : "User not allowed to place order. Please complete KYC first",
          };
        }
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;
        if (req.body.orderType == "Buy") {
          adminFees = await this.getAdminFees(req.body.currencyOut);
        } else if (req.body.orderType == "Sell") {
          adminFees = await this.getAdminFees(req.body.currencyIn);
        } else if (req.body.orderType == "Convert") {
          adminFees = await this.getAdminFees(req.body.currencyIn);
        }
        const currencyOps: CurrencyOperations = new CurrencyOperations(
          req,
          res
        );
        let currencyRes = await currencyOps.getCurrencyPriceByType(req, res);
        let getRate = {} as Rates;
        if (currencyRes.status == 200 && req.body.orderType == "Buy") {
          const buyRate = await this.resolveBuyQuoteRate(req, currencyRes);
          getRate = {
            currency: currencyRes.data.code,
            rate: buyRate,
          } as Rates;
        } else if (currencyRes.status == 200 && req.body.orderType == "Sell") {
          getRate = {
            currency: currencyRes.data.code,
            rate: currencyRes.data.sellPrice,
          } as Rates;
        }

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: req.body.currencyIn,
          inAmount: req.body.amount,
          outCurrencyName: req.body.currencyOut,
          outAmount: req.body.outAmount,
        } as OrderBreakdown;
        console.log("paymentType", paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log("paymentTypeString", paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            req.body.orderType == "Buy"
              ? "Buy"
              : req.body.orderType == "Sell"
                ? "Sell"
                : "Convert",
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          blockchainName: req.body.currencyOut === "INEX" ? req.body.chain : "",
        } as Order;

        let order = await orderService.create(newOrder);
        await new SendEmail().sendAccountsOrderCreated({
          userEmail: order.user?.email || "",
          orderId: order.orderId,
          orderType: order.orderType,
          paymentType: String(order.paymentType || ""),
          inAmount: order.breakdown?.inAmount,
          inCurrency: order.breakdown?.inCurrenyName,
          outAmount: order.breakdown?.outAmount,
          outCurrency: order.breakdown?.outCurrencyName,
          status: order.status,
          exchangeName: order.exchangeName,
          blockchainName: order.blockchainName,
          createdAt: order.created,
          notes: order.notes || order.comments || "",
        });

        //The below code is required for Paypal
        if (order.orderType == "Buy") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrder(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");
            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            // Deduct balance and update last used date
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  "userWallets.$.coinLastUsedOn": new Date(),
                },
              }
            );
            let process = await orderService.processOrder(order);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            // send email to user after completion
            await new SendEmail().sendOrderCompleted(
              getNewDetails.user.email,
              "User",
              getNewDetails.breakdown.outAmount,
              getNewDetails.breakdown.outCurrencyName,
              getNewDetails.orderType,
              getNewDetails.orderRate.rate,
              getNewDetails.breakdown.inAmount,
              getNewDetails.notes,
              getNewDetails.orderId
            );
            await new SendEmail().sendAccountsOrderCompleted({
              userEmail: getNewDetails.user?.email || "",
              orderId: getNewDetails.orderId,
              orderType: getNewDetails.orderType,
              paymentType: String(getNewDetails.paymentType || ""),
              inAmount: getNewDetails.breakdown?.inAmount,
              inCurrency: getNewDetails.breakdown?.inCurrenyName,
              outAmount: getNewDetails.breakdown?.outAmount,
              outCurrency: getNewDetails.breakdown?.outCurrencyName,
              status: getNewDetails.status,
              exchangeName: getNewDetails.exchangeName,
              blockchainName: getNewDetails.blockchainName,
              completedAt: getNewDetails.orderCompletedOn || new Date(),
              notes: getNewDetails.notes || getNewDetails.comments || "",
            });
            await new SendEmail().sendAccountsOrderCompleted({
              userEmail: getNewDetails.user?.email || "",
              orderId: getNewDetails.orderId,
              orderType: getNewDetails.orderType,
              paymentType: String(getNewDetails.paymentType || ""),
              inAmount: getNewDetails.breakdown?.inAmount,
              inCurrency: getNewDetails.breakdown?.inCurrenyName,
              outAmount: getNewDetails.breakdown?.outAmount,
              outCurrency: getNewDetails.breakdown?.outCurrencyName,
              status: getNewDetails.status,
              exchangeName: getNewDetails.exchangeName,
              blockchainName: getNewDetails.blockchainName,
              completedAt: getNewDetails.orderCompletedOn || new Date(),
              notes: getNewDetails.notes || getNewDetails.comments || "",
            });

            const newTx = await txservice.create({
              email: getNewDetails.user.email,
              orderId: getNewDetails.orderId,
              extRef: "",
              txId: "",
              from: "",
              to: getNewDetails.user.email,
              amount: getNewDetails.breakdown.outAmount,
              exchangeName: "CEX",
              info: "Buy crypto by user",
              status: OrderStatus.Completed,
              currencyRef: getNewDetails.breakdown.outCurrencyName,
              walletType: "ASSET_WALLET",
              transactionType: "BUY",
              txDate: new Date(),
              benificaryAddress: "",
            });
            return { status: 200, data: getNewDetails };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createDepositOrder(req: any, res: any) {
    try {
      const { email, coin, amount, paymentType } = req.body;

      let user = await uservice.findOneSelect(
        {
          email: String(email).toLowerCase(),
        },
        {}
      );
      let orderAmount = Number(req.body.amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");

      let getRate = {} as Rates;
      getRate = {
        currency: coin,
        rate: 1,
      } as Rates;

      let userLite = {
        userId: user._id,
        email: user.email,
        firstName: "",
        lastName: "",
        // role: user.role,
        isVerified: user.verification.activated,
        language: user.language,
      } as UserLite;

      let orderBreakdown = {
        inCurrenyName: coin,
        inAmount: amount,
        outCurrencyName: "",
        outAmount: 0,
      } as OrderBreakdown;
      console.log("paymentType", paymentType);
      let paymentTypeString = String(paymentType).toLowerCase();
      console.log("paymentTypeString", paymentTypeString);
      let transactionAccount = {} as TransactionAccount;
      let orderId = Math.floor(10000000 + Math.random() * 90000000);
      let newOrder = {
        orderId: orderId.toString(),
        status: OrderStatus.Quoted,
        orderType: "Deposit",
        orderRate: getRate, //Latest rate at which the order is received
        receiverAccount: transactionAccount,
        paymentType:
          paymentTypeString === "paypal"
            ? PaymentTypes.Paypal
            : paymentTypeString === "zelle"
              ? PaymentTypes.Zelle
              : paymentTypeString === "wire transfer"
                ? PaymentTypes.Wire
                : paymentTypeString === "venmo"
                  ? PaymentTypes.Venmo
                  : paymentTypeString === "ach"
                    ? PaymentTypes.ACH
                    : paymentTypeString === "tygapay"
                      ? PaymentTypes.TygaPay
                      : paymentTypeString === "credit card"
                        ? PaymentTypes.CC
                        : paymentTypeString === "usd"
                          ? PaymentTypes.USD
                          : PaymentTypes.BankDirect,
        breakdown: orderBreakdown as OrderBreakdown,
        user: userLite,
        created: new Date(),
        exchangeFees: Number(0),
        isCaptainPerformingOrder: false,
        captainBeeEmail: "",
        blockchainName: "",
      } as any;

      let order = await orderService.create(newOrder);
      await new SendEmail().sendAccountsOrderCreated({
        userEmail: order.user?.email || "",
        orderId: order.orderId,
        orderType: order.orderType,
        paymentType: String(order.paymentType || ""),
        inAmount: order.breakdown?.inAmount,
        inCurrency: order.breakdown?.inCurrenyName,
        outAmount: order.breakdown?.outAmount,
        outCurrency: order.breakdown?.outCurrencyName,
        status: order.status,
        exchangeName: order.exchangeName,
        blockchainName: order.blockchainName,
        createdAt: order.created,
        notes: order.notes || order.comments || "",
      });
      //The below code is required for Paypal
      if (order.orderType == "Deposit") {
        if (
          paymentTypeString !== "zelle" &&
          paymentTypeString !== "wire transfer" &&
          paymentTypeString !== "venmo" &&
          paymentTypeString !== "tygapay" &&
          paymentTypeString !== "ach"
        ) {
          console.log(user.email, order.breakdown);
          let finalAmount = (
            Math.round(order.breakdown.inAmount * 100) / 100
          ).toFixed(2);
          let paypalCreateOrder = await createPaypalOrderForDeposit(
            order.breakdown.inCurrenyName,
            finalAmount,
            user.email
          );
          console.log(paypalCreateOrder);
          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.data._id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: order.breakdown.inCurrenyName,
            links: paypalCreateOrder.data.links,
            payerEmail: user.email,
          } as any;
          let paypalOrder = await paypalService.create(newPaypalOrder);
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return { status: 500, data: "Something went wrong" };
          }
        } else if (paymentTypeString === "tygapay") {
          let tygaOps = new TygaPayOperations(req, res);
          let tygaPayOrder = await tygaOps.createNewOrder(
            user.email,
            order.orderId,
            order.breakdown.inAmount
          );
          await orderService.updatePart(
            {
              orderId: order.orderId,
            },
            {
              merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
              merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
              merchantName: "TygaPay",
            }
          );
          return { status: 200, data: tygaPayOrder };
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async alreadyPaidOps(req: any, res: any, orderId: string, input: Input) {
    const order = await findOrder(orderId);
    if (!order) {
      return { status: 404, data: { message: "Order not found" } };
    }

    // If already final, don't allow re-submit
    if (String(order.status) === String(OrderStatus.Completed)) {
      return {
        status: 200,
        data: { message: "Order already completed", orderId },
      };
    }
    if (String(order.status).toLowerCase() === "expired") {
      return { status: 400, data: { message: "Order is expired", orderId } };
    }

    const method = inferPaymentMethod(order);

    // Validate required proofs based on method
    if (method === "USDT" || method === "USDC") {
      if (!input.txHash) {
        return {
          status: 400,
          data: {
            message: "txHash is required for crypto already-paid",
            orderId,
          },
        };
      }
    } else if (method === "PAYPAL" || method === "USD") {
      if (!input.paypalTxnId || !input.proofUrl) {
        return {
          status: 400,
          data: {
            message: "paypalTxnId and proofUrl are required for PayPal/USD",
            orderId,
          },
        };
      }
    } else {
      // Unknown – still allow with either proof for safety, but recommend aligning create flow
      if (!input.txHash && !input.paypalTxnId) {
        return {
          status: 400,
          data: {
            message: "Missing payment proof (txHash or paypalTxnId)",
            orderId,
          },
        };
      }
    }

    // Idempotency check
    if (hasDuplicateProof(order, input.txHash, input.paypalTxnId)) {
      // Ensure status is at least Payment_Submitted
      await orderService.updatePart(
        { orderId },
        { $set: { status: "Payment_Submitted" } }
      );
      return {
        status: 200,
        data: {
          message: "Proof already submitted",
          orderId,
          status: "Payment_Submitted",
        },
      };
    }

    // Record proof + move to Payment_Submitted
    const proofResult = await recordProofTx(
      order,
      input,
      method === "UNKNOWN" ? "USD" : method
    );
    if (!proofResult?.ok) {
      return {
        status: 409,
        data: {
          message: "Payment proof already used by another order",
          orderId,
          existingOrderId: proofResult?.duplicateOrderId || null,
        },
      };
    }

    return {
      status: 200,
      data: {
        orderId,
        status: "Payment_Submitted",
        message:
          method === "USDT" || method === "USDC"
            ? "Crypto proof submitted. We’ll confirm on-chain shortly."
            : "PayPal proof submitted. We’ll verify shortly.",
      },
    };
  }

  async listCandidates(email: string, sinceHours = LOOKBACK_HOURS) {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    const orders = await orderService.find({
      "user.email": email,
      status: { $in: [OrderStatus.Pending, "Expired"] },
      created: { $gte: since },
    });

    return orders.map((o: any) => ({
      orderId: o.orderId,
      status: o.status,
      created: o.created,
      amount: o.breakdown?.inAmount,
      currency: o.currency,
      paymentType: o.paymentType,
      blockchain: o.blockchainName,
    }));
  }

  async resolveByProof({
    txHash,
    paypalTxnId,
  }: {
    txHash?: string;
    paypalTxnId?: string;
  }) {
    if (txHash) {
      const tx = await txservice.findOne({ txId: txHash });
      if (tx?.orderId) return { orderId: tx.orderId, via: "tx" };
    }
    if (paypalTxnId) {
      const tx = await txservice.findOne({ txId: paypalTxnId });
      if (tx?.orderId) return { orderId: tx.orderId, via: "paypal" };
    }
    return null;
  }

  async claimProofWithoutOrderId(body: ClaimBody) {
    const email = String(body.email || "").toLowerCase();
    if (!email) return { status: 400, data: { message: "email required" } };

    const isCrypto = !!body.txHash && !!body.coin && !!body.blockchain;
    const isPaypal =
      !!body.paymentMethod &&
      (body.paymentMethod === "PayPal" || body.paymentMethod === "USD");

    if (!isCrypto && !isPaypal) {
      return {
        status: 400,
        data: {
          message:
            "Provide crypto (coin, blockchain, txHash) or PayPal (paymentMethod, txn id, proofUrl)",
        },
      };
    }

    // 1) Try to find an existing order to attach to
    const candidates = await this.listCandidates(email, LOOKBACK_HOURS);
    const now = Date.now();

    const pickByAmountAndMethod = (list: any[]) => {
      return list.find((o) => {
        if (isCrypto) {
          const samePay =
            o.paymentType === "Crypto" &&
            o.currency === body.coin &&
            o.blockchain === body.blockchain;
          if (!samePay) return false;
          if (body.amount == null) return true; // allow when amount not provided
          const diff = Math.abs((o.amount ?? 0) - body.amount!);
          return diff <= (o.amount ?? 0) * TOLERANCE;
        } else {
          const samePay = o.paymentType !== "Crypto" && o.currency === "USD";
          if (!samePay) return false;
          if (body.amount == null) return true;
          const diff = Math.abs((o.amount ?? 0) - body.amount!);
          return diff <= (o.amount ?? 0) * TOLERANCE;
        }
      });
    };

    const match = pickByAmountAndMethod(candidates);
    const matchedOrderId = match?.orderId as string | undefined;
    // 2) If CRYPTO: verify tx → confirm or mark pending + start monitor
    if (isCrypto) {
      const { coin, blockchain, txHash, amount, paidAt } = body as ClaimCrypto;

      if (!txHash) return { status: 400, data: { message: "txHash required" } };

      // If we matched an order, attach to it; otherwise keep an unmatched claim record.
      const orderId = match?.orderId;

      // Idempotency: if this txHash is already stored, short-circuit
      const existingTx = await txservice.findOne({ txId: txHash });
      if (existingTx?.orderId) {
        return {
          status: 200,
          data: { message: "already-claimed", orderId: existingTx.orderId },
        };
      }

      if (!orderId) {
        // Store an unmatched claim (for ops to review). No duplicate inserts on same txHash.
        await txservice.updatePart(
          { txId: txHash },
          {
            $setOnInsert: {
              email,
              orderId: null,
              txId: txHash,
              info: "Unmatched crypto claim",
              currencyRef: coin,
              status: "Unmatched",
              txDate: new Date(),
            },
          }
        );
        return {
          status: 202,
          data: { message: "claim-recorded-review", reviewRequired: true },
        };
      }

      // Notify team
      await new SendEmail().sendPaymentClaimReminderToTeam({
        type: "crypto",
        claimantEmail: email,
        coin,
        blockchain,
        txHash,
        amount: amount ?? null,
        paidAt: paidAt ?? null,
        matchedOrderId: matchedOrderId || null,
      });
      return {
        status: 200,
        data: { message: "claim-attached", orderId, watching: true },
      };
    }

    // 3) If PAYPAL/USD: require txn id + proof
    if (isPaypal) {
      const {
        paymentMethod,
        paypalTxnId,
        processorTxnId,
        proofUrl,
        amount,
        paidAt,
      } = body as ClaimPaypal;

      if (!paypalTxnId || !proofUrl) {
        return {
          status: 400,
          data: { message: "paypalTxnId/processorTxnId and proofUrl required" },
        };
      }

      // Idempotency: avoid duplicate insert for same paypalTxnId
      const existingTx = await txservice.findOne({ txId: paypalTxnId });
      if (existingTx?.orderId) {
        // optional team notice too
        await new SendEmail().sendPaymentClaimReminderToTeam({
          type: "paypal",
          claimantEmail: email,
          paymentMethod,
          paypalTxnId: paypalTxnId,
          processorTxnId: processorTxnId,
          proofUrl,
          amount: amount ?? null,
          paidAt: paidAt ?? null,
          matchedOrderId: existingTx.orderId,
        });
        return {
          status: 200,
          data: { message: "already-claimed", orderId: existingTx.orderId },
        };
      }

      if (!match?.orderId) {
        // Store unmatched PayPal claim (no duplicate on same txnId)
        await txservice.updatePart(
          { txId: paypalTxnId },
          {
            $setOnInsert: {
              email,
              orderId: null,
              txId: paypalTxnId,
              info: "Unmatched PayPal claim",
              currencyRef: "USD",
              status: "Unmatched",
              txDate: new Date(),
              benificaryAddress: proofUrl,
            },
          }
        );
        return {
          status: 202,
          data: { message: "claim-recorded-review", reviewRequired: true },
        };
      }

      // If you can verify immediately (via PayPal API), do it here and call confirmPayPalPayment
      // For now, mark as submitted and let ops/IPC verify:
      await txservice.updatePart(
        { txId: paypalTxnId },
        {
          $setOnInsert: {
            email,
            orderId: match.orderId,
            txId: paypalTxnId,
            info: "PayPal proof submitted",
            currencyRef: "USD",
            status: "Payment_Submitted",
            txDate: new Date(),
            benificaryAddress: proofUrl,
          },
        }
      );

      // Optional: auto-complete if your processor webhook has already confirmed it
      // await confirmPayPalPayment(match.orderId, paypalTxnId, "completed");

      return {
        status: 200,
        data: { message: "claim-attached", orderId: match.orderId },
      };
    }

    return { status: 400, data: { message: "invalid-claim" } };
  }

  async createUserOrderForQuantum(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let paymentType = req.body.paymentType;
      let source = req.body.source;
      let env = req.body.env;
      let referralCode = req.body.referralCode; // Optional referral code

      // Validate referral code if provided
      let referralValidation = null;
      if (referralCode && referralCode.trim() !== "") {
        const referralEarningService = new ReferralEarningService();
        referralValidation = await referralEarningService.validateReferralCode(
          referralCode
        );

        if (!referralValidation.isValid) {
          return {
            status: 400,
            data: {
              message: referralValidation.error || "Invalid referral code",
            },
          };
        }
      }

      // Validate quantum-specific requirements
      if (currencyOut !== "BTCY") {
        return {
          status: 400,
          data: "Quantum orders are only for buying BTCY",
        };
      }

      const allowedCurrencies = ["USD", "PayPal", "CreditCard"];
      if (!allowedCurrencies.includes(currencyIn)) {
        return {
          status: 400,
          data: "Invalid currency for Quantum. Allowed: PayPal, USD (for card payments). USDT/USDC handled by crypto payment system.",
        };
      }

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );

      if (!user) {
        return { status: 404, data: "User not found" };
      }

      let orderAmount = Number(amount);
      const feeData = req.body.feeData || calculateFeeAmount(orderAmount);
      const totalPayable = Number(feeData?.total ?? orderAmount);
      const btcyUsdRate =
        Number.isFinite(Number(req.body.btcyUsdRate)) &&
          Number(req.body.btcyUsdRate) > 0
          ? Number(req.body.btcyUsdRate)
          : await resolveQuantumBtcyUsdRate();
      const feeAdjustedOutAmount = calculateQuantumBtcyOutAmountFromFeeData(
        feeData,
        btcyUsdRate
      );
      const bonusResult = applyQuantumBtcyBonus(
        orderAmount,
        feeAdjustedOutAmount
      );

      // Admin role check
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }

      if (
        orderAmount > 5000 &&
        !user.isKYCPass &&
        user.kycStatus !== "Completed"
      ) {
        return {
          status: 500,
          data: "User not allowed to place order. Please complete KYC first for orders above $5000",
        };
      }

      let getRate = {
        currency: "BTCY",
        rate: btcyUsdRate,
      } as Rates;

      let userLite = {
        userId: user._id,
        email: user.email,
        firstName: "",
        lastName: "",
        isVerified: user.verification.activated,
        language: user.language,
      } as UserLite;

      let orderBreakdown = {
        inCurrenyName: currencyIn,
        inAmount: orderAmount,
        feePercent: feeData?.feePercent || 0,
        feeAmount: feeData?.fee || 0,
        netAmount: feeData?.netAmount ?? orderAmount,
        totalPayable,
        outCurrencyName: currencyOut,
        outAmount: bonusResult.finalOutAmount,
        finalAmountAfterDiscount: totalPayable,
      } as any;

      if (bonusResult.bonusAmount > 0) {
        (orderBreakdown as any).promotionalBonusAmount = bonusResult.bonusAmount;
        (orderBreakdown as any).promotionalBonusCode = bonusResult.promoCode;
      }

      let paymentTypeString = String(paymentType).toLowerCase();
      let transactionAccount = {} as TransactionAccount;
      let orderId = Math.floor(10000000 + Math.random() * 90000000);

      let newOrder = {
        orderId: orderId.toString(),
        status: OrderStatus.Quoted,
        orderType: "Buy",
        orderRate: getRate,
        receiverAccount: transactionAccount,
        paymentType:
          paymentTypeString === "paypal"
            ? PaymentTypes.Paypal
            : paymentTypeString === "usd"
              ? PaymentTypes.USD
              : paymentTypeString === "creditcard"
                ? PaymentTypes.CC
                : PaymentTypes.BankDirect,
        breakdown: orderBreakdown as OrderBreakdown,
        user: userLite,
        created: new Date(),
        exchangeFees: feeData?.feePercent || 0,
        isCaptainPerformingOrder: false, // Always false for quantum
        captainBeeEmail: "", // No honeybee for quantum
        blockchainName: "Bitcoin", // BTCY is on Bitcoin network
        comments: "Quantum order for BTCY",
        referralCode: referralCode || undefined, // Store referral code if provided
      } as Order;

      let order = await orderService.create(newOrder);

      // Handle different payment types for Quantum orders
      if (order.orderType == "Buy") {
        // For PayPal and USD payments (both use PayPal for credit card processing)
        if (paymentTypeString === "paypal" || paymentTypeString === "usd") {
          console.log(
            `Creating PayPal order for Quantum ${paymentTypeString.toUpperCase()} payment`,
            user.email,
            order.breakdown
          );

          let finalAmount = (
            Math.round(totalPayable * 100) / 100
          ).toFixed(2);

          let paypalCreateOrder = await createPaypalOrderForBitcoinYay(
            "USD", // PayPal always uses USD
            finalAmount,
            user.email,
            order.orderId,
            source,
            env
          );

          console.log("PayPal order created:", paypalCreateOrder);
          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: "USD",
            links: paypalCreateOrder.links,
            payerEmail: user.email,
          };

          let paypalOrder = await paypalService.create(newPaypalOrder);
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return {
              status: 500,
              data: "Something went wrong with PayPal order creation",
            };
          }
        }
        // For unsupported payment types
        else {
          return {
            status: 400,
            data: "Payment type not supported for Quantum in order.operations.ts. Use PayPal or USD only. USDT/USDC handled in orderAPI.ts.",
          };
        }
      }

      return { status: 200, data: order };
    } catch (err) {
      console.error("Error in createUserOrderForQuantum:", err);
      return { status: 500, data: err };
    }
  }

  async createUserOrderForQuantumWireTransfer(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let paymentType = req.body.paymentType;
      let source = req.body.source;
      let env = req.body.env;

      // Validate quantum-specific requirements
      if (currencyOut !== "BTCY") {
        return {
          status: 400,
          data: "Quantum orders are only for buying BTCY",
        };
      }

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );

      if (!user) {
        return { status: 404, data: "User not found" };
      }

      let orderAmount = Number(amount);
      const feeData = req.body.feeData || calculateFeeAmount(orderAmount);
      const totalPayable = Number(feeData?.total ?? orderAmount);
      const btcyUsdRate =
        Number.isFinite(Number(req.body.btcyUsdRate)) &&
          Number(req.body.btcyUsdRate) > 0
          ? Number(req.body.btcyUsdRate)
          : await resolveQuantumBtcyUsdRate();
      const feeAdjustedOutAmount = calculateQuantumBtcyOutAmountFromFeeData(
        feeData,
        btcyUsdRate
      );
      const bonusResult = applyQuantumBtcyBonus(
        orderAmount,
        feeAdjustedOutAmount
      );

      // Admin role check
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }

      if (
        orderAmount > 5000 &&
        !user.isKYCPass &&
        user.kycStatus !== "Completed"
      ) {
        return {
          status: 500,
          data: "User not allowed to place order. Please complete KYC first for orders above $5000",
        };
      }

      let getRate = {
        currency: "BTCY",
        rate: btcyUsdRate,
      } as Rates;

      let userLite = {
        userId: user._id,
        email: user.email,
        firstName: "",
        lastName: "",
        isVerified: user.verification.activated,
        language: user.language,
      } as UserLite;

      let orderBreakdown = {
        inCurrenyName: currencyIn,
        inAmount: orderAmount,
        feePercent: feeData?.feePercent || 0,
        feeAmount: feeData?.fee || 0,
        netAmount: feeData?.netAmount ?? orderAmount,
        totalPayable,
        outCurrencyName: currencyOut,
        outAmount: bonusResult.finalOutAmount,
        finalAmountAfterDiscount: totalPayable,
      } as any;

      if (bonusResult.bonusAmount > 0) {
        (orderBreakdown as any).promotionalBonusAmount = bonusResult.bonusAmount;
        (orderBreakdown as any).promotionalBonusCode = bonusResult.promoCode;
      }

      let paymentTypeString = String(paymentType).toLowerCase();
      let transactionAccount = {} as TransactionAccount;
      let orderId = Math.floor(10000000 + Math.random() * 90000000);

      let newOrder = {
        orderId: orderId.toString(),
        status: OrderStatus.Quoted,
        orderType: "Buy",
        orderRate: getRate,
        receiverAccount: transactionAccount,
        paymentType:
          paymentTypeString === "wiretransfer"
            ? PaymentTypes.Wire
            : PaymentTypes.BankDirect,
        breakdown: orderBreakdown as OrderBreakdown,
        user: userLite,
        created: new Date(),
        exchangeFees: feeData?.feePercent || 0,
        isCaptainPerformingOrder: false, // Always false for quantum
        captainBeeEmail: "", // No honeybee for quantum
        blockchainName: "Bitcoin", // BTCY is on Bitcoin network
        comments: "Quantum order for BTCY",
      } as Order;

      let order = await orderService.create(newOrder);

      // Handle different payment types for Quantum orders
      if (order.orderType == "Buy") {
        // For PayPal and USD payments (both use PayPal for credit card processing)
        if (paymentTypeString === "paypal" || paymentTypeString === "usd") {
          console.log(
            `Creating PayPal order for Quantum ${paymentTypeString.toUpperCase()} payment`,
            user.email,
            order.breakdown
          );

          let finalAmount = (
            Math.round(order.breakdown.inAmount * 100) / 100
          ).toFixed(2);

          let paypalCreateOrder = await createPaypalOrderForBitcoinYay(
            "USD", // PayPal always uses USD
            finalAmount,
            user.email,
            order.orderId,
            source,
            env
          );

          console.log("PayPal order created:", paypalCreateOrder);
          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: "USD",
            links: paypalCreateOrder.links,
            payerEmail: user.email,
          };

          let paypalOrder = await paypalService.create(newPaypalOrder);
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return {
              status: 500,
              data: "Something went wrong with PayPal order creation",
            };
          }
        } else if (paymentTypeString === "wiretransfer") {
          // For Wire Transfer, simply return the order details with wire instructions
          return { status: 200, data: order };
        }
        // For unsupported payment types
        else {
          return {
            status: 400,
            data: "Payment type not supported for Quantum in order.operations.ts. Use PayPal or USD only. USDT/USDC handled in orderAPI.ts.",
          };
        }
      }

      return { status: 200, data: order };
    } catch (err) {
      console.error("Error in createUserOrderForQuantum:", err);
      return { status: 500, data: err };
    }
  }

  async updateQuantumWireTransferConfirmation(req: any, res: any) {
    try {
      const orderId = String(req.body?.orderId || "").trim();
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const customerName = String(
        req.body?.customerName || req.body?.name || ""
      ).trim();
      const bankName = String(req.body?.bankName || "").trim();
      const bankAccountNumber = String(
        req.body?.bankAccountNumber || ""
      ).trim();
      const address = String(req.body?.address || "").trim();
      const phoneNumber = String(req.body?.phoneNumber || "").trim();

      if (
        !orderId ||
        !email ||
        !customerName ||
        !bankName ||
        !bankAccountNumber ||
        !address ||
        !phoneNumber
      ) {
        return {
          status: 400,
          data: {
            message:
              "orderId, email, customerName, bankName, bankAccountNumber, address, phoneNumber are required",
          },
        };
      }

      const order: any = await orderService.findOne({
        orderId,
        "user.email": email,
      });

      if (!order) {
        return {
          status: 404,
          data: { message: "Order not found for this email" },
        };
      }

      const paymentType = String(order?.paymentType || "").toLowerCase();
      const inCurrency = String(
        order?.breakdown?.inCurrenyName || ""
      ).toLowerCase();
      const outCurrency = String(
        order?.breakdown?.outCurrencyName || ""
      ).toUpperCase();
      const orderType = String(order?.orderType || "").toLowerCase();

      const isWireTransferOrder =
        paymentType.includes("wire") ||
        inCurrency === "wiretransfer" ||
        inCurrency === "wire transfer";
      const isQuantumBtcyOrder = orderType === "buy" && outCurrency === "BTCY";

      if (!isWireTransferOrder || !isQuantumBtcyOrder) {
        return {
          status: 400,
          data: {
            message:
              "This endpoint only supports Quantum BTCY wire-transfer orders",
          },
        };
      }

      const now = new Date();
      const wireTransferConfirmation = {
        customerName,
        bankName,
        bankAccountNumber,
        address,
        phoneNumber,
        confirmedAt: order?.wireTransferConfirmation?.confirmedAt || now,
        updatedAt: now,
      };

      await orderService.updatePart(
        { orderId, "user.email": email },
        {
          $set: {
            wireTransferConfirmation,
            receiverAccount: {
              ...(order?.receiverAccount || {}),
              accountHolderName: customerName,
              accountBankName: bankName,
              accountNumber: bankAccountNumber,
              accountBankAddress: address,
              email,
            },
            lastUpdated: now,
          },
        }
      );

      const updatedOrder = await orderService.findOne({
        orderId,
        "user.email": email,
      });

      return {
        status: 200,
        data: {
          message: "Wire transfer confirmation details saved successfully",
          order: updatedOrder,
        },
      };
    } catch (err) {
      console.error("Error in updateQuantumWireTransferConfirmation:", err);
      return { status: 500, data: err };
    }
  }

  async createUserOrderForSmartCrypto(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      let paymentType = req.body.paymentType;

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let getSmartCryptoPlan = await smartCryptoService.findOne({
          portfolioName: planName,
          managedBy: planManagedBy,
          isActive: true,
        });
        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName:
            getSmartCryptoPlan.portfolioName +
            "|" +
            getSmartCryptoPlan.managedBy,
          outAmount: 0,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.SmartCryptoBuy,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "SmartCryptoBuy") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrder(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            // Deduct balance and update last used date
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  "userWallets.$.coinLastUsedOn": new Date(),
                },
              }
            );
            let process = await orderService.processOrder(order);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            let updateOrder = await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                $set: {
                  status: "Completed",
                },
              }
            );

            // send email to user after completion
            // await new SendEmail().sendOrderCompleted(
            //   getNewDetails.user.email,
            //   "User",
            //   getNewDetails.breakdown.outAmount,
            //   getNewDetails.breakdown.outCurrencyName,
            //   getNewDetails.orderType,
            //   getNewDetails.orderRate.rate,
            //   getNewDetails.breakdown.inAmount,
            //   getNewDetails.notes,
            //   getNewDetails.orderId
            // );

            return { status: 200, data: getNewDetails };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createUserOrderForSmartAPY(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let duration = req.body.duration;
      let percentage = req.body.percentage;
      let amount = req.body.amount;
      let yieldValue = req.body.yieldValue;
      let paymentType = req.body.paymentType;

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName: "IUSD+",
          outAmount: orderAmount + yieldValue,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.SmartAPY,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          smartAPYPercentage: percentage,
          smartAPYduration: duration,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "SmartAPY") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrder(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");
            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            // Deduct balance and update last used date
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  "userWallets.$.coinLastUsedOn": new Date(),
                },
              }
            );
            //let process = await orderService.processOrder(order);
            const userOps = new UserOperations(req, res);
            let dataResults = await userOps.smartApyInvest(req, res);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            // send email to user after completion
            await new SendEmail().sendUSDToIUSDOrderCompleted(
              getNewDetails.user.email,
              "User",
              getNewDetails.breakdown.outAmount,
              duration,
              getNewDetails.orderRate.rate,
              getNewDetails.breakdown.inAmount,
              dataResults.data as any,
              getNewDetails.orderId
            );

            return { status: 200, data: getNewDetails };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createUserOrderForGiftCard(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let giftCardArr = req.body.giftCardArr;
      let amount = giftCardArr.reduce(
        (sum: any, item: any) => sum + item.amount,
        0
      );
      let paymentType = req.body.paymentType;

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName: "NA",
          outAmount: 0,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.GiftCardBuy,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          giftCardDetails: giftCardArr,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "GiftCardBuy") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrder(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");
            if (
              await orderService.checkAndCreateUserWallet(user.email, "USD")
            ) {
              console.log("inside sell updateUser1");
              //update 1 for user increment fiat value
              let updateUser1 = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": "USD",
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
            }
            let process = await orderService.processOrder(order);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            // send email to user after completion
            await new SendEmail().sendOrderCompleted(
              getNewDetails.user.email,
              "User",
              getNewDetails.breakdown.outAmount,
              getNewDetails.breakdown.outCurrencyName,
              getNewDetails.orderType,
              getNewDetails.orderRate.rate,
              getNewDetails.breakdown.inAmount,
              getNewDetails.notes,
              getNewDetails.orderId
            );

            const newTx = await txservice.create({
              email: getNewDetails.user.email,
              orderId: getNewDetails.orderId,
              extRef: "",
              txId: "",
              from: "",
              to: getNewDetails.user.email,
              amount: getNewDetails.breakdown.outAmount,
              exchangeName: "CEX",
              info: "Buy crypto by user",
              status: OrderStatus.Completed,
              currencyRef: getNewDetails.breakdown.outCurrencyName,
              walletType: "ASSET_WALLET",
              transactionType: "BUY",
              txDate: new Date(),
              benificaryAddress: "",
            });
            return { status: 200, data: getNewDetails };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createOrderForAcademy(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let amount = req.body.amount;
      let orderId = req.body.orderId;
      let tygaOps = new TygaPayOperations(req, res);
      let tygaPayOrder = await tygaOps.createNewOrder(email, orderId, amount);

      return { status: 200, data: tygaPayOrder };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createUserETFOrder(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(String(req.body.email).toLowerCase()).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;
        if (req.body.orderType == "SellETF") {
          adminFees = await this.getAdminFees(req.body.currencyIn);
        } else if (req.body.orderType == "BuyETF") {
          adminFees = await this.getAdminFees(req.body.currencyOut);
        }
        const etfOps: ETFOperations = new ETFOperations(req, res);
        let etfCode =
          req.body.orderType == "BuyETF"
            ? req.body.currencyOut
            : req.body.currencyIn;
        let etfRes = await etfOps.getLatestPriceOfETF(etfCode);
        let getRate = {} as Rates;
        if (etfRes.status == 200 && req.body.orderType == "BuyETF") {
          getRate = {
            currency: req.body.currencyOut,
            rate: etfRes.data.totalETFPrice,
          } as Rates;
        } else if (etfRes.status == 200 && req.body.orderType == "SellETF") {
          getRate = {
            currency: req.body.currencyOut,
            rate: etfRes.data.totalETFPrice,
          } as Rates;
        }

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: req.body.currencyIn,
          inAmount: req.body.amount,
          outCurrencyName: req.body.currencyOut,
          outAmount: req.body.outAmount,
        } as OrderBreakdown;

        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            req.body.orderType == "BuyETF"
              ? "BuyETF"
              : req.body.orderType == "SellETF"
                ? "SellETF"
                : "Convert",
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType: PaymentTypes.CC,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "BuyETF") {
          console.log(user.email, order.breakdown);
          let finalAmount = (
            Math.round(order.breakdown.inAmount * 100) / 100
          ).toFixed(2);
          let paypalCreateOrder = await createPaypalOrder(
            order.breakdown.inCurrenyName,
            finalAmount,
            user.email
          );
          console.log(paypalCreateOrder);
          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: order.breakdown.inCurrenyName,
            links: paypalCreateOrder.links,
            payerEmail: user.email,
          };
          let paypalOrder = await paypalService.create(newPaypalOrder);
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return { status: 500, data: "Something went wrong" };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async powerPackCreateOrder(req: any, res: any) {
    try {
      let referralCode = req.body.referralCode; // Optional referral code

      // Validate referral code if provided
      let referralValidation = null;
      if (referralCode && referralCode.trim() !== "") {
        const referralEarningService = new ReferralEarningService();
        referralValidation = await referralEarningService.validateReferralCode(
          referralCode
        );

        if (!referralValidation.isValid) {
          return {
            status: 400,
            data: {
              message: referralValidation.error || "Invalid referral code",
            },
          };
        }
      }

      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else {
        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let discountCode = req.body.discountCode ?? ""; // If undefined, default to an empty string

        let getDiscountCodeData;
        if (discountCode) {
          // If discountCode is provided, then fetch related data
          getDiscountCodeData = await discountCodeService.findOne({
            code: discountCode,
          });

          // Verify if the discount code is applicable for the selected pack
          if (getDiscountCodeData?.subType !== req.body.purchasedProduct) {
            return {
              status: 400,
              data: "The discount code is not valid for the selected pack.",
            };
          }
        }

        const currencyRes = await currencyService.findOne({
          currencyType: "Crypto",
          code: "INEX",
        });

        let getRate = {
          currency: currencyRes.code,
          rate: currencyRes.buyPrice,
        } as Rates;

        const packFeesPercentage: { [key: string]: number } = {
          "Starter Pack": 33.33,
          "Excel Pack": 40.0,
          "Pro Pack": 35.71,
          "Captain Pack": 33.33,
          "Copper Pack": 12.86,
          "Gold Pack": 9.09,
          "Platinum Pack": 5.56,
          "Royal Pack": 3.33,
        };

        const packPrices: { [key: string]: number } = {
          "Starter Pack": 300,
          "Excel Pack": 500,
          "Pro Pack": 700,
          "Captain Pack": 1500,
          "Copper Pack": 3500,
          "Gold Pack": 5500,
          "Platinum Pack": 9000,
          "Royal Pack": 15000,
        };

        const purchasedProduct: string = req.body.purchasedProduct;
        const packPrice: number = packPrices[purchasedProduct];
        const feesPercentage: number = packFeesPercentage[purchasedProduct];
        const feesAmount: number = (feesPercentage / 100) * packPrice;
        const remainingValue: number = packPrice - feesAmount;
        let inexToSent = Math.round(remainingValue / getRate.rate);

        let adminFees = 0;
        adminFees = await this.getAdminFees("PowerPack");
        let powerPackFees = packFeesPercentage[purchasedProduct] - adminFees;

        let discountedValue = 0;
        let finalValue = req.body.powerPackAmountInNumber;

        if (getDiscountCodeData && getDiscountCodeData.discountPercentage) {
          discountedValue =
            req.body.powerPackAmountInNumber *
            getDiscountCodeData.discountPercentage;
          finalValue = req.body.powerPackAmountInNumber - discountedValue;
        }

        let myCaptain = await uservice.findOne({
          referralCode: user.referralCodeUsed,
        });
        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: req.body.powerPackAmountInNumber,
          outCurrencyName: "INEX",
          outAmount: inexToSent,
          finalAmountAfterDiscount: finalValue,
        } as OrderBreakdown;
        let paymentMethodUsed = String(req.body.paymentMethodUsed);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: req.body.purchasedProduct,
          orderRate: getRate,
          receiverAccount: transactionAccount,
          paymentType:
            paymentMethodUsed.toLowerCase() === "paypal"
              ? PaymentTypes.Paypal
              : paymentMethodUsed.toLowerCase() === "wire"
                ? PaymentTypes.Wire
                : paymentMethodUsed.toLowerCase() === "venmo"
                  ? PaymentTypes.Venmo
                  : PaymentTypes.Zelle,
          breakdown: orderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          powerPackFees: powerPackFees,
          discountCode: discountCode,
          captainBeeEmail: myCaptain.email ?? "",
          discountPercentage: getDiscountCodeData?.discountPercentage ?? 0, // Using optional chaining with nullish coalescing
          referralCode: referralCode || undefined, // Store referral code if provided
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        console.log(user.email, order.breakdown);
        console.log(paymentMethodUsed.toLowerCase() === "paypal");
        if (paymentMethodUsed.toLowerCase() === "paypal") {
          let finalAmount = (Math.round(finalValue * 100) / 100).toFixed(2);

          let paypalCreateOrder = await createPaypalOrder(
            "USD",
            finalAmount,
            user.email
          );
          console.log(paypalCreateOrder);

          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: "USD",
            links: paypalCreateOrder.links,
            payerEmail: user.email,
          };
          let paypalOrder = await paypalService.create(newPaypalOrder);

          let powerpackData = await powerpackService.create({
            amount: req.body.powerPackAmount,
            email: user.email,
            orderId: order.orderId,
            purchaseDate: new Date(),
            type: req.body.purchasedProduct,
            paymentMethodUsed: req.body.paymentMethodUsed,
            paymentStatus: OrderStatus.Quoted,
          });
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return { status: 500, data: "Something went wrong" };
          }
        }
        let powerpackData = await powerpackService.create({
          amount: req.body.powerPackAmount,
          email: user.email,
          orderId: order.orderId,
          purchaseDate: new Date(),
          type: req.body.purchasedProduct,
          paymentMethodUsed: req.body.paymentMethodUsed,
          paymentStatus: OrderStatus.Quoted,
        });
        return { status: 200, data: order };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createOrderForSmartCryptoFreeTrailUpdation(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      let paymentType = req.body.paymentType;

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let getSmartCryptoPlan = await smartCryptoService.findOne({
          portfolioName: planName,
          managedBy: planManagedBy,
          isActive: true,
        });
        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName:
            getSmartCryptoPlan.portfolioName +
            "|" +
            getSmartCryptoPlan.managedBy,
          outAmount: 0,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.SmartCryptoFreeTrialConvert,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "SmartCryptoFreeTrialConvert") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrder(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");
            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            console.log("inside sell updateUser1");
            //update 1 for user increment fiat value
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            let process = await orderService.processOrder(order);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            return { status: 200, data: getNewDetails };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createFreeTrailOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      let paymentType = req.body.paymentType;

      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 3;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let getSmartCryptoPlan = await smartCryptoService.findOne({
          portfolioName: planName,
          managedBy: planManagedBy,
          isActive: true,
        });
        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName:
            getSmartCryptoPlan.portfolioName +
            "|" +
            getSmartCryptoPlan.managedBy,
          outAmount: 0,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.FreeTrailOrder,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "FreeTrailOrder") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalCreateOrder = await createPaypalOrder(
              order.breakdown.inCurrenyName,
              finalAmount,
              user.email
            );
            console.log(paypalCreateOrder);
            let newPaypalOrder = {
              orderId: order.orderId,
              paypalId: paypalCreateOrder.id,
              status: paypalCreateOrder.status,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              links: paypalCreateOrder.links,
              payerEmail: user.email,
            };
            let paypalOrder = await paypalService.create(newPaypalOrder);
            if (paypalOrder) {
              return { status: 200, data: paypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrderForFreeTrial(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");

            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            // Deduct balance and update last used date
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  "userWallets.$.coinLastUsedOn": new Date(),
                },
              }
            );

            let process = await orderService.processOrder(order);
            console.log("process", process);
            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            let updateOrder = await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                $set: {
                  status: "Completed",
                },
              }
            );
            return { status: 200, data: order };
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createMiningSubscriptionOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let amount = req.body.amount;
      let paymentType = req.body.paymentType;
      let referralCode = req.body.referralCode; // Optional referral code
      const { receiptData, platformData } = req.body;

      // Validate referral code if provided
      let referralValidation = null;
      if (referralCode && referralCode.trim() !== "") {
        const referralEarningService = new ReferralEarningService();
        referralValidation = await referralEarningService.validateReferralCode(
          referralCode
        );

        if (!referralValidation.isValid) {
          return {
            status: 400,
            data: {
              message: referralValidation.error || "Invalid referral code",
            },
          };
        }
      }
      let user = await uservice.findOneSelect(
        {
          email: String(String(email).toLowerCase()).toLowerCase(),
        },
        {}
      );
      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;
      let orderAmount = Number(amount);
      console.log(orderAmount, "orderAmount");
      console.log(!user.isKYCPass);
      console.log(user.kycStatus !== "Completed");
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      }
      // else if (
      //   orderAmount > 599 &&
      //   !user.isKYCPass &&
      //   user.kycStatus !== "Completed" &&
      //   req.body.orderType === "SmartCryptoBuy"
      // ) {
      //   return {
      //     status: 500,
      //     data: isHoneyBeeOrder
      //       ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
      //       : "User not allowed to place order. Please complete KYC first",
      //   };
      // }
      else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 3;

        let getRate = {} as Rates;

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let getSubscriptionByName = await subscriptionPlansService.findOne({
          name: planName,
        });

        let orderBreakdown = {
          inCurrenyName: "USD",
          inAmount: orderAmount,
          outCurrencyName: getSubscriptionByName.name,
          outAmount: 0,
        } as OrderBreakdown;
        console.log(paymentType);
        let paymentTypeString = String(paymentType).toLowerCase();
        console.log(paymentTypeString);
        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType: OrderType.MiningSubscriptionOrder,
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentTypeString === "paypal"
              ? PaymentTypes.Paypal
              : paymentTypeString === "zelle"
                ? PaymentTypes.Zelle
                : paymentTypeString === "wire transfer"
                  ? PaymentTypes.Wire
                  : paymentTypeString === "venmo"
                    ? PaymentTypes.Venmo
                    : paymentTypeString === "ach"
                      ? PaymentTypes.ACH
                      : paymentTypeString === "tygapay"
                        ? PaymentTypes.TygaPay
                        : paymentTypeString === "credit card"
                          ? PaymentTypes.CC
                          : paymentTypeString === "usd"
                            ? PaymentTypes.USD
                            : paymentTypeString === "app store iap"
                              ? PaymentTypes.ApplePay
                              : paymentTypeString === "play store iap"
                                ? PaymentTypes.Gpay
                                : PaymentTypes.BankDirect,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          referralCode: referralCode || undefined, // Store referral code if provided
        } as Order;

        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "MiningSubscriptionOrder") {
          if (
            paymentTypeString !== "zelle" &&
            paymentTypeString !== "wire transfer" &&
            paymentTypeString !== "venmo" &&
            paymentTypeString !== "tygapay" &&
            paymentTypeString !== "ach" &&
            paymentTypeString !== "play store iap" &&
            paymentTypeString !== "app store iap" &&
            paymentTypeString !== "usd"
          ) {
            console.log(user.email, order.breakdown);
            let finalAmount = (
              Math.round(order.breakdown.inAmount * 100) / 100
            ).toFixed(2);
            let paypalSubscription = await createSubscription(
              getSubscriptionByName.productId,
              user.email,
              ""
            );

            let getMySubscription = await getSubscriptionDetails(
              paypalSubscription?.id
            );
            let orderId = Math.floor(10000000 + Math.random() * 90000000);
            let newPaypalOrder = {
              orderId: orderId,
              subscriptionId: getMySubscription?.id ?? paypalSubscription?.id,
              status: SubscriptionStatus.APPROVAL_PENDING,
              orderAmount: finalAmount,
              orderCurrency: order.breakdown.inCurrenyName,
              payerEmail: user.email,
              payerName: `${user.firstName ?? ""} ${user.lastName ?? ""
                }`.trim(),
              links: getMySubscription?.links,
              subscriber: getMySubscription?.subscriber,
              plan_id: getMySubscription?.plan_id,
              quantity: getMySubscription?.quantity,
              status_update_time: getMySubscription?.status_update_time,
              start_time: getMySubscription?.start_time,
              billing_info: getMySubscription?.billing_info,
              create_time: getMySubscription?.create_time,
              update_time: getMySubscription?.update_time,
              plan_overridden: getMySubscription?.plan_overridden,
              transactionArray: [],
            };

            let paypalSubscriptionOrder =
              await paypalSubscriptionService.create(newPaypalOrder);
            if (newPaypalOrder) {
              return { status: 200, data: newPaypalOrder };
            } else {
              return { status: 500, data: "Something went wrong" };
            }
          } else if (paymentTypeString === "tygapay") {
            let tygaOps = new TygaPayOperations(req, res);
            let tygaPayOrder = await tygaOps.createNewOrderForFreeTrial(
              user.email,
              order.orderId,
              order.breakdown.inAmount
            );
            await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                merchantStatus: "pending", // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
                merchantReferenceId: tygaPayOrder?.data?.orderId, //OrderId of merchant for example stripe orderId
                merchantName: "TygaPay",
              }
            );
            return { status: 200, data: tygaPayOrder };
          } else if (paymentTypeString === "usd") {
            console.log("Here in usd order");

            const userWallet = await uservice.findOne({ email: user.email });

            if (
              !userWallet ||
              !userWallet.userWallets ||
              userWallet.userWallets.length === 0
            ) {
              return { status: 500, message: "No wallets found for this user" };
            }

            // Find the USD wallet correctly (fixes case sensitivity issue)
            const usdWallet = userWallet.userWallets.find(
              (wallet) => wallet.coinSymbol === "USD"
            );

            if (!usdWallet) {
              return { status: 500, message: "No USD wallet found" };
            }

            // Check if the balance is sufficient
            if (usdWallet.coinBalance < order.breakdown.inAmount) {
              return { status: 500, message: "Insufficient USD balance" };
            }

            // Deduct balance and update last used date
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "USD",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * order.breakdown.inAmount,
                },
                $set: {
                  "userWallets.$.coinLastUsedOn": new Date(),
                },
              }
            );

            let getNewDetails = await orderService.findOne({
              orderId: order.orderId,
            });

            let updateOrder = await orderService.updatePart(
              {
                orderId: order.orderId,
              },
              {
                $set: {
                  status: "Completed",
                },
              }
            );

            // update the subscription to user plan
            await userSubscriptionService.subscribeUser(
              user.email,
              order.breakdown.outCurrencyName,
              order.paymentType,
              "BTCY"
            );

            // update the mining to user
            await miningService.startMining(
              user.email,
              order.breakdown.outCurrencyName,
              getSubscriptionByName.miningRate,
              "BTCY"
            );
            return { status: 200, data: order };
          } else if (paymentTypeString === "app store iap") {
            const { receiptData } = req.body;

            if (!receiptData) {
              return { status: 400, data: "Missing Apple receipt data" };
            }

            let response;
            let isSandbox = false;

            try {
              response = await axios.post(
                "https://buy.itunes.apple.com/verifyReceipt",
                {
                  "receipt-data": receiptData,
                  password: process.env.APPLE_SHARED_SECRET,
                  "exclude-old-transactions": true,
                },
                {
                  headers: { "Content-Type": "application/json" },
                }
              );

              if (response.data.status === 21007) {
                isSandbox = true;
                response = await axios.post(
                  "https://sandbox.itunes.apple.com/verifyReceipt",
                  {
                    "receipt-data": receiptData,
                    password: process.env.APPLE_SHARED_SECRET,
                    "exclude-old-transactions": true,
                  },
                  {
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }
            } catch (err) {
              console.error("Apple receipt validation failed:", err);
              return { status: 500, data: "Receipt validation error" };
            }

            const { status, latest_receipt_info } = response.data;

            if (status !== 0) {
              return { status: 400, data: "Invalid Apple receipt" };
            }

            const latestReceipt =
              latest_receipt_info[latest_receipt_info.length - 1];
            const { transaction_id, product_id, expires_date_ms } =
              latestReceipt;

            const expirationDate = new Date(Number(expires_date_ms));
            const now = new Date();

            if (expirationDate <= now) {
              return { status: 400, data: "Subscription expired" };
            }

            if (expirationDate > now) {
              await orderService.updatePart(
                { orderId: order.orderId },
                {
                  $set: {
                    status: "Completed",
                    appleTransactionId: transaction_id,
                    productId: product_id,
                    expirationDate,
                  },
                }
              );

              await userSubscriptionService.subscribeUser(
                user.email,
                order.breakdown.outCurrencyName,
                order.paymentType,
                "BTCY"
              );

              await miningService.startMining(
                user.email,
                order.breakdown.outCurrencyName,
                getSubscriptionByName.miningRate,
                "BTCY"
              );

              return { status: 200, data: order };
            }
          } else if (paymentTypeString === "play store iap") {
            const { purchaseToken, packageName, productId } = platformData;

            console.log(platformData, "platformData");
            console.log(receiptData, "receiptData");
            if (!purchaseToken || !packageName || !productId) {
              return {
                status: 400,
                data: "Missing required Google Play purchase data",
              };
            }
            const keyPath = path.resolve(
              __dirname,
              "../credentials/google-play-service-account.json"
            );
            const keyFile = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
            try {
              const scopes = [
                "https://www.googleapis.com/auth/androidpublisher",
              ];

              const jwtClient = new google.auth.JWT(
                keyFile.client_email,
                undefined,
                keyFile.private_key,
                scopes
              );

              await jwtClient.authorize();
              const accessToken = await jwtClient.getAccessToken();

              console.log(accessToken);
              const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
              const response = await axios.get(url, {
                headers: {
                  Authorization: `Bearer ${accessToken.token}`,
                },
              });

              console.log("response", response.data);
              const { paymentState, expiryTimeMillis } = response.data;

              if (paymentState !== 1) {
                // 1 = Payment received
                return {
                  status: 400,
                  data: "Google Play payment not completed",
                };
              }

              const expirationDate = new Date(Number(expiryTimeMillis));
              const now = new Date();

              if (expirationDate > now) {
                await orderService.updatePart(
                  { orderId: order.orderId },
                  {
                    $set: {
                      status: "Completed",
                      googlePurchaseToken: purchaseToken,
                      googlePackageName: packageName,
                      productId: productId,
                      subscriptionStartDate: now,
                      subscriptionEndDate: expirationDate,
                      expirationDate,
                    },
                  }
                );

                await userSubscriptionService.subscribeUser(
                  user.email,
                  order.breakdown.outCurrencyName,
                  order.paymentType,
                  "BTCY"
                );

                await miningService.startMining(
                  user.email,
                  order.breakdown.outCurrencyName,
                  getSubscriptionByName.miningRate,
                  "BTCY"
                );

                return { status: 200, data: order };
              } else {
                return {
                  status: 400,
                  data: "Google Play subscription has expired",
                };
              }
            } catch (error) {
              console.error("Google Play verification error:", error);
              return {
                status: 500,
                data: "Failed to verify Google Play purchase",
              };
            }
          } else {
            return { status: 200, data: order };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  // New Controller Function to Handle Apple Server Notifications
  async handleAppStoreNotifications0(req: any, res: any) {
    try {
      const notification = req.body;

      console.log("Apple Server Notification:", notification);

      const unifiedReceipt = notification.unified_receipt;
      const latestReceiptInfo = unifiedReceipt?.latest_receipt_info?.[0];
      const latestReceipt = unifiedReceipt?.latest_receipt;
      const notificationType = notification.notification_type;

      if (!latestReceiptInfo || !latestReceipt) {
        return {
          status: 400,
          data: { message: "Invalid notification structure" },
        };
      }

      const originalTransactionId = latestReceiptInfo.original_transaction_id;
      const productId = latestReceiptInfo.product_id;
      const purchaseDateMs = parseInt(latestReceiptInfo.purchase_date_ms);
      const expiresDateMs = parseInt(latestReceiptInfo.expires_date_ms);

      console.log("originalTransactionId:", originalTransactionId);
      console.log("productId:", productId);
      console.log("purchaseDate:", new Date(purchaseDateMs));
      console.log("expiresDate:", new Date(expiresDateMs));
      console.log("Notification Type:", notificationType);

      // 🔥 Step 1: Find Order by originalTransactionId (you should store originalTransactionId at time of purchase)
      const order = await orderService.findOne({
        appleTransactionId: originalTransactionId,
      });

      if (!order) {
        console.error(
          "Order not found for Apple transaction id:",
          originalTransactionId
        );
        return { status: 404, data: { message: "Order not found" } };
      }

      // 🔥 Step 2: Update order status based on Apple notification
      if (
        notificationType === "INITIAL_BUY" ||
        notificationType === "DID_RENEW"
      ) {
        await orderService.updatePart(
          { orderId: order.orderId },
          {
            status: "Completed",
            appleReceipt: latestReceipt,
            subscriptionStartDate: new Date(purchaseDateMs),
            subscriptionEndDate: new Date(expiresDateMs),
            lastUpdated: new Date(),
          }
        );

        console.log("Order updated: Subscription Active");
      } else if (notificationType === "CANCEL") {
        await orderService.updatePart(
          { _id: order._id },
          {
            status: "Cancelled",
            subscriptionCancelledAt: new Date(),
            lastUpdated: new Date(),
          }
        );
        console.log("Order updated: Subscription Cancelled");
      } else {
        console.log("Unhandled notification type:", notificationType);
      }

      return {
        status: 200,
        data: { message: "Notification handled successfully" },
      };
    } catch (error: any) {
      console.error("Error handling App Store Notification:", error);
      return { status: 500, data: error };
    }
  }

  async handleAppStoreNotifications(req: any, res: any) {
    try {
      const body = req.body;
      const receiptData = req.body.receiptData;

      let parsedReceipt: ParsedReceipt;
      try {
        parsedReceipt =
          typeof receiptData === "string"
            ? JSON.parse(receiptData)
            : receiptData;
      } catch (e) {
        return { status: 400, data: { message: "Invalid receipt JSON" } };
      }

      console.log("Parsed Receipt:", parsedReceipt);
      setTimeout(async () => {
        try {
          // 🔍 Distinguish between Apple and Google notifications
          if ("unified_receipt" in parsedReceipt) {
            // ========================
            // 🍎 Apple Notification
            // ========================
            const notification = body;
            const latestReceiptInfo =
              notification.unified_receipt?.latest_receipt_info?.[0];
            const latestReceipt = notification.unified_receipt?.latest_receipt;
            const notificationType = notification.notification_type;

            if (!latestReceiptInfo || !latestReceipt) {
              return {
                status: 400,
                data: { message: "Invalid Apple notification structure" },
              };
            }

            const originalTransactionId =
              latestReceiptInfo.original_transaction_id;
            const productId = latestReceiptInfo.product_id;
            const purchaseDate = new Date(
              Number(latestReceiptInfo.purchase_date_ms)
            );
            const expiresDate = new Date(
              Number(latestReceiptInfo.expires_date_ms)
            );

            console.log("📩 Apple Notification Type:", notificationType);
            console.log("originalTransactionId:", originalTransactionId);
            console.log("productId:", productId);

            const order = await orderService.findOne({
              appleTransactionId: originalTransactionId,
            });

            if (!order) {
              console.error(
                "Order not found for Apple transaction ID:",
                originalTransactionId
              );
              return {
                status: 404,
                data: { message: "Invalid Apple notification structure" },
              };
            }

            const updatePayload: any = {
              appleReceipt: latestReceipt,
              lastUpdated: new Date(),
            };

            if (["INITIAL_BUY", "DID_RENEW"].includes(notificationType)) {
              updatePayload.status = "Completed";
              updatePayload.subscriptionStartDate = purchaseDate;
              updatePayload.subscriptionEndDate = expiresDate;
            } else if (notificationType === "CANCEL") {
              updatePayload.status = "Cancelled";
              updatePayload.subscriptionCancelledAt = new Date();
            } else {
              console.log(
                "Unhandled Apple notification type:",
                notificationType
              );
            }

            await orderService.updatePart(
              { orderId: order.orderId },
              updatePayload
            );
            return {
              status: 200,
              data: { message: "Invalid Apple notification structure" },
            };
          } else if (
            "packageName" in parsedReceipt &&
            "purchaseToken" in parsedReceipt
          ) {
            // ========================
            // 🤖 Google Notification
            // ========================
            const {
              packageName,
              purchaseToken,
              purchaseTime,
            } = parsedReceipt;
            const syncResult =
              await googlePlaySubscriptionSyncService.syncSubscriptionByToken({
                packageName:
                  String(packageName || "").trim() || GOOGLE_PLAY_PACKAGE_NAME,
                purchaseToken: String(purchaseToken || "").trim(),
                source: "legacy_notification",
                occurredAt: purchaseTime ? new Date(purchaseTime) : new Date(),
              });

            return {
              status: 200,
              data: {
                message: "Gpay subscription notification processed",
                sync: syncResult,
              },
            };

          } else {
            return { status: 400, data: { message: "Invalid receipt JSON" } };
          }
        } catch (delayedError) {
          console.error("Delayed notification processing error:", delayedError);
        }
      }, 3 * 60 * 1000); // ⏱ 3 minutes delay
    } catch (error: any) {
      console.error("Subscription notification handler error:", error);
      return { status: 500, data: error };
    }
  }

  async createMonthlyINEXOrder(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;
        if (req.body.orderType == "Buy") {
          adminFees = await this.getAdminFees(req.body.currencyOut);
        } else if (req.body.orderType == "Sell") {
          adminFees = await this.getAdminFees(req.body.currencyIn);
        } else if (req.body.orderType == "Convert") {
          adminFees = await this.getAdminFees(req.body.currencyIn);
        }
        const currencyOps: CurrencyOperations = new CurrencyOperations(
          req,
          res
        );
        let currencyRes = await currencyOps.getCurrencyPriceByType(req, res);
        let getRate = {} as Rates;
        if (currencyRes.status == 200 && req.body.orderType == "Buy") {
          const buyRate = await this.resolveBuyQuoteRate(req, currencyRes);
          getRate = {
            currency: currencyRes.data.code,
            rate: buyRate,
          } as Rates;
        } else if (currencyRes.status == 200 && req.body.orderType == "Sell") {
          getRate = {
            currency: currencyRes.data.code,
            rate: currencyRes.data.sellPrice,
          } as Rates;
        }

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: req.body.currencyIn,
          inAmount: req.body.amount,
          outCurrencyName: req.body.currencyOut,
          outAmount: req.body.outAmount,
        } as OrderBreakdown;

        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            req.body.orderType == "Buy"
              ? "Buy"
              : req.body.orderType == "Sell"
                ? "Sell"
                : "Convert",
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType: PaymentTypes.CC,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          comments: "INEX Monthly Purchase",
        } as Order;

        console.log("new order for monthly", newOrder);
        let order = await orderService.create(newOrder);
        //The below code is required for Paypal
        if (order.orderType == "Buy") {
          console.log(user.email, order.breakdown);
          let finalAmount = (
            Math.round(order.breakdown.inAmount * 100) / 100
          ).toFixed(2);
          let paypalCreateOrder = await createPaypalOrder(
            order.breakdown.inCurrenyName,
            finalAmount,
            user.email
          );
          console.log(paypalCreateOrder);
          let newPaypalOrder = {
            orderId: order.orderId,
            paypalId: paypalCreateOrder.id,
            status: paypalCreateOrder.status,
            orderAmount: finalAmount,
            orderCurrency: order.breakdown.inCurrenyName,
            links: paypalCreateOrder.links,
            payerEmail: user.email,
          };
          let paypalOrder = await paypalService.create(newPaypalOrder);
          if (paypalOrder) {
            return { status: 200, data: paypalOrder };
          } else {
            return { status: 500, data: "Something went wrong" };
          }
        } else {
          return { status: 200, data: order };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createMonthlyINEXOrderNonPaypal(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        let adminFees = 0;
        if (req.body.orderType == "MonthlyINEXBuy") {
          adminFees = await this.getAdminFees(req.body.currencyOut);
        }
        const currencyOps: CurrencyOperations = new CurrencyOperations(
          req,
          res
        );
        let currencyRes = await currencyOps.getCurrencyPriceByType(req, res);
        let getRate = {} as Rates;
        if (
          currencyRes.status == 200 &&
          req.body.orderType == "MonthlyINEXBuy"
        ) {
          getRate = {
            currency: currencyRes.data.code,
            rate: currencyRes.data.buyPrice,
          } as Rates;
        }

        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: req.body.currencyIn,
          inAmount: req.body.amount,
          outCurrencyName: req.body.currencyOut,
          outAmount: req.body.outAmount,
        } as OrderBreakdown;

        let transactionAccount = {} as TransactionAccount;
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let paymentMethodUsed = String(req.body.paymentMethodUsed);

        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            req.body.orderType == "MonthlyINEXBuy"
              ? "MonthlyINEXBuy"
              : req.body.orderType == "Sell"
                ? "Sell"
                : "Convert",
          orderRate: getRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType:
            paymentMethodUsed.toLowerCase() === "paypal"
              ? PaymentTypes.Paypal
              : paymentMethodUsed.toLowerCase() === "wire"
                ? PaymentTypes.Wire
                : paymentMethodUsed.toLowerCase() === "venmo"
                  ? PaymentTypes.Venmo
                  : PaymentTypes.Zelle,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeFees: Number(adminFees),
          isCaptainPerformingOrder: isHoneyBeeOrder ? true : false,
          captainBeeEmail: captainBeeEmail,
          comments: "INEX Monthly Purchase",
        } as Order;

        console.log("new order for monthly", newOrder);
        let order = await orderService.create(newOrder);
        // Non paypal subscription data
        let nonPaypalSubscription = {
          orderId: newOrder.orderId,
          paymentMethod: String(newOrder.paymentType),
          paymentStatus: "Pending",
          email: newOrder.user.email,
          createdDate: new Date(),
        } as NonPaypalSubscription;
        let nonPaypalSubscriptionData =
          await nonPaypalSubscriptionService.create(nonPaypalSubscription);

        return { status: 200, data: order };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createMonthlyINEXSubscription(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }

        let orderId = Math.floor(10000000 + Math.random() * 90000000);

        //The below code is required for Paypal

        let paypalSubscription = await createSubscription(
          "P-8DM77961UT078012WMVL3YJY",
          user.email,
          ""
        );
        console.log(paypalSubscription);
        let getMySubscription = await getSubscriptionDetails(
          paypalSubscription?.id
        );
        console.log("getMySubscription", getMySubscription);
        console.log("getMySubscription?.id", getMySubscription?.id);
        console.log("paypalSubscription?.id", paypalSubscription?.id);
        let newPaypalOrder = {
          status: SubscriptionStatus.APPROVAL_PENDING,
          orderAmount: "300",
          orderCurrency: "INEX",
          payerEmail: user.email,
          payerName: user?.lastName
            ? user?.lastName
            : "" + " " + user?.lastName
              ? user?.lastName
              : "",
          orderId: orderId,
          subscriptionId: getMySubscription?.id
            ? getMySubscription?.id
            : paypalSubscription?.id,
          links: getMySubscription?.links,
          subscriber: getMySubscription?.subscriber,
          plan_id: getMySubscription?.plan_id,
          quantity: getMySubscription?.quantity,
          status_update_time: getMySubscription?.status_update_time,
          start_time: getMySubscription?.start_time,
          billing_info: getMySubscription?.billing_info,
          create_time: getMySubscription?.create_time,
          update_time: getMySubscription?.update_time,
          plan_overridden: getMySubscription?.plan_overridden,
          transactionArray: [],
        };
        console.log("newPaypalOrder", newPaypalOrder);
        let paypalSubscriptionOrder = await paypalSubscriptionService.create(
          newPaypalOrder
        );
        if (paypalSubscriptionOrder) {
          await new SendEmail().sendAccountsOrderCreated({
            userEmail: user.email,
            orderId: String(newPaypalOrder.orderId || ""),
            orderType: "Subscription",
            paymentType: "Paypal",
            inAmount: Number(newPaypalOrder.orderAmount || 0),
            inCurrency: String(newPaypalOrder.orderCurrency || ""),
            outAmount: Number(newPaypalOrder.orderAmount || 0),
            outCurrency: String(newPaypalOrder.orderCurrency || ""),
            status: String(newPaypalOrder.status || ""),
            exchangeName: "PaypalSubscription",
            createdAt: new Date(),
            notes: "Monthly INEX subscription created",
          });
          return { status: 200, data: paypalSubscriptionOrder };
        } else {
          return { status: 500, data: "Something went wrong" };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createMonthlyHoneyBeeINEXSubscription(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }

        let orderId = Math.floor(10000000 + Math.random() * 90000000);

        //The below code is required for Paypal
        let paypalSubscription = await createSubscription(
          "P-90W5261077307292YMVQNILA",
          user.email,
          ""
        );
        console.log(paypalSubscription);
        let getMySubscription = await getSubscriptionDetails(
          paypalSubscription?.id
        );
        console.log("getMySubscription", getMySubscription);
        console.log("getMySubscription?.id", getMySubscription?.id);
        console.log("paypalSubscription?.id", paypalSubscription?.id);
        let newPaypalOrder = {
          status: SubscriptionStatus.APPROVAL_PENDING,
          orderAmount: "150",
          orderCurrency: "INEX",
          payerEmail: user.email,
          payerName: user?.lastName
            ? user?.lastName
            : "" + " " + user?.lastName
              ? user?.lastName
              : "",
          orderId: orderId,
          subscriptionId: getMySubscription?.id
            ? getMySubscription?.id
            : paypalSubscription?.id,
          links: getMySubscription?.links,
          subscriber: getMySubscription?.subscriber,
          plan_id: getMySubscription?.plan_id,
          quantity: getMySubscription?.quantity,
          status_update_time: getMySubscription?.status_update_time,
          start_time: getMySubscription?.start_time,
          billing_info: getMySubscription?.billing_info,
          create_time: getMySubscription?.create_time,
          update_time: getMySubscription?.update_time,
          plan_overridden: getMySubscription?.plan_overridden,
          transactionArray: [],
        };
        console.log("newPaypalOrder", newPaypalOrder);
        let paypalSubscriptionOrder = await paypalSubscriptionService.create(
          newPaypalOrder
        );
        if (paypalSubscriptionOrder) {
          await new SendEmail().sendAccountsOrderCreated({
            userEmail: user.email,
            orderId: String(newPaypalOrder.orderId || ""),
            orderType: "Subscription",
            paymentType: "Paypal",
            inAmount: Number(newPaypalOrder.orderAmount || 0),
            inCurrency: String(newPaypalOrder.orderCurrency || ""),
            outAmount: Number(newPaypalOrder.orderAmount || 0),
            outCurrency: String(newPaypalOrder.orderCurrency || ""),
            status: String(newPaypalOrder.status || ""),
            exchangeName: "PaypalSubscription",
            createdAt: new Date(),
            notes: "Monthly HoneyBee INEX subscription created",
          });
          return { status: 200, data: paypalSubscriptionOrder };
        } else {
          return { status: 500, data: "Something went wrong" };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async cancelMonthlyINEXSubscription(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );

      let isHoneyBeeOrder = req.body.isHoneyBeeOrder;

      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (!user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: isHoneyBeeOrder
            ? "User not allowed to place order. Ask your honey bee/captain bee complete KYC first"
            : "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let captainBeeEmail;
        if (isHoneyBeeOrder) {
          let captainBeeData = await uservice.findOne({
            referralCode: user.referralCodeUsed,
          });
          captainBeeEmail = captainBeeData.email;
        }
        console.log("req.body.subscriptionId", req.body.subscriptionId);

        let getMySubscription = await getSubscriptionDetails(
          req.body.subscriptionId
        );

        console.log("getMySubscription", getMySubscription);
        let getSubscriptionDetailsFromDB =
          await paypalSubscriptionService.findOne({
            subscriptionId: req.body.subscriptionId,
          });

        console.log(
          "getSubscriptionDetailsFromDB",
          getSubscriptionDetailsFromDB
        );

        if (getMySubscription && getSubscriptionDetailsFromDB) {
          let paypalSubscription = await cancelSubscription(
            req.body.subscriptionId,
            req.body.reason
          );
          console.log(paypalSubscription);

          if (paypalSubscription) {
            let updatePaypalSubscription =
              await paypalSubscriptionService.updatePart(
                {
                  subscriptionId: req.body.subscriptionId,
                },
                {
                  $set: {
                    status: SubscriptionStatus.CANCELLED,
                  },
                }
              );

            console.log("updatePaypalSubscription", updatePaypalSubscription);
            return {
              status: 200,
              data: {
                message: "Subscription cancelled Successfully",
              },
            };
          }
        } else {
          return {
            status: 500,
            data: {
              message: "Subscription cancelling failed",
            },
          };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateUserOrder(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let userOrder = await orderService.findOne({
          orderId: req.body.orderId,
          "user.email": String(req.body.email).toLowerCase(),
        });
        if (userOrder) {
          if (req.body.orderStatus == "Completed") {
            let process = await orderService.processOrder(userOrder);
            let getLatestOrderDetails = await orderService.findOne({
              orderId: req.body.orderId,
              "user.email": String(req.body.email).toLowerCase(),
            });

            if (getLatestOrderDetails.status === OrderStatus.Completed) {
              //Disabled reward on
              //let resRewards = await addRewards(String(req.body.email).toLowerCase(), req.body.orderId);
              let totalOutAmount =
                getLatestOrderDetails.breakdown.inAmount *
                getLatestOrderDetails.orderRate.rate;
              let afterOurFees =
                totalOutAmount -
                totalOutAmount *
                (Number(getLatestOrderDetails.exchangeFees) / 100);
              // send email to user after completion
              // await new SendEmail().sendOrderCompleted(
              //   userOrder.user.email,
              //   "User",
              //   getLatestOrderDetails.breakdown.inAmount,
              //   getLatestOrderDetails.breakdown.inCurrenyName,
              //   getLatestOrderDetails.orderType,
              //   getLatestOrderDetails.orderRate.rate,
              //   afterOurFees,
              //   "",
              //   getLatestOrderDetails.orderId
              // );
              await new SendEmail().sendAccountsOrderCompleted({
                userEmail: getLatestOrderDetails.user?.email || "",
                orderId: getLatestOrderDetails.orderId,
                orderType: getLatestOrderDetails.orderType,
                paymentType: String(getLatestOrderDetails.paymentType || ""),
                inAmount: getLatestOrderDetails.breakdown?.inAmount,
                inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
                outAmount: getLatestOrderDetails.breakdown?.outAmount,
                outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
                status: getLatestOrderDetails.status,
                exchangeName: getLatestOrderDetails.exchangeName,
                blockchainName: getLatestOrderDetails.blockchainName,
                completedAt:
                  getLatestOrderDetails.orderCompletedOn || new Date(),
                notes:
                  getLatestOrderDetails.notes ||
                  getLatestOrderDetails.comments ||
                  "",
              });
              //add referral earnings to referred user
            }
            //console.log(resRewards);

            return { status: 200, data: process };
          }
          return { status: 200, data: userOrder };
        } else {
          return { status: 500, data: "Order not found" };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateUserOrderForFiatDeposit(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: "User not allowed to place order. Please complete KYC first",
        };
      } else {
        let userOrder = await orderService.findOne({
          orderId: req.body.orderId,
          "user.email": String(req.body.email).toLowerCase(),
        });
        if (userOrder) {
          if (req.body.orderStatus == "Completed") {
            let process = await orderService.processOrder(userOrder);
            let getLatestOrderDetails = await orderService.findOne({
              orderId: req.body.orderId,
              "user.email": String(req.body.email).toLowerCase(),
            });

            //update the transaction
            let updateTx = await txservice.updatePart(
              {
                orderId: req.body.orderId,
                txId: req.body.txId,
                email: String(req.body.email).toLowerCase(),
              },
              {
                $set: {
                  status: "Completed",
                  info: req.body.notes ? req.body.notes : "",
                },
              }
            );
            //Disabled reward on
            //let resRewards = await addRewards(String(req.body.email).toLowerCase(), req.body.orderId);
            // send email to user after completion
            await new SendEmail().sendOrderCompleted(
              userOrder.user.email,
              "User",
              getLatestOrderDetails.breakdown.outAmount,
              getLatestOrderDetails.breakdown.outCurrencyName,
              getLatestOrderDetails.orderType,
              getLatestOrderDetails.orderRate.rate,
              getLatestOrderDetails.breakdown.inAmount -
              (getLatestOrderDetails.breakdown.inAmount *
                Number(getLatestOrderDetails?.exchangeFees)) /
              100,
              "",
              getLatestOrderDetails.orderId
            );
            await new SendEmail().sendAccountsOrderCompleted({
              userEmail: getLatestOrderDetails.user?.email || "",
              orderId: getLatestOrderDetails.orderId,
              orderType: getLatestOrderDetails.orderType,
              paymentType: String(getLatestOrderDetails.paymentType || ""),
              inAmount: getLatestOrderDetails.breakdown?.inAmount,
              inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
              outAmount: getLatestOrderDetails.breakdown?.outAmount,
              outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
              status: getLatestOrderDetails.status,
              exchangeName: getLatestOrderDetails.exchangeName,
              blockchainName: getLatestOrderDetails.blockchainName,
              completedAt: getLatestOrderDetails.orderCompletedOn || new Date(),
              notes:
                getLatestOrderDetails.notes ||
                getLatestOrderDetails.comments ||
                "",
            });
            //console.log(resRewards);

            return { status: 200, data: process };
          }
          return { status: 200, data: userOrder };
        } else {
          return { status: 500, data: "Order not found" };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async paypalWebhook(req: any, res: any) {
    try {
      if (req.body?.resource?.status === "APPROVED") {
        let paypalOrder = await paypalService.findOne({
          paypalId: req.body.resource.id,
        });
        const orderId = req.body.resource.id;
        const captureResult = await capturePayment(orderId);
        console.log("Payment captured successfully:", captureResult);
        //update paypal table
        await paypalService.updatePart(
          {
            paypalId: req.body.resource.id,
          },
          {
            $set: {
              status: req.body.resource.status,
              payerEmail: req.body.resource?.payer?.email_address,
              payerName: req.body.resource?.payer?.name?.given_name,
              payerLastName: req.body.resource?.payer?.name?.surname,
              payerId: req.body.resource?.payer?.payer_id,
            },
          }
        );
        let link = paypalOrder.links.find(
          (x) => x.rel === "self" && x.method === "GET"
        );
        return { status: 200, data: "Order Captured" };
      } else if (req.body?.resource?.status === "COMPLETED") {
        console.log(req.body.resource.status);
        console.log(req.body.resource.supplementary_data);
        console.log(req.body.resource.supplementary_data.related_ids);
        console.log(req.body.resource.supplementary_data.related_ids.order_id);
        let paypalOrder = await paypalService.findOne({
          paypalId: req.body.resource.supplementary_data.related_ids.order_id,
        });

        let userOrder;
        let powerPackOrder;
        console.log("paypalOrder", paypalOrder);
        if (paypalOrder) {
          userOrder = await orderService.findOne({
            orderId: paypalOrder.orderId,
          });

          powerPackOrder = await powerpackService.findOne({
            orderId: paypalOrder.orderId,
          });
        }

        let getShopOrder = await shopOrdersService.findOne({
          "payment_intent.payment_intent_info.payment_id":
            req.body.resource.supplementary_data.related_ids.order_id,
        });

        if (userOrder && powerPackOrder) {
          console.log("Processing powerpack order");
          //update paypal table
          await paypalService.updatePart(
            {
              paypalId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource.status,
                //payerEmail: req.body.resource?.payer?.email_address,
                payerName: req.body.resource?.payer?.name?.given_name,
                payerLastName: req.body.resource?.payer?.name?.surname,
                payerId: req.body.resource?.payer?.payer_id,
              },
            }
          );

          const userOps = new UserOperations(req, res);
          let process = await userOps.updatePowerPackData(
            req,
            res,
            paypalOrder.orderId
          );
          return { status: 200, data: process };
        } else if (userOrder) {
          console.log("Processing normal order");

          //update paypal table
          await paypalService.updatePart(
            {
              paypalId:
                req.body.resource.supplementary_data.related_ids.order_id,
            },
            {
              $set: {
                status: req.body.resource.status,
                //payerEmail: req.body.resource?.payer?.email_address,
                payerName: req.body.resource?.payer?.name?.given_name,
                payerLastName: req.body.resource?.payer?.name?.surname,
                payerId: req.body.resource?.payer?.payer_id,
              },
            }
          );
          let user = await uservice.findOneSelect(
            {
              email: userOrder.user.email,
            },
            {}
          );
          if (user && user.role == UserRoleTypes.Admin) {
            return { status: 500, data: "Admin cannot place order" };
          } else {
            if (
              userOrder.status === "Quoted" &&
              userOrder.exchangeName === "Centralized"
            ) {
              let process = await orderService.processOrder(userOrder);
              let getLatestOrderDetails = await orderService.findOne({
                orderId: userOrder.orderId,
                "user.email": userOrder.user.email,
              });
              await checkAndUpdateFirstTimeTranactionPoints(
                getLatestOrderDetails
              );
              let resRewards = await addRewards(
                userOrder.user.email,
                userOrder.orderId
              );
              console.log(resRewards);
              //update paypal table
              let updatePaypal = await paypalService.updatePart(
                {
                  paypalId:
                    req.body.resource.supplementary_data.related_ids.order_id,
                },
                {
                  $set: {
                    status: req.body.resource.status,
                    //payerEmail: req.body.resource?.payer?.email_address,
                    payerName: req.body.resource?.payer?.name?.given_name,
                    payerLastName: req.body.resource?.payer?.name?.surname,
                    payerId: req.body.resource?.payer?.payer_id,
                  },
                }
              );

              if (
                getLatestOrderDetails.orderType !== "SmartAPY" &&
                getLatestOrderDetails.orderType !== "FreeTrailOrder" &&
                getLatestOrderDetails.orderType !== "GiftCardBuy" &&
                getLatestOrderDetails.orderType !== "SmartCryptoBuy" &&
                getLatestOrderDetails.orderType !== "Deposit" &&
                getLatestOrderDetails.orderType !== "MiningSubscriptionOrder" &&
                getLatestOrderDetails.orderType !==
                "SmartCryptoFreeTrialConvert"
              ) {
                // send email to user after completion
                await new SendEmail().sendOrderCompleted(
                  userOrder.user.email,
                  "User",
                  getLatestOrderDetails.breakdown.outAmount,
                  getLatestOrderDetails.breakdown.outCurrencyName,
                  getLatestOrderDetails.orderType,
                  getLatestOrderDetails.orderRate.rate,
                  getLatestOrderDetails.breakdown.inAmount -
                  (getLatestOrderDetails.breakdown.inAmount *
                    Number(getLatestOrderDetails?.exchangeFees)) /
                  100,
                  "",
                  getLatestOrderDetails.orderId
                );
                await new SendEmail().sendAccountsOrderCompleted({
                  userEmail: getLatestOrderDetails.user?.email || "",
                  orderId: getLatestOrderDetails.orderId,
                  orderType: getLatestOrderDetails.orderType,
                  paymentType: String(getLatestOrderDetails.paymentType || ""),
                  inAmount: getLatestOrderDetails.breakdown?.inAmount,
                  inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
                  outAmount: getLatestOrderDetails.breakdown?.outAmount,
                  outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
                  status: getLatestOrderDetails.status,
                  exchangeName: getLatestOrderDetails.exchangeName,
                  blockchainName: getLatestOrderDetails.blockchainName,
                  completedAt:
                    getLatestOrderDetails.orderCompletedOn || new Date(),
                  notes:
                    getLatestOrderDetails.notes ||
                    getLatestOrderDetails.comments ||
                    "",
                });
                const newTx = await txservice.create({
                  email: getLatestOrderDetails.user.email,
                  orderId: getLatestOrderDetails.orderId,
                  extRef: "",
                  txId: "",
                  from: "",
                  to: getLatestOrderDetails.user.email,
                  amount: getLatestOrderDetails.breakdown.outAmount,
                  exchangeName: "CEX",
                  info: "Buy crypto by user",
                  status: OrderStatus.Completed,
                  currencyRef: getLatestOrderDetails.breakdown.outCurrencyName,
                  walletType: "ASSET_WALLET",
                  transactionType: "BUY",
                  txDate: new Date(),
                  benificaryAddress: "",
                });

                const quantumOrderIndicator = String(
                  getLatestOrderDetails?.comments || ""
                )
                  .toLowerCase()
                  .includes("quantum");
                const quantumCurrency = String(
                  getLatestOrderDetails?.breakdown?.outCurrencyName || ""
                )
                  .toUpperCase()
                  .includes("BTCY");
                const isQuantumOrder = quantumOrderIndicator || quantumCurrency;
                const paymentType = getLatestOrderDetails?.paymentType;
                const isUsdOrPaypalPayment =
                  paymentType === PaymentTypes.Paypal ||
                  paymentType === PaymentTypes.USD;

                if (isQuantumOrder && isUsdOrPaypalPayment) {
                  try {
                    const orderEmail = String(
                      getLatestOrderDetails?.user?.email || ""
                    ).toLowerCase();
                    if (orderEmail) {
                      ChatSocketService.emitToUser(
                        orderEmail,
                        "order:confirmed",
                        {
                          orderId: getLatestOrderDetails.orderId,
                          status: OrderStatus.Completed,
                          amount:
                            getLatestOrderDetails.breakdown?.outAmount ?? null,
                          currency:
                            getLatestOrderDetails.breakdown?.outCurrencyName ??
                            null,
                          paymentType: paymentType,
                          orderType: "Quantum",
                        }
                      );
                      ChatSocketService.emitToUser(
                        orderEmail,
                        "orders:update",
                        {
                          orderId: getLatestOrderDetails.orderId,
                          status: OrderStatus.Completed,
                        }
                      );
                    }
                  } catch (socketErr) {
                    console.error(
                      "[paypalWebhook] quantum order socket emit failed:",
                      socketErr
                    );
                  }
                }
              }

              //console.log(resRewards);

              let userReferralCode = user.referralCodeUsed;

              if (userReferralCode) {
                try {
                  let referredUser = await uservice.findOne({
                    referralCode: userReferralCode,
                  });

                  if (referredUser) {
                    let getUserReferralData =
                      await referralEarningService.findOne({
                        referrerEmail: referredUser.email,
                      });

                    if (getUserReferralData) {
                      let existingOrders = getUserReferralData.orders || [];
                      let commissionValue =
                        getLatestOrderDetails.breakdown.inAmount; // USD value
                      let latestBaseRate = await currencyService.findOne({
                        code: "INEX",
                      });

                      if (latestBaseRate && latestBaseRate.buyPrice) {
                        let finalCommission =
                          (commissionValue / latestBaseRate.buyPrice) *
                          (getLatestOrderDetails.breakdown.outCurrencyName ===
                            "INEX" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "IN500" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "IUSD+" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "INXC" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "WIBS" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "DaCrazy" ||
                            getLatestOrderDetails.breakdown.outCurrencyName ===
                            "daCrazy"
                            ? 5 / 100
                            : 1 / 100);

                        let addNewOrder = {
                          email: user.email,
                          amount: getLatestOrderDetails.breakdown.outAmount,
                          currency:
                            getLatestOrderDetails.breakdown.outCurrencyName,
                          type: getLatestOrderDetails.orderType,
                          date: new Date(),
                          commissionValue: finalCommission,
                        };

                        existingOrders.push(addNewOrder);

                        // Add the referral commission
                        let updateCommissionData =
                          await referralEarningService.updatePart(
                            {
                              referrerEmail: referredUser.email,
                            },
                            {
                              $set: {
                                commissionCurrency: "INEX",
                                commissionPercentage: 5,
                                orders: existingOrders,
                                totalEarned:
                                  (getUserReferralData.totalEarned || 0) +
                                  finalCommission,
                              },
                            }
                          );

                        if (updateCommissionData) {
                          console.log(
                            "Referral commission updated successfully."
                          );
                        } else {
                          console.error(
                            "Failed to update referral commission."
                          );
                        }
                      } else {
                        console.error("Invalid base rate data.");
                      }
                    } else {
                      console.error(
                        "Referral data not found for the referrer."
                      );
                    }
                  } else {
                    console.error("Referred user not found.");
                  }
                } catch (error) {
                  console.error("Error processing referral commission:", error);
                }
              }

              return { status: 200, data: process };
            } else if (
              userOrder.status === "Quoted" &&
              userOrder.exchangeName === "Decentralized"
            ) {
              let orderDetails = await this.getDEXOrderDetailsByOrderId(
                userOrder.orderId
              );
              const txOps = new TxOperations(req, res);
              let dataResults = await txOps.processDEXBuyOrderByPaypal(
                orderDetails
              );
              return { status: 200, data: dataResults };
            }
            return { status: 200, data: userOrder };
          }
        } else if (getShopOrder) {
          console.log("Processing shop order", getShopOrder);
          if (
            req.body.resource.status === "COMPLETED" &&
            getShopOrder.order_status === "order-pending" &&
            getShopOrder.payment_status === "payment-pending"
          ) {
            const updateOrder = await shopOrdersService.updatePart(
              {
                tracking_number: getShopOrder.tracking_number,
              },
              {
                $set: {
                  order_status: "order-completed",
                  payment_status: "payment-success",
                },
              }
            );
            let defaultCurrency = "USD";
            const usdRate = await getPriceByName(defaultCurrency);
            for (let i = 0; i < getShopOrder.products.length; i++) {
              // Get the product's order quantity and unit price
              let product = getShopOrder.products[i];
              let productQuantity = Number(product.order_quantity); // Convert order quantity to integer
              let unitPrice = Number(product.unit_price); // Convert unit price to a number

              let user = await uservice.findOne({
                email: getShopOrder.customer_contact,
              });
              // Loop through the product quantity and create a gift card for each unit
              for (let j = 0; j < productQuantity; j++) {
                let createGiftCardForUser = await createGiftCard(
                  product.slug,
                  getShopOrder.customer_contact,
                  unitPrice
                );

                let userReferralCode = user.referralCodeUsed;

                if (userReferralCode) {
                  try {
                    let referredUser = await uservice.findOne({
                      referralCode: userReferralCode,
                    });

                    if (referredUser) {
                      let getUserReferralData =
                        await referralEarningService.findOne({
                          referrerEmail: referredUser.email,
                        });

                      if (getUserReferralData) {
                        let existingOrders = getUserReferralData.orders || [];
                        let commissionValue = unitPrice; // USD value
                        let latestBaseRate = await currencyService.findOne({
                          code: "INEX",
                        });

                        if (latestBaseRate && latestBaseRate.buyPrice) {
                          let finalCommission =
                            (commissionValue / latestBaseRate.buyPrice) *
                            (1 / 100);

                          let addNewOrder = {
                            email: user.email,
                            amount: unitPrice,
                            currency: product.name,
                            type: "Shop Purchase",
                            date: new Date(),
                            commissionValue: finalCommission,
                          };

                          existingOrders.push(addNewOrder);

                          // Add the referral commission
                          let updateCommissionData =
                            await referralEarningService.updatePart(
                              {
                                referrerEmail: referredUser.email,
                              },
                              {
                                $set: {
                                  commissionCurrency: "INEX",
                                  commissionPercentage: 5,
                                  orders: existingOrders,
                                  totalEarned:
                                    (getUserReferralData.totalEarned || 0) +
                                    finalCommission,
                                },
                              }
                            );

                          if (updateCommissionData) {
                            console.log(
                              "Referral commission updated successfully."
                            );
                          } else {
                            console.error(
                              "Failed to update referral commission."
                            );
                          }
                        } else {
                          console.error("Invalid base rate data.");
                        }
                      } else {
                        console.error(
                          "Referral data not found for the referrer."
                        );
                      }
                    } else {
                      console.error("Referred user not found.");
                    }
                  } catch (error) {
                    console.error(
                      "Error processing referral commission:",
                      error
                    );
                  }
                }

                await new SendEmail().sendSelfGiftCardNotification(
                  product.receiver_email
                    ? product.receiver_email
                    : getShopOrder.customer_contact,
                  product.name,
                  createGiftCardForUser.currencies,
                  unitPrice,
                  createGiftCardForUser.voucher,
                  product.image,
                  unitPrice,
                  product.personal_message
                );
              }
            }
          }
          return {
            status: 200,
            data: getShopOrder,
          };
        } else {
          return { status: 500, data: "Order not found" };
        }
      } else if (req.body?.resource_type === "subscription") {
        let paypalSubscriptionData = await paypalSubscriptionService.findOne({
          subscriptionId: req.body.resource.id,
        });

        if (req.body.resource.status === "ACTIVE" && paypalSubscriptionData) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );

          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );

          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });

          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "CANCELLED" &&
          paypalSubscriptionData
        ) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource?.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "COMPLETED" &&
          paypalSubscriptionData
        ) {
          let newTxArray = paypalSubscriptionData.transactionArray;
          newTxArray.push(req.body.resource);
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                update_time: req.body.resource?.update_time,
                transactionArray: newTxArray,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          //let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );
          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );

          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        return { status: 200, data: {} };
      } else if (req.body?.resource_type === "sale") {
        let paypalSubscriptionData = await paypalSubscriptionService.findOne({
          subscriptionId: req.body.resource.billing_agreement_id,
        });

        if (
          (req.body.resource.status === "COMPLETED" ||
            req.body.resource.status === "completed") &&
          paypalSubscriptionData
        ) {
          let newTxArray = paypalSubscriptionData.transactionArray;
          newTxArray.push(req.body.resource);
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                update_time: req.body.resource?.update_time,
                transactionArray: newTxArray,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          //let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );
          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "CANCELLED" &&
          paypalSubscriptionData
        ) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource?.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        return { status: 200, data: {} };
      } else if (req.body?.status === "success") {
        /// for tygapay
        console.log("Processing normal order from tygapay");
        let userOrder = await orderService.findOne({
          orderId: req.body.orderNumber,
        });
        let user;
        let shopOrder;
        if (userOrder) {
          user = await uservice.findOneSelect(
            {
              email: userOrder.user.email,
            },
            {}
          );
        } else {
          shopOrder = await shopOrdersService.findOne({
            tracking_number: req.body.orderNumber,
          });
        }

        if (user && user.role == UserRoleTypes.Admin) {
          return { status: 500, data: "Admin cannot place order" };
        } else if (user && userOrder) {
          if (
            userOrder.status === "Quoted" &&
            userOrder.exchangeName === "Centralized"
          ) {
            let process = await orderService.processOrder(userOrder);
            let getLatestOrderDetails = await orderService.findOne({
              orderId: userOrder.orderId,
              "user.email": userOrder.user.email,
            });
            await checkAndUpdateFirstTimeTranactionPoints(
              getLatestOrderDetails
            );
            let resRewards = await addRewards(
              userOrder.user.email,
              userOrder.orderId
            );
            console.log(resRewards);
            if (
              getLatestOrderDetails.orderType !== "SmartAPY" &&
              getLatestOrderDetails.orderType !== "FreeTrailOrder" &&
              getLatestOrderDetails.orderType !== "GiftCardBuy" &&
              getLatestOrderDetails.orderType !== "SmartCryptoBuy" &&
              getLatestOrderDetails.orderType !== "SmartCryptoFreeTrialConvert"
            ) {
              // send email to user after completion
              await new SendEmail().sendOrderCompleted(
                userOrder.user.email,
                "User",
                getLatestOrderDetails.breakdown.outAmount,
                getLatestOrderDetails.breakdown.outCurrencyName,
                getLatestOrderDetails.orderType,
                getLatestOrderDetails.orderRate.rate,
                getLatestOrderDetails.breakdown.inAmount -
                (getLatestOrderDetails.breakdown.inAmount *
                  Number(getLatestOrderDetails?.exchangeFees)) /
                100,
                "",
                getLatestOrderDetails.orderId
              );
              await new SendEmail().sendAccountsOrderCompleted({
                userEmail: getLatestOrderDetails.user?.email || "",
                orderId: getLatestOrderDetails.orderId,
                orderType: getLatestOrderDetails.orderType,
                paymentType: String(getLatestOrderDetails.paymentType || ""),
                inAmount: getLatestOrderDetails.breakdown?.inAmount,
                inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
                outAmount: getLatestOrderDetails.breakdown?.outAmount,
                outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
                status: getLatestOrderDetails.status,
                exchangeName: getLatestOrderDetails.exchangeName,
                blockchainName: getLatestOrderDetails.blockchainName,
                completedAt:
                  getLatestOrderDetails.orderCompletedOn || new Date(),
                notes:
                  getLatestOrderDetails.notes ||
                  getLatestOrderDetails.comments ||
                  "",
              });
              await new SendEmail().sendAccountsOrderCompleted({
                userEmail: getLatestOrderDetails.user?.email || "",
                orderId: getLatestOrderDetails.orderId,
                orderType: getLatestOrderDetails.orderType,
                paymentType: String(getLatestOrderDetails.paymentType || ""),
                inAmount: getLatestOrderDetails.breakdown?.inAmount,
                inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
                outAmount: getLatestOrderDetails.breakdown?.outAmount,
                outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
                status: getLatestOrderDetails.status,
                exchangeName: getLatestOrderDetails.exchangeName,
                blockchainName: getLatestOrderDetails.blockchainName,
                completedAt:
                  getLatestOrderDetails.orderCompletedOn || new Date(),
                notes:
                  getLatestOrderDetails.notes ||
                  getLatestOrderDetails.comments ||
                  "",
              });

              const newTx = await txservice.create({
                email: getLatestOrderDetails.user.email,
                orderId: getLatestOrderDetails.orderId,
                extRef: "",
                txId: "",
                from: "",
                to: getLatestOrderDetails.user.email,
                amount: getLatestOrderDetails.breakdown.outAmount,
                exchangeName: "CEX",
                info: "Buy crypto by user",
                status: OrderStatus.Completed,
                currencyRef: getLatestOrderDetails.breakdown.outCurrencyName,
                walletType: "ASSET_WALLET",
                transactionType: "BUY",
                txDate: new Date(),
                benificaryAddress: "",
              });

              const quantumOrderIndicator = String(
                getLatestOrderDetails?.comments || ""
              )
                .toLowerCase()
                .includes("quantum");
              const quantumCurrency = String(
                getLatestOrderDetails?.breakdown?.outCurrencyName || ""
              )
                .toUpperCase()
                .includes("BTCY");
              const isQuantumOrder = quantumOrderIndicator || quantumCurrency;
              const paymentType = getLatestOrderDetails?.paymentType;
              const isUsdOrPaypalPayment =
                paymentType === PaymentTypes.Paypal ||
                paymentType === PaymentTypes.USD;

              if (isQuantumOrder && isUsdOrPaypalPayment) {
                try {
                  const orderEmail = String(
                    getLatestOrderDetails?.user?.email || ""
                  ).toLowerCase();
                  if (orderEmail) {
                    ChatSocketService.emitToUser(
                      orderEmail,
                      "order:confirmed",
                      {
                        orderId: getLatestOrderDetails.orderId,
                        status: OrderStatus.Completed,
                        amount:
                          getLatestOrderDetails.breakdown?.outAmount ?? null,
                        currency:
                          getLatestOrderDetails.breakdown?.outCurrencyName ??
                          null,
                        paymentType: paymentType,
                        orderType: "Quantum",
                      }
                    );
                    ChatSocketService.emitToUser(orderEmail, "orders:update", {
                      orderId: getLatestOrderDetails.orderId,
                      status: OrderStatus.Completed,
                    });
                  }
                } catch (socketErr) {
                  console.error(
                    "[paypalWebhook] quantum order socket emit failed:",
                    socketErr
                  );
                }
              }
            }

            // update the tygapay status on order
            let updateTygaPayStatus = await orderService.updatePart(
              {
                orderId: userOrder.orderId,
              },
              {
                merchantStatus: "sucess",
              }
            );
            let userReferralCode = user.referralCodeUsed;

            if (userReferralCode) {
              try {
                let referredUser = await uservice.findOne({
                  referralCode: userReferralCode,
                });

                if (referredUser) {
                  let getUserReferralData =
                    await referralEarningService.findOne({
                      referrerEmail: referredUser.email,
                    });

                  if (getUserReferralData) {
                    let existingOrders = getUserReferralData.orders || [];
                    let commissionValue =
                      getLatestOrderDetails.breakdown.inAmount; // USD value
                    let latestBaseRate = await currencyService.findOne({
                      code: "INEX",
                    });

                    if (latestBaseRate && latestBaseRate.buyPrice) {
                      // 5% on Indexx tokens. 1% on 3rd party tokens.

                      let finalCommission =
                        (commissionValue / latestBaseRate.buyPrice) *
                        (getLatestOrderDetails.breakdown.outCurrencyName ===
                          "INEX" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "IN500" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "IUSD+" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "INXC" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "WIBS" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "DaCrazy" ||
                          getLatestOrderDetails.breakdown.outCurrencyName ===
                          "daCrazy"
                          ? 5 / 100
                          : 1 / 100);

                      let addNewOrder = {
                        email: user.email,
                        amount: getLatestOrderDetails.breakdown.outAmount,
                        currency:
                          getLatestOrderDetails.breakdown.outCurrencyName,
                        type: getLatestOrderDetails.orderType,
                        date: new Date(),
                        commissionValue: finalCommission,
                      };

                      existingOrders.push(addNewOrder);

                      // Add the referral commission
                      let updateCommissionData =
                        await referralEarningService.updatePart(
                          {
                            referrerEmail: referredUser.email,
                          },
                          {
                            $set: {
                              commissionCurrency: "INEX",
                              commissionPercentage: 5,
                              orders: existingOrders,
                              totalEarned:
                                (getUserReferralData.totalEarned || 0) +
                                finalCommission,
                            },
                          }
                        );

                      if (updateCommissionData) {
                        console.log(
                          "Referral commission updated successfully."
                        );
                      } else {
                        console.error("Failed to update referral commission.");
                      }
                    } else {
                      console.error("Invalid base rate data.");
                    }
                  } else {
                    console.error("Referral data not found for the referrer.");
                  }
                } else {
                  console.error("Referred user not found.");
                }
              } catch (error) {
                console.error("Error processing referral commission:", error);
              }
            }

            return { status: 200, data: process };
          } else {
            console.log("i am here in else", userOrder);
            return { status: 200, data: "Order not approved" };
          }
        } else if (shopOrder) {
          console.log("Processing shop order", shopOrder);
          if (
            shopOrder.order_status === "order-pending" &&
            shopOrder.payment_status === "payment-pending"
          ) {
            const updateOrder = await shopOrdersService.updatePart(
              {
                tracking_number: shopOrder.tracking_number,
              },
              {
                $set: {
                  order_status: "order-completed",
                  payment_status: "payment-success",
                },
              }
            );
            let defaultCurrency = "USD";
            const usdRate = await getPriceByName(defaultCurrency);
            for (let i = 0; i < shopOrder.products.length; i++) {
              // Get the product's order quantity and unit price
              let product = shopOrder.products[i];
              let productQuantity = Number(product.order_quantity); // Convert order quantity to integer
              let unitPrice = Number(product.unit_price); // Convert unit price to a number

              // Loop through the product quantity and create a gift card for each unit
              for (let j = 0; j < productQuantity; j++) {
                let createGiftCardForUser = await createGiftCard(
                  product.slug,
                  shopOrder.customer_contact,
                  unitPrice
                );

                await new SendEmail().sendSelfGiftCardNotification(
                  product.receiver_email
                    ? product.receiver_email
                    : shopOrder.customer_contact,
                  product.name,
                  createGiftCardForUser.currencies,
                  unitPrice,
                  createGiftCardForUser.voucher,
                  product.image,
                  unitPrice,
                  product.personal_message
                );
              }
            }
          }
          return {
            status: 200,
            data: shopOrder,
          };
        } else {
          return { status: 200, data: "Order not found" };
        }
      } else {
        console.log("i am here in else");
        return { status: 200, data: "Order not approved" };
      }
    } catch (err) {
      console.log("i am here in else", err);
      return { status: 500, data: err };
    }
  }

  async stripeWebhook0(req: any, res: any) {
    try {
      if (req.body?.resource?.status === "APPROVED") {
        let paypalOrder = await paypalService.findOne({
          paypalId: req.body.resource.id,
        });
        const orderId = req.body.resource.id;
        const captureResult = await capturePayment(orderId);
        console.log("Payment captured successfully:", captureResult);
        //update paypal table
        await paypalService.updatePart(
          {
            paypalId: req.body.resource.id,
          },
          {
            $set: {
              status: req.body.resource.status,
              payerEmail: req.body.resource?.payer?.email_address,
              payerName: req.body.resource?.payer?.name?.given_name,
              payerLastName: req.body.resource?.payer?.name?.surname,
              payerId: req.body.resource?.payer?.payer_id,
            },
          }
        );
        let link = paypalOrder.links.find(
          (x) => x.rel === "self" && x.method === "GET"
        );
        return { status: 200, data: "Order Captured" };
      } else if (req.body?.resource?.status === "COMPLETED") {
        console.log(req.body.resource.status);
        console.log(req.body.resource.supplementary_data);
        console.log(req.body.resource.supplementary_data.related_ids);
        console.log(req.body.resource.supplementary_data.related_ids.order_id);
        let paypalOrder = await paypalService.findOne({
          paypalId: req.body.resource.supplementary_data.related_ids.order_id,
        });

        let userOrder = await orderService.findOne({
          orderId: paypalOrder.orderId,
        });

        let powerPackOrder = await powerpackService.findOne({
          orderId: paypalOrder.orderId,
        });

        if (userOrder && powerPackOrder) {
          console.log("Processing powerpack order");
          //update paypal table
          await paypalService.updatePart(
            {
              paypalId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource.status,
                //payerEmail: req.body.resource?.payer?.email_address,
                payerName: req.body.resource?.payer?.name?.given_name,
                payerLastName: req.body.resource?.payer?.name?.surname,
                payerId: req.body.resource?.payer?.payer_id,
              },
            }
          );

          const userOps = new UserOperations(req, res);
          let process = await userOps.updatePowerPackData(
            req,
            res,
            paypalOrder.orderId
          );
          return { status: 200, data: process };
        } else if (userOrder) {
          console.log("Processing normal order");

          //update paypal table
          await paypalService.updatePart(
            {
              paypalId:
                req.body.resource.supplementary_data.related_ids.order_id,
            },
            {
              $set: {
                status: req.body.resource.status,
                //payerEmail: req.body.resource?.payer?.email_address,
                payerName: req.body.resource?.payer?.name?.given_name,
                payerLastName: req.body.resource?.payer?.name?.surname,
                payerId: req.body.resource?.payer?.payer_id,
              },
            }
          );
          let user = await uservice.findOneSelect(
            {
              email: userOrder.user.email,
            },
            {}
          );
          if (user && user.role == UserRoleTypes.Admin) {
            return { status: 500, data: "Admin cannot place order" };
          } else {
            if (
              userOrder.status === "Quoted" &&
              userOrder.exchangeName === "Centralized"
            ) {
              let process = await orderService.processOrder(userOrder);
              let getLatestOrderDetails = await orderService.findOne({
                orderId: userOrder.orderId,
                "user.email": userOrder.user.email,
              });
              await checkAndUpdateFirstTimeTranactionPoints(
                getLatestOrderDetails
              );
              let resRewards = await addRewards(
                userOrder.user.email,
                userOrder.orderId
              );
              console.log(resRewards);
              //update paypal table
              let updatePaypal = await paypalService.updatePart(
                {
                  paypalId:
                    req.body.resource.supplementary_data.related_ids.order_id,
                },
                {
                  $set: {
                    status: req.body.resource.status,
                    //payerEmail: req.body.resource?.payer?.email_address,
                    payerName: req.body.resource?.payer?.name?.given_name,
                    payerLastName: req.body.resource?.payer?.name?.surname,
                    payerId: req.body.resource?.payer?.payer_id,
                  },
                }
              );

              // send email to user after completion
              await new SendEmail().sendOrderCompleted(
                userOrder.user.email,
                "User",
                getLatestOrderDetails.breakdown.outAmount,
                getLatestOrderDetails.breakdown.outCurrencyName,
                getLatestOrderDetails.orderType,
                getLatestOrderDetails.orderRate.rate,
                getLatestOrderDetails.breakdown.inAmount -
                (getLatestOrderDetails.breakdown.inAmount *
                  Number(getLatestOrderDetails?.exchangeFees)) /
                100,
                "",
                getLatestOrderDetails.orderId
              );

              const newTx = await txservice.create({
                email: getLatestOrderDetails.user.email,
                orderId: getLatestOrderDetails.orderId,
                extRef: "",
                txId: "",
                from: "",
                to: getLatestOrderDetails.user.email,
                amount: getLatestOrderDetails.breakdown.outAmount,
                exchangeName: "CEX",
                info: "Buy crypto by user",
                status: OrderStatus.Completed,
                currencyRef: getLatestOrderDetails.breakdown.outCurrencyName,
                walletType: "ASSET_WALLET",
                transactionType: "BUY",
                txDate: new Date(),
                benificaryAddress: "",
              });

              //console.log(resRewards);

              let userReferralCode = user.referralCodeUsed;

              if (userReferralCode) {
                try {
                  let referredUser = await uservice.findOne({
                    referralCode: userReferralCode,
                  });

                  if (referredUser) {
                    let getUserReferralData =
                      await referralEarningService.findOne({
                        referrerEmail: referredUser.email,
                      });

                    if (getUserReferralData) {
                      let existingOrders = getUserReferralData.orders || [];
                      let commissionValue =
                        getLatestOrderDetails.breakdown.inAmount; // USD value
                      let latestBaseRate = await currencyService.findOne({
                        code: "INEX",
                      });

                      if (latestBaseRate && latestBaseRate.buyPrice) {
                        let finalCommission =
                          (commissionValue / latestBaseRate.buyPrice) *
                          (getUserReferralData.commissionPercentage / 100);

                        let addNewOrder = {
                          email: user.email,
                          amount: getLatestOrderDetails.breakdown.outAmount,
                          currency:
                            getLatestOrderDetails.breakdown.outCurrencyName,
                          type: getLatestOrderDetails.orderType,
                          date: new Date(),
                          commissionValue: finalCommission,
                        };

                        existingOrders.push(addNewOrder);

                        // Add the referral commission
                        let updateCommissionData =
                          await referralEarningService.updatePart(
                            {
                              referrerEmail: referredUser.email,
                            },
                            {
                              $set: {
                                commissionCurrency: "INEX",
                                commissionPercentage: 5,
                                orders: existingOrders,
                                totalEarned:
                                  (getUserReferralData.totalEarned || 0) +
                                  finalCommission,
                              },
                            }
                          );

                        if (updateCommissionData) {
                          console.log(
                            "Referral commission updated successfully."
                          );
                        } else {
                          console.error(
                            "Failed to update referral commission."
                          );
                        }
                      } else {
                        console.error("Invalid base rate data.");
                      }
                    } else {
                      console.error(
                        "Referral data not found for the referrer."
                      );
                    }
                  } else {
                    console.error("Referred user not found.");
                  }
                } catch (error) {
                  console.error("Error processing referral commission:", error);
                }
              }

              return { status: 200, data: process };
            } else if (
              userOrder.status === "Quoted" &&
              userOrder.exchangeName === "Decentralized"
            ) {
              let orderDetails = await this.getDEXOrderDetailsByOrderId(
                userOrder.orderId
              );
              const txOps = new TxOperations(req, res);
              let dataResults = await txOps.processDEXBuyOrderByPaypal(
                orderDetails
              );
              return { status: 200, data: dataResults };
            }
            return { status: 200, data: userOrder };
          }
        } else {
          return { status: 500, data: "Order not found" };
        }
      } else if (req.body?.resource_type === "subscription") {
        let paypalSubscriptionData = await paypalSubscriptionService.findOne({
          subscriptionId: req.body.resource.id,
        });

        if (req.body.resource.status === "ACTIVE" && paypalSubscriptionData) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );

          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );

          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });

          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "CANCELLED" &&
          paypalSubscriptionData
        ) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource?.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "COMPLETED" &&
          paypalSubscriptionData
        ) {
          let newTxArray = paypalSubscriptionData.transactionArray;
          newTxArray.push(req.body.resource);
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                update_time: req.body.resource?.update_time,
                transactionArray: newTxArray,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          //let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );
          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );

          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        return { status: 200, data: {} };
      } else if (req.body?.resource_type === "sale") {
        let paypalSubscriptionData = await paypalSubscriptionService.findOne({
          subscriptionId: req.body.resource.billing_agreement_id,
        });

        if (
          (req.body.resource.status === "COMPLETED" ||
            req.body.resource.status === "completed") &&
          paypalSubscriptionData
        ) {
          let newTxArray = paypalSubscriptionData.transactionArray;
          newTxArray.push(req.body.resource);
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                update_time: req.body.resource?.update_time,
                transactionArray: newTxArray,
              },
            }
          );

          let latestBaseRate = await currencyService.findOne({
            code: "INEX",
          });

          let InexToSent =
            Number(paypalSubscriptionData.orderAmount) /
            latestBaseRate.buyPrice;

          let orderBreakdown = {
            inCurrenyName: "USD",
            inAmount: 300,
            outCurrencyName: "INEX",
            outAmount: InexToSent,
          } as OrderBreakdown;
          let userLite = {
            userId: "",
            email: paypalSubscriptionData.payerEmail,
            firstName: "",
            lastName: "",
            isVerified: true,
            language: "US",
          } as UserLite;
          let transactionAccount = {} as TransactionAccount;

          const currencyRes = await currencyService.findOne({
            currencyType: "Crypto",
            code: "INEX",
          });

          let getRate = {
            currency: currencyRes.code,
            rate: currencyRes.buyPrice,
          } as Rates;

          let orderId = Math.floor(10000000 + Math.random() * 90000000);

          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.Completed,
            orderType: OrderType.Subscription,
            orderRate: {} as Rates,
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.Paypal,
            breakdown: orderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            discountCode: "",
            captainBeeEmail: "",
            discountPercentage: 0, // Using optional chaining with nullish coalescing
          } as Order;

          //let order = await orderService.create(newOrder);
          let getUser = await uservice.findOne({
            email: paypalSubscriptionData.payerEmail,
          });
          let userAddress = getUser.userWallets.find(
            (x) => x.coinSymbol == "INEX"
          );

          console.log("INEX to be sent", InexToSent);
          // Update the user balance
          let updateUserWallet = await uservice.updatePart(
            {
              email: getUser.email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  Number(userAddress?.coinBalance) + Number(InexToSent),
              },
            }
          );
          const userOps = new UserOperations(req, res);
          let process = await userOps.updateSubscriptionOrder(
            req,
            res,
            orderId.toString()
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        if (
          req.body.resource.status === "CANCELLED" &&
          paypalSubscriptionData
        ) {
          //update paypalsubscription table
          await paypalSubscriptionService.updatePart(
            {
              subscriptionId: req.body.resource.id,
            },
            {
              $set: {
                status: req.body.resource?.status,
                links: req.body.resource?.links,
                subscriber: req.body.resource?.subscriber,
                plan_id: req.body.resource?.plan_id,
                quantity: req.body.resource?.quantity,
                status_update_time: req.body.resource?.status_update_time,
                start_time: req.body.resource?.start_time,
                billing_info: req.body.resource?.billing_info,
                create_time: req.body.resource?.create_time,
                update_time: req.body.resource?.update_time,
                plan_overridden: req.body.resource?.plan_overridden,
              },
            }
          );
          let paypalSubscriptionDataAfterUpdate =
            await paypalSubscriptionService.findOne({
              subscriptionId: req.body.resource.id,
            });
          return {
            status: 200,
            data: {
              message: `Successfully updated PayPal Subscription`,
              subscription: paypalSubscriptionDataAfterUpdate,
            },
          };
        }
        return { status: 200, data: {} };
      } else if (req.body?.status === "success") {
        /// for tygapay
        console.log("Processing normal order from tygapay");
        let userOrder = await orderService.findOne({
          orderId: req.body.orderNumber,
        });

        let user = await uservice.findOneSelect(
          {
            email: userOrder.user.email,
          },
          {}
        );
        if (user && user.role == UserRoleTypes.Admin) {
          return { status: 500, data: "Admin cannot place order" };
        } else {
          if (
            userOrder.status === "Quoted" &&
            userOrder.exchangeName === "Centralized"
          ) {
            let process = await orderService.processOrder(userOrder);
            let getLatestOrderDetails = await orderService.findOne({
              orderId: userOrder.orderId,
              "user.email": userOrder.user.email,
            });
            await checkAndUpdateFirstTimeTranactionPoints(
              getLatestOrderDetails
            );
            let resRewards = await addRewards(
              userOrder.user.email,
              userOrder.orderId
            );
            console.log(resRewards);
            // send email to user after completion
            await new SendEmail().sendOrderCompleted(
              userOrder.user.email,
              "User",
              getLatestOrderDetails.breakdown.outAmount,
              getLatestOrderDetails.breakdown.outCurrencyName,
              getLatestOrderDetails.orderType,
              getLatestOrderDetails.orderRate.rate,
              getLatestOrderDetails.breakdown.inAmount -
              (getLatestOrderDetails.breakdown.inAmount *
                Number(getLatestOrderDetails?.exchangeFees)) /
              100,
              "",
              getLatestOrderDetails.orderId
            );

            const newTx = await txservice.create({
              email: getLatestOrderDetails.user.email,
              orderId: getLatestOrderDetails.orderId,
              extRef: "",
              txId: "",
              from: "",
              to: getLatestOrderDetails.user.email,
              amount: getLatestOrderDetails.breakdown.outAmount,
              exchangeName: "CEX",
              info: "Buy crypto by user",
              status: OrderStatus.Completed,
              currencyRef: getLatestOrderDetails.breakdown.outCurrencyName,
              walletType: "ASSET_WALLET",
              transactionType: "BUY",
              txDate: new Date(),
              benificaryAddress: "",
            });

            // update the tygapay status on order
            let updateTygaPayStatus = await orderService.updatePart(
              {
                orderId: userOrder.orderId,
              },
              {
                merchantStatus: "sucess",
              }
            );
            let userReferralCode = user.referralCodeUsed;

            if (userReferralCode) {
              try {
                let referredUser = await uservice.findOne({
                  referralCode: userReferralCode,
                });

                if (referredUser) {
                  let getUserReferralData =
                    await referralEarningService.findOne({
                      referrerEmail: referredUser.email,
                    });

                  if (getUserReferralData) {
                    let existingOrders = getUserReferralData.orders || [];
                    let commissionValue =
                      getLatestOrderDetails.breakdown.inAmount; // USD value
                    let latestBaseRate = await currencyService.findOne({
                      code: "INEX",
                    });

                    if (latestBaseRate && latestBaseRate.buyPrice) {
                      let finalCommission =
                        (commissionValue / latestBaseRate.buyPrice) *
                        (getUserReferralData.commissionPercentage / 100);

                      let addNewOrder = {
                        email: user.email,
                        amount: getLatestOrderDetails.breakdown.outAmount,
                        currency:
                          getLatestOrderDetails.breakdown.outCurrencyName,
                        type: getLatestOrderDetails.orderType,
                        date: new Date(),
                        commissionValue: finalCommission,
                      };

                      existingOrders.push(addNewOrder);

                      // Add the referral commission
                      let updateCommissionData =
                        await referralEarningService.updatePart(
                          {
                            referrerEmail: referredUser.email,
                          },
                          {
                            $set: {
                              commissionCurrency: "INEX",
                              commissionPercentage: 5,
                              orders: existingOrders,
                              totalEarned:
                                (getUserReferralData.totalEarned || 0) +
                                finalCommission,
                            },
                          }
                        );

                      if (updateCommissionData) {
                        console.log(
                          "Referral commission updated successfully."
                        );
                      } else {
                        console.error("Failed to update referral commission.");
                      }
                    } else {
                      console.error("Invalid base rate data.");
                    }
                  } else {
                    console.error("Referral data not found for the referrer.");
                  }
                } else {
                  console.error("Referred user not found.");
                }
              } catch (error) {
                console.error("Error processing referral commission:", error);
              }
            }

            return { status: 200, data: process };
          } else {
            console.log("i am here in else", userOrder);
            return { status: 200, data: "Order not approved" };
          }
        }
      } else {
        console.log("i am here in else");
        return { status: 200, data: "Order not approved" };
      }
    } catch (err) {
      console.log("i am here in else", err);
      return { status: 500, data: err };
    }
  }

  async stripeWebhook(req: any, res: any) {
    try {
      const event = req.body;

      // Handle the event
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          console.log("paymentIntent", paymentIntent);
          const getShopOrder = await shopOrdersService.findOne({
            "payment_intent.payment_intent_info.payment_id": paymentIntent.id,
          });
          console.log("getShopOrder", getShopOrder);
          console.log(
            String(getShopOrder.payment_status) === "payment-pending"
          );
          if (
            getShopOrder &&
            String(getShopOrder.payment_status) === "payment-pending"
          ) {
            console.log("order Found", getShopOrder);
            const processOrder = await this.updateOrder(
              getShopOrder.tracking_number
            );
            return { status: processOrder.status, data: processOrder.data };
          } else {
            console.log("Order not found");
            return { status: 500, data: "Order not found" };
          }
          break;
        case "payment_method.attached":
          const paymentMethod = event.data.object;
          console.log("paymentIntent", paymentIntent);

          // Then define and call a method to handle the successful attachment of a PaymentMethod.
          // handlePaymentMethodAttached(paymentMethod);
          break;
        // ... handle other event types
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      return { status: 200, data: "Order not approved" };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateOrder(tracking_number: any) {
    try {
      // Find the order by tracking_number and update it with the new data
      const getOrder = await shopOrdersService.findOne({ tracking_number });
      if (getOrder) {
        const updateOrder = await shopOrdersService.updatePart(
          {
            tracking_number,
          },
          {
            $set: {
              order_status: "order-completed",
              payment_status: "payment-success",
            },
          }
        );
        for (let i = 0; i < getOrder.products.length; i++) {
          // Get the product's order quantity and unit price
          let product = getOrder.products[i];
          let productQuantity = Number(product.order_quantity); // Convert order quantity to integer
          let unitPrice = Number(product.unit_price); // Convert unit price to a number

          let user = await uservice.findOne({
            email: getOrder.customer_contact,
          });

          // Loop through the product quantity and create a gift card for each unit
          for (let j = 0; j < productQuantity; j++) {
            let createGiftCardForUser = await createGiftCard(
              product.slug,
              getOrder.customer_contact,
              unitPrice
            );

            let userReferralCode = user.referralCodeUsed;

            if (userReferralCode) {
              try {
                let referredUser = await uservice.findOne({
                  referralCode: userReferralCode,
                });

                if (referredUser) {
                  let getUserReferralData =
                    await referralEarningService.findOne({
                      referrerEmail: referredUser.email,
                    });

                  if (getUserReferralData) {
                    let existingOrders = getUserReferralData.orders || [];
                    let commissionValue = unitPrice; // USD value
                    let latestBaseRate = await currencyService.findOne({
                      code: "INEX",
                    });

                    if (latestBaseRate && latestBaseRate.buyPrice) {
                      let finalCommission =
                        (commissionValue / latestBaseRate.buyPrice) * (1 / 100);

                      let addNewOrder = {
                        email: user.email,
                        amount: unitPrice,
                        currency: product.name,
                        type: "Shop Purchase",
                        date: new Date(),
                        commissionValue: finalCommission,
                      };

                      existingOrders.push(addNewOrder);

                      // Add the referral commission
                      let updateCommissionData =
                        await referralEarningService.updatePart(
                          {
                            referrerEmail: referredUser.email,
                          },
                          {
                            $set: {
                              commissionCurrency: "INEX",
                              commissionPercentage: 5,
                              orders: existingOrders,
                              totalEarned:
                                (getUserReferralData.totalEarned || 0) +
                                finalCommission,
                            },
                          }
                        );

                      if (updateCommissionData) {
                        console.log(
                          "Referral commission updated successfully."
                        );
                      } else {
                        console.error("Failed to update referral commission.");
                      }
                    } else {
                      console.error("Invalid base rate data.");
                    }
                  } else {
                    console.error("Referral data not found for the referrer.");
                  }
                } else {
                  console.error("Referred user not found.");
                }
              } catch (error) {
                console.error("Error processing referral commission:", error);
              }
            }

            await new SendEmail().sendSelfGiftCardNotification(
              product.receiver_email
                ? product.receiver_email
                : getOrder.customer_contact,
              product.name,
              createGiftCardForUser.currencies,
              unitPrice,
              createGiftCardForUser.voucher,
              product.image,
              unitPrice,
              product.personal_message
            );
          }
        }

        //check if user is first user on shop order
        const gerOrderByEmail = await shopOrdersService.find({
          customer_contact: getOrder.customer_contact,
          order_status: "order-completed",
          payment_status: "payment-success",
        });
        console.log("gerOrderByEmail", gerOrderByEmail);
        console.log("gerOrderByEmail length", gerOrderByEmail.length);
        // Sending a free gift card if the customer has no prior orders this is first order
        if (gerOrderByEmail.length === 1) {
          let createFreeGiftCardForUser = await createFreeGiftCard(
            "gift-card-50",
            getOrder.customer_contact,
            50
          );
          await new SendEmail().sendSelfFreeGiftCardNotification(
            getOrder.customer_contact,
            "Gift Card $50",
            createFreeGiftCardForUser.currencies,
            50,
            createFreeGiftCardForUser.voucher,
            "",
            50
          );
        }
        return {
          status: 200,
          data: getOrder,
        };
      } else {
        return {
          status: 404,
          data: {
            message: "Order not found",
          },
        };
      }
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while updating the order",
          error: err.message,
        },
      };
    }
  }

  async processConvertOrder(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (user && user.role == UserRoleTypes.Admin) {
        return { status: 500, data: "Admin cannot place order" };
      } else if (user.isKYCPass && user.kycStatus !== "Completed") {
        return {
          status: 500,
          data: "User not allowed to place order. Please complete KYC first",
        };
      } else {
        // ✅ ADD CHECK HERE TO RESTRICT INDEXX TOKEN CONVERSIONS
        const indexxTokens = [
          "IN500",
          "IUSD+",
          "INXC",
          "WIBS",
          "DaCrazy",
          "INEX",
          "daCrazy",
        ];
        const basecoin = req.body.basecoin;
        const quotecoin = req.body.quotecoin;
        const userEmail = String(req.body.email).toLowerCase();
        const allowedIndexxTokenConversionEmails = new Set([
          "chrishumpherys@yahoo.com",
          "fatham.llc@gmail.com",
          "muhdbalaweenty712@gmail.com",
          "ekopastikaya95@gmail.com",
          "rongkomodo1990@gmail.com",
          "simonazzahraeva1@gmail.com",
          "gulraiz726@gmail.com",
          "usmanwunti2020@gmail.com",
          "alwinwise4@gmail.com",
          "sujektogayam@gmail.com",
          "gbevougatto@gmail.com",
          "omkar@azooca.com",
          "sunkuomkarsai@gmail",
          "sunkuomkarsai@gmail.com",
          "sunkuomkarsai5@gmail.com",
          "sunkuomkarsai12121@gmail.com",
          "issaumer125@gmail.com",
        ]);

        if (basecoin === "WIBS" || quotecoin === "WIBS") {
          return {
            status: 500,
            data: "Conversion involving WIBS is not permitted.",
          };
        }

        if (
          indexxTokens.includes(basecoin) &&
          !indexxTokens.includes(quotecoin) &&
          !allowedIndexxTokenConversionEmails.has(userEmail)
        ) {
          return {
            status: 500,
            data: "Feature of Converting Indexx tokens is restricted.",
          };
        }

        //get order details
        let userOrder = await orderService.findOne({
          orderId: req.body.orderId,
          "user.email": String(req.body.email).toLowerCase(),
        });
        if (userOrder) {
          let convertAmount = userOrder.breakdown.inAmount;
          let convertCurrency = userOrder.breakdown.inCurrenyName;
          let convertToCurrency = userOrder.breakdown.outCurrencyName;

          if (convertCurrency === "WIBS" || convertToCurrency === "WIBS") {
            return {
              status: 500,
              data: "Conversion involving WIBS is not permitted.",
            };
          }

          if (
            convertCurrency.localeCompare("BTC") == 0 ||
            convertCurrency.localeCompare("ETH") == 0 ||
            convertCurrency.localeCompare("LTC") == 0 ||
            convertCurrency.localeCompare("XRP") == 0 ||
            convertCurrency.localeCompare("TUSD") == 0 ||
            convertCurrency.localeCompare("LEO") == 0 ||
            convertCurrency.localeCompare("DOGE") == 0 ||
            convertCurrency.localeCompare("USDC") == 0 ||
            convertCurrency.localeCompare("USDT") == 0 ||
            convertCurrency.localeCompare("MATIC") == 0 ||
            convertCurrency.localeCompare("DOT") == 0 ||
            convertCurrency.localeCompare("BCH") == 0 ||
            convertCurrency.localeCompare("SHIB") == 0 ||
            convertCurrency.localeCompare("TON") == 0 ||
            convertCurrency.localeCompare("DAI") == 0 ||
            convertCurrency.localeCompare("LINK") == 0 ||
            convertCurrency.localeCompare("BNB") == 0 ||
            convertCurrency.localeCompare("BUSD") == 0 ||
            convertCurrency.localeCompare("CHZ") == 0 ||
            convertCurrency.localeCompare("VET") == 0 ||
            convertCurrency.localeCompare("BTCY") == 0 ||
            convertCurrency.localeCompare("AVAX") == 0 ||
            convertCurrency.localeCompare("THETA") == 0 ||
            convertCurrency.localeCompare("NOT") == 0 ||
            convertCurrency.localeCompare("FTM") == 0 ||
            convertCurrency.localeCompare("RUNE") == 0 ||
            convertCurrency.localeCompare("NEAR") == 0 ||
            convertCurrency.localeCompare("AAVE") == 0 ||
            convertCurrency.localeCompare("INJ") == 0 ||
            convertCurrency.localeCompare("PYTH") == 0 ||
            convertCurrency.localeCompare("BEAM") == 0 ||
            convertCurrency.localeCompare("ADA") == 0 ||
            convertCurrency.localeCompare("XLM") == 0 ||
            convertCurrency.localeCompare("SUI") == 0 ||
            convertCurrency.localeCompare("MANA") == 0 ||
            convertCurrency.localeCompare("AMZN") == 0 ||
            convertCurrency.localeCompare("APPL") == 0 ||
            convertCurrency.localeCompare("GOOGL") == 0 ||
            convertCurrency.localeCompare("MSFT") == 0 ||
            convertCurrency.localeCompare("META") == 0 ||
            convertCurrency.localeCompare("NVDA") == 0 ||
            convertCurrency.localeCompare("PEP") == 0 ||
            convertCurrency.localeCompare("BCM") == 0 ||
            convertCurrency.localeCompare("SNP500") == 0 ||
            convertCurrency.localeCompare("TLSA") == 0 ||
            convertCurrency.localeCompare("TLSA") == 0
          ) {
            let latestBaseRate = await getPriceByName(convertCurrency);
            console.log(latestBaseRate, "a");
            console.log(convertAmount, "amt");

            let outCurrenRate = await this.getCurrencyPriceByName(
              convertToCurrency
            );
            console.log(latestBaseRate, "r1");
            console.log(outCurrenRate, "r2");

            let finalRate = latestBaseRate.data / outCurrenRate;
            console.log(finalRate, "r3");

            let totalInUSDAmount = convertAmount * outCurrenRate * finalRate;
            let totalPayout = finalRate * convertAmount;
            //Reduce our fees
            let afterOurFees =
              totalPayout -
              totalPayout * (Number(userOrder?.exchangeFees) / 100);
            let totalOutAmount = afterOurFees;
            // let afterOurFees = totalInUSDAmount - ((totalInUSDAmount) * (Number(userOrder.exchangeFees) /100));
            // let totalOutAmount = afterOurFees / latestConvertCurRate.data;
            //update order
            let order = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  "breakdown.outAmount": totalOutAmount,
                  "orderRate.rate": outCurrenRate,
                  "orderRate.currency": convertToCurrency,
                  status: "Completed",
                  orderCompletedOn: new Date(),
                },
              }
            );
            if (order?.isCaptainPerformingOrder) {
              await this.UpdateDBForCaptainOrder(
                order.user.email,
                order.captainBeeEmail,
                order
              );
            }
            console.log("inamount", convertAmount);
            console.log(
              "outmount final",
              totalOutAmount,
              "in usd",
              totalInUSDAmount,
              "final payout without fee",
              totalPayout
            );

            //update order
            // let updateOrder = await orderService.updatePart(
            //   {
            //     orderId: req.body.orderId,
            //   },
            //   {
            //     $set: {
            //       "breakdown.outAmount": totalOutAmount,
            //       "orderRate.rate": outCurrenRate,
            //       "orderRate.currency": convertToCurrency,
            //       status: "Completed",
            //       orderCompletedOn: new Date(),
            //     },
            //   }
            // );

            const isBTCYIn = convertCurrency === "BTCY";
            const isBTCYOut = convertToCurrency === "BTCY";
            const BTCY_NETWORK = "Ying Yang Chain";

            if (
              await orderService.checkAndCreateUserWallet(
                user.email,
                convertToCurrency,
                undefined,
                isBTCYOut ? BTCY_NETWORK : undefined
              )
            ) {
              console.log("inside sell updateUser1");
              // update 1 for user increment fiat value
              if (isBTCYOut) {
                const creditResult: any = await uservice.updatePartWithOptions(
                  { email: user.email },
                  {
                    $inc: { "userWallets.$[w].coinBalance": totalOutAmount },
                    $set: { coinLastUsedOn: new Date() },
                  },
                  {
                    arrayFilters: [
                      {
                        "w.coinSymbol": convertToCurrency,
                        "w.coinNetwork": BTCY_NETWORK,
                      },
                    ],
                  }
                );
                if (!creditResult?.matchedCount) {
                  return {
                    status: 400,
                    data: "BTCY conversions must use BTCY Tokens only.",
                  };
                }
              } else {
                await uservice.updatePart(
                  {
                    email: user.email,
                    "userWallets.coinSymbol": convertToCurrency,
                  },
                  {
                    $inc: {
                      "userWallets.$.coinBalance": totalOutAmount,
                    },
                    $set: {
                      coinLastUsedOn: new Date(),
                    },
                  }
                );
              }
            }

            const isBTCY = isBTCYIn;
            const effectiveNetwork = isBTCY ? BTCY_NETWORK : undefined;

            // Create wallet (only pass coinNetwork for BTCY)
            await orderService.checkAndCreateUserWallet(
              user.email,
              convertCurrency,
              undefined,
              effectiveNetwork
            );

            console.log("inside sell updateUser2");

            // Update wallet balance (robust for array)
            const arrayFilter: any = { "w.coinSymbol": convertCurrency };
            if (isBTCY) arrayFilter["w.coinNetwork"] = "Ying Yang Chain";

            const updateUser2: any = await uservice.updatePartWithOptions(
              { email: user.email },
              {
                $inc: { "userWallets.$[w].coinBalance": -1 * convertAmount },
                $set: { coinLastUsedOn: new Date() },
              },
              {
                arrayFilters: [arrayFilter],
              }
            );
            if (isBTCY && !updateUser2?.matchedCount) {
              return {
                status: 400,
                data: "BTCY conversions must use BTCY Tokens only.",
              };
            }

            //Disable Trade to earn for convert on 30-11-2022
            // let resRewards = await addRewards(
            //   String(req.body.email).toLowerCase(),
            //   req.body.orderId,
            //   totalInUSDAmount
            // );
            // console.log(resRewards);
            let getNewDetails = await orderService.findOne({
              orderId: req.body.orderId,
              "user.email": String(req.body.email).toLowerCase(),
            });
            // send email to user after completion
            await new SendEmail().sendConvertOrderCompleted(
              getNewDetails.user.email,
              "User",
              getNewDetails.breakdown.outAmount,
              getNewDetails.breakdown.outCurrencyName,
              getNewDetails.orderType,
              getNewDetails.orderRate.rate,
              getNewDetails.breakdown.inAmount,
              getNewDetails.orderId,
              getNewDetails.exchangeFees,
              getNewDetails.paymentType,
              getNewDetails.exchangeName,
              getNewDetails.blockchainName,
              getNewDetails.notes
            );
            return { status: 200, data: order };
          } else if (
            convertCurrency == "IN500" ||
            convertCurrency == "IUSD+" ||
            convertCurrency == "INXC" ||
            convertCurrency == "WIBS" ||
            convertCurrency == "DaCrazy" ||
            convertCurrency == "INEX"
          ) {
            console.log("indexx tkens to other");
            let inCurrenyRate = await this.getCurrencyPriceByName(
              convertCurrency
            );
            let outCurrenRate = await this.getCurrencyPriceByName(
              convertToCurrency
            );
            let finalRate = inCurrenyRate / outCurrenRate;
            let totalInUSDAmount = finalRate * convertAmount * outCurrenRate;
            let totalPayout = finalRate * convertAmount;
            let afterOurFees =
              totalPayout -
              totalPayout * (Number(userOrder.exchangeFees) / 100);
            let totalOutAmount = afterOurFees;
            console.log("afterourfee", afterOurFees);
            console.log("totalOutAmount", totalOutAmount);
            console.log("totalPayout", totalPayout);
            console.log("totalInUSDAmount", totalInUSDAmount);
            console.log("finalRate", finalRate);

            //update order
            let order = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  "breakdown.outAmount": totalOutAmount,
                  "orderRate.rate": outCurrenRate,
                  "orderRate.currency": convertToCurrency,
                  status: "Completed",
                  orderCompletedOn: new Date(),
                },
              }
            );
            let getOrder = await orderService.findOne({
              orderId: req.body.orderId,
            });
            if (getOrder?.isCaptainPerformingOrder) {
              console.log(
                "order?.isCaptainPerformingOrder",
                getOrder?.isCaptainPerformingOrder
              );
              this.UpdateDBForCaptainOrder(
                getOrder.user.email,
                getOrder.captainBeeEmail,
                getOrder
              );
            }
            if (
              await orderService.checkAndCreateUserWallet(
                user.email,
                convertToCurrency
              )
            ) {
              console.log("inside sell updateUser1");
              //update 1 for user increment fiat value
              let updateUser1 = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": convertToCurrency,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": totalOutAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
            }
            if (
              await orderService.checkAndCreateUserWallet(
                user.email,
                convertCurrency
              )
            ) {
              console.log("inside sell updateUser2");

              // update 2 for user decrement crypto value
              let updateUser2 = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": convertCurrency,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": -1 * convertAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
            }

            // if (await orderService.checkAndCreateUserWallet(user.email, userOrder.breakdown.outCurrencyName)) {

            //     let updateUserWallet = await uservice.updatePart(
            //         {
            //             email: String(req.body.email).toLowerCase(),
            //         },
            //         {
            //             $inc: {
            //                 [`userWallets.${convertToCurrency}`]: totalOutAmount,
            //                 [`userWallets.${convertCurrency}`]: convertAmount * -1,
            //             },
            //             $set: {
            //                 ["userWallets.coinLastUsedOn"]: new Date(),
            //             },
            //         }
            //     );

            //Disable Trade to earn for convert on 30-11-2022
            // let resRewards = await addRewards(
            //   String(req.body.email).toLowerCase(),
            //   req.body.orderId,
            //   totalInUSDAmount
            // );
            // console.log(resRewards);
            let getNewDetails = await orderService.findOne({
              orderId: req.body.orderId,
              "user.email": String(req.body.email).toLowerCase(),
            });
            // send email to user after completion
            await new SendEmail().sendConvertOrderCompleted(
              getNewDetails.user.email,
              "User",
              getNewDetails.breakdown.outAmount,
              getNewDetails.breakdown.outCurrencyName,
              getNewDetails.orderType,
              getNewDetails.orderRate.rate,
              getNewDetails.breakdown.inAmount,
              getNewDetails.orderId,
              getNewDetails.exchangeFees,
              getNewDetails.paymentType,
              getNewDetails.exchangeName,
              getNewDetails.blockchainName,
              getNewDetails.notes
            );
            return { status: 200, data: order };
          } else if (convertCurrency == "FTT_ETH" || convertCurrency == "FTT") {
            let inCurrenyRate = await this.getCurrencyPriceByName("FTT_ETH");
            let outCurrenRate = await this.getCurrencyPriceByName(
              convertToCurrency
            );
            let finalRate = inCurrenyRate / outCurrenRate;
            let totalInUSDAmount = finalRate * convertAmount * outCurrenRate;
            let totalPayout = finalRate * convertAmount;
            let afterOurFees =
              totalPayout -
              totalPayout * (Number(userOrder.exchangeFees) / 100);
            let totalOutAmount = afterOurFees;
            console.log("afterourfee", afterOurFees);
            console.log("totalOutAmount", totalOutAmount);
            console.log("totalPayout", totalPayout);
            console.log("totalInUSDAmount", totalInUSDAmount);
            console.log("finalRate", finalRate);

            //update order
            let order = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  "breakdown.outAmount": totalOutAmount,
                  "orderRate.rate": outCurrenRate,
                  "orderRate.currency": convertToCurrency,
                  status: "Completed",
                  orderCompletedOn: new Date(),
                },
              }
            );
            if (order?.isCaptainPerformingOrder) {
              this.UpdateDBForCaptainOrder(
                order.user.email,
                order.captainBeeEmail,
                order
              );
            }
            if (
              await orderService.checkAndCreateUserWallet(
                user.email,
                convertToCurrency
              )
            ) {
              console.log("inside sell updateUser1");
              //update 1 for user increment fiat value
              let updateUser1 = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": convertToCurrency,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": totalOutAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
            }
            if (
              await orderService.checkAndCreateUserWallet(
                user.email,
                convertCurrency
              )
            ) {
              console.log("inside sell updateUser2");

              // update 2 for user decrement crypto value
              let updateUser2 = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": convertCurrency,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": -1 * convertAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
            }

            //Disable Trade to earn for convert on 30-11-2022
            // let resRewards = await addRewards(
            //   String(req.body.email).toLowerCase(),
            //   req.body.orderId,
            //   totalInUSDAmount
            // );
            // console.log(resRewards);
            return { status: 200, data: order };
          }
          //   }
          else {
            return {
              status: 500,
              data: "User wallet not found. Failed to create convert order",
            };
          }
          //     } else {
          //         return {
          //             status: 500,
          //             data: "Currency not supported for convert",
          //         };
          //     }
        } else {
          return { status: 500, data: "No order Found to Convert" };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async switchSmartCryptoPlan(req: any, res: any) {
    try {
      // Extract the cryptocurrencies array from the request body
      let existingCryptoCurrencies = req.body.exitingCryptocurrencies;
      let cryptoCurrencies = existingCryptoCurrencies.rows;
      console.log("cryptoCurrencies", cryptoCurrencies);

      let sellOrderIds: any = [];
      for (let index = 0; index < cryptoCurrencies.length; index++) {
        const element = cryptoCurrencies[index];
        let newReq, newRes;
        newReq = {
          body: {
            orderType: "Sell",
            currencyIn: element.coin,
            currencyOut: "USD",
            email: String(req.body.email).toLowerCase(),
            amount: element.amount,
          },
        };
        let createSellOrder: any = await this.createUserOrder(newReq, newRes);
        console.log("createSellOrder", createSellOrder);
        if (createSellOrder.status === 200) {
          sellOrderIds.push({
            orderId: createSellOrder.data.orderId,
            status: 0,
            sellCurrency: element.coin,
            usdAmount: 0,
          });
          let updateTransaction = await txservice.updatePart(
            {
              notes: element.notes,
              currencyRef: element.coin,
              email: String(req.body.email).toLowerCase(),
            },
            {
              $set: {
                notes:
                  element.notes
                    .replace(/xBitcoin Bull-Run/g, "xBBR")
                    .replace(/xBitcoin Rush/g, "xBR")
                    .replace(/xBitcoin Bitcoin/g, "xBBo")
                    .replace(/xBitcoin Federal/g, "xBBF")
                    .replace(/xBitcoin Blooming/g, "xBBl")
                    .replace(/Smart Crypto Ripple/g, "SCR")
                    .replace(/Smart Crypto Wave/g, "SCW")
                    .replace(/Smart Crypto Surge/g, "SCS") +
                  `, Sold on ${new Date().toISOString()}`,
                amount: 0,
                amountInvested: 0,
              },
            }
          );
          console.log(updateTransaction);
        }
      }
      console.log(sellOrderIds);
      // Update the existing SmartCrypto package with the new sell order IDs
      for (let index = 0; index < sellOrderIds.length; index++) {
        let newReq, newRes;
        let email = String(req.body.email).toLowerCase();
        let orderId = sellOrderIds[index].orderId;
        let orderStatus = "Completed";
        newReq = {
          body: {
            orderType: "Sell",
            email: email,
            orderStatus: orderStatus,
            orderId: orderId,
          },
        };
        console.log("newReq", newReq);
        let processSellOrders = await this.updateUserOrder(newReq, newRes);
        console.log("processSellOrders", processSellOrders);
        if (processSellOrders.status === 200) {
          let getLatestOrderDetails = await orderService.findOne({
            orderId: newReq.body.orderId,
            "user.email": String(newReq.body.email).toLowerCase(),
          });
          let totalOutAmount =
            getLatestOrderDetails.breakdown.inAmount *
            getLatestOrderDetails.orderRate.rate;
          let afterOurFees = totalOutAmount;
          //- totalOutAmount * (Number(getLatestOrderDetails.exchangeFees) / 100);
          // Update the status in the `sellOrderIds` array
          sellOrderIds[index].status = 200; // Assuming 1 represents success
          sellOrderIds[index].usdAmount = afterOurFees;
        } else {
          // Handle unsuccessful updates (optional)
          sellOrderIds[index].status = 500; // Assuming -1 represents a failure
          sellOrderIds[index].usdAmount = 0;
        }
      }

      let totalUsdAmount = 0;
      /* for (let index = 0; index < sellOrderIds.length; index++) {
         const element = sellOrderIds[index];
         if (element.status === 200) {
           totalUsdAmount += element.usdAmount;
         }
       }*/

      console.log("totalUsdAmount", totalUsdAmount);
      console.log("sellOrderIds after inside", sellOrderIds);
      //Buy new package
      let buyRes;
      buyRes = {
        body: {
          orderType: "SmartCryptoBuy",
          email: String(req.body.email).toLowerCase(),
          planName: req.body.planName,
          planManagedBy: req.body.managedBy,
          amount: totalUsdAmount,
          paymentType: "USD",
        },
      };

      let buyNewPlan = await this.createUserOrderForSmartCrypto(buyRes, res);
      console.log("buyNewPlan", buyNewPlan);
      return {
        data: "updatedSmartCryptoPack",
        status: 200,
      };
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while switch SmartCrypto Plan",
          error: err.message,
        },
      };
    }
  }

  async sellSmartCryptoPlan(req: any, res: any) {
    try {
      // Extract the cryptocurrencies array from the request body
      let existingCryptoCurrencies = req.body.exitingCryptocurrencies;
      let cryptoCurrencies = existingCryptoCurrencies.rows;
      console.log("cryptoCurrencies", cryptoCurrencies);

      let sellOrderIds = [];
      for (let index = 0; index < cryptoCurrencies.length; index++) {
        const element = cryptoCurrencies[index];
        let newReq, newRes;
        newReq = {
          body: {
            orderType: "Sell",
            currencyIn: element.coin,
            currencyOut: "USD",
            email: String(req.body.email).toLowerCase(),
            amount: element.amount,
          },
        };
        let createSellOrder: any = await this.createUserOrder(newReq, newRes);
        console.log("createSellOrder", createSellOrder);
        if (createSellOrder.status === 200) {
          sellOrderIds.push({
            orderId: createSellOrder.data.orderId,
            status: 0,
            sellCurrency: element.coin,
            usdAmount: 0,
          });
          let updateTransaction = await txservice.updatePart(
            {
              notes: element.notes,
              currencyRef: element.coin,
              email: String(req.body.email).toLowerCase(),
            },
            {
              $set: {
                notes:
                  element.notes
                    .replace(/xBitcoin Bull-Run/g, "xBBR")
                    .replace(/xBitcoin Bitcoin/g, "xBBo")
                    .replace(/xBitcoin Federal/g, "xBBF")
                    .replace(/xBitcoin Rush/g, "xBR")
                    .replace(/xBitcoin Blooming/g, "xBBl")
                    .replace(/Smart Crypto Ripple/g, "SCR")
                    .replace(/Smart Crypto Wave/g, "SCW")
                    .replace(/Smart Crypto Surge/g, "SCS") +
                  `, Sold on ${new Date().toISOString()}`,
                amount: 0,
                amountInvested: 0,
              },
            }
          );
          console.log(updateTransaction);
        }
      }
      console.log(sellOrderIds);
      // Update the existing SmartCrypto package with the new sell order IDs
      for (let index = 0; index < sellOrderIds.length; index++) {
        let newReq, newRes;
        let email = String(req.body.email).toLowerCase();
        let orderId = sellOrderIds[index].orderId;
        let orderStatus = "Completed";
        newReq = {
          body: {
            orderType: "Sell",
            email: email,
            orderStatus: orderStatus,
            orderId: orderId,
          },
        };
        console.log("newReq", newReq);
        let processSellOrders = await this.updateUserOrder(newReq, newRes);
        console.log("processSellOrders", processSellOrders);
        if (processSellOrders.status === 200) {
          let getLatestOrderDetails = await orderService.findOne({
            orderId: newReq.body.orderId,
            "user.email": String(newReq.body.email).toLowerCase(),
          });
          let totalOutAmount =
            getLatestOrderDetails.breakdown.inAmount *
            getLatestOrderDetails.orderRate.rate;
          let afterOurFees =
            totalOutAmount -
            totalOutAmount * (Number(getLatestOrderDetails.exchangeFees) / 100);
          // Update the status in the `sellOrderIds` array
          sellOrderIds[index].status = 200; // Assuming 1 represents success
          sellOrderIds[index].usdAmount = afterOurFees;
        } else {
          // Handle unsuccessful updates (optional)
          sellOrderIds[index].status = 500; // Assuming -1 represents a failure
          sellOrderIds[index].usdAmount = 0;
        }
      }

      let totalUsdAmount = 0;
      for (let index = 0; index < sellOrderIds.length; index++) {
        const element = sellOrderIds[index];
        if (element.status === 200) {
          totalUsdAmount += element.usdAmount;
        }
      }

      console.log("totalUsdAmount", totalUsdAmount);
      console.log("sellOrderIds", sellOrderIds);

      return {
        data: { message: "Sell Smart Crypto Plan is done", data: sellOrderIds },
        status: 200,
      };
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while switc hSmartCrypto Plan",
          error: err.message,
        },
      };
    }
  }

  async getAllOrders(req: any, res: any) {
    try {
      let orders = await orderService.find({});
      if (orders) {
        return { status: 200, data: orders };
      } else {
        const message = "No Orders found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllMiningSubscriptionOrders(req: any, res: any) {
    try {
      const email = String(req.query.email || "")
        .toLowerCase()
        .trim();
      const status = String(req.query.status || "").trim();
      const paymentType = String(req.query.paymentType || "").trim();
      const productId = String(req.query.productId || "").trim();
      const packageName =
        String(req.query.packageName || GOOGLE_PLAY_PACKAGE_NAME).trim() ||
        GOOGLE_PLAY_PACKAGE_NAME;
      const from = String(req.query.from || "").trim();
      const to = String(req.query.to || "").trim();
      const limitInput = Number(req.query.limit || 100);
      const pageInput = Number(req.query.page || 1);

      const limit = Number.isFinite(limitInput)
        ? Math.min(Math.max(limitInput, 1), 500)
        : 100;
      const page = Number.isFinite(pageInput) ? Math.max(pageInput, 1) : 1;
      const skip = (page - 1) * limit;

      const filters: any = {
        orderType: "MiningSubscriptionOrder",
      };

      if (email) {
        filters["user.email"] = email;
      }

      if (status) {
        filters.status = status;
      }

      if (paymentType) {
        filters.paymentType = paymentType;
      }

      if (productId) {
        filters.productId = productId;
      }

      if (from || to) {
        const dateFilter: any = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);
        filters.created = dateFilter;
      }

      const [orders, total] = await Promise.all([
        orderService.findPaginatedSkip(
          limit,
          skip,
          { created: -1, modified: -1 },
          filters,
          {}
        ),
        orderService.findCount(filters),
      ]);

      const now = new Date();
      const gpayOrders = orders.filter(
        (order: any) =>
          order?.paymentType === PaymentTypes.Gpay &&
          order?.googlePurchaseToken &&
          order?.productId
      );

      let googleAccessToken: string | null = null;
      let googleAccessTokenError: string | null = null;

      if (gpayOrders.length > 0) {
        try {
          googleAccessToken = await getGooglePlayAccessTokenForOrders();
        } catch (err: any) {
          googleAccessTokenError = err?.message || String(err);
          console.error(
            "[getAllMiningSubscriptionOrders] Failed to fetch Google Play access token:",
            err
          );
        }
      }

      const formattedOrders = await mapWithConcurrency(
        orders,
        10,
        async (order: any) => {
          const storedSummary = buildStoredSubscriptionSummary(order, now);

          if (
            order?.paymentType !== PaymentTypes.Gpay ||
            !order?.googlePurchaseToken ||
            !order?.productId
          ) {
            return formatMiningSubscriptionOrder(order, storedSummary);
          }

          if (!googleAccessToken) {
            return formatMiningSubscriptionOrder(
              order,
              {
                ...storedSummary,
                statusSource: "stored_fallback",
                statusReason: googleAccessTokenError
                  ? `live Google Play lookup unavailable: ${googleAccessTokenError}`
                  : "live Google Play lookup unavailable",
              },
              googleAccessTokenError
            );
          }

          try {
            const liveGoogleStatus = await fetchGooglePlaySubscriptionStatus(
              packageName,
              String(order.productId),
              String(order.googlePurchaseToken),
              googleAccessToken
            );

            if (!liveGoogleStatus) {
              return formatMiningSubscriptionOrder(
                order,
                {
                  ...storedSummary,
                  statusSource: "stored_fallback",
                  statusReason:
                    "Google Play subscription token not found or expired",
                },
                "Google Play subscription token not found or expired"
              );
            }

            const liveSummary = buildGooglePlaySubscriptionSummary(
              order,
              liveGoogleStatus,
              now
            );

            return formatMiningSubscriptionOrder(order, liveSummary);
          } catch (err: any) {
            const httpStatus = err?.response?.status;
            const lookupError =
              err?.response?.data?.error?.message ||
              err?.message ||
              String(err);

            // 410 = Google Play confirms token is gone (expired >60 days ago) — definitively Expired
            if (httpStatus === 410) {
              return formatMiningSubscriptionOrder(
                order,
                {
                  ...storedSummary,
                  currentStatus: "Expired",
                  currentAccess: false,
                  statusSource: "stored_fallback",
                  statusReason:
                    "Subscription expired — token no longer queryable by Google Play (>60 days)",
                },
                lookupError
              );
            }

            console.error(
              `[getAllMiningSubscriptionOrders] Google Play lookup failed for order ${order?.orderId}:`,
              err
            );

            return formatMiningSubscriptionOrder(
              order,
              {
                ...storedSummary,
                statusSource: "stored_fallback",
                statusReason: `live Google Play lookup failed: ${lookupError}`,
              },
              lookupError
            );
          }
        }
      );

      return {
        status: 200,
        data: {
          total,
          page,
          limit,
          packageNameUsedForGooglePlay:
            gpayOrders.length > 0 ? packageName : null,
          orders: formattedOrders,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllMiningSubscriptionOrderWeb(req: any, res: any) {
    try {
      const email = String(req.query.email || "")
        .toLowerCase()
        .trim();
      const status = String(req.query.status || "").trim();
      const paymentType = String(req.query.paymentType || "").trim();
      const productId = String(req.query.productId || "").trim();
      const from = String(req.query.from || "").trim();
      const to = String(req.query.to || "").trim();
      const limitInput = Number(req.query.limit || 100);
      const pageInput = Number(req.query.page || 1);

      const limit = Number.isFinite(limitInput)
        ? Math.min(Math.max(limitInput, 1), 500)
        : 100;
      const page = Number.isFinite(pageInput) ? Math.max(pageInput, 1) : 1;
      const skip = (page - 1) * limit;

      const filters: any = {
        orderType: "MiningSubscriptionOrder",
        paymentType: { $in: [PaymentTypes.Stripe, PaymentTypes.Paypal] },
      };

      if (email) {
        filters["user.email"] = email;
      }

      if (status) {
        filters.status = status;
      }

      if (paymentType) {
        filters.paymentType = paymentType;
      }

      if (productId) {
        filters.productId = productId;
      }

      if (from || to) {
        const dateFilter: any = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);
        filters.created = dateFilter;
      }

      const [orders, total] = await Promise.all([
        orderService.findPaginatedSkip(
          limit,
          skip,
          { created: -1, modified: -1 },
          filters,
          {}
        ),
        orderService.findCount(filters),
      ]);

      const now = new Date();
      const couponLookup = await getBitcoinyayCouponLookupForOrders(orders);
      const formattedOrders = orders.map((order: any) =>
        formatMiningSubscriptionOrder(
          order,
          buildStoredSubscriptionSummary(order, now),
          null,
          couponLookup.get(String(order?.orderId || ""))
        )
      );

      return {
        status: 200,
        data: {
          total,
          page,
          limit,
          orders: formattedOrders,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getCompletedBtcyBuyOrders(req: any, res: any) {
    try {
      const email = String(req.query.email || "").toLowerCase();
      const from = String(req.query.from || "").trim();
      const to = String(req.query.to || "").trim();
      const limitInput = Number(req.query.limit || 100);
      const pageInput = Number(req.query.page || 1);

      const limit = Number.isFinite(limitInput)
        ? Math.min(Math.max(limitInput, 1), 500)
        : 100;
      const page = Number.isFinite(pageInput) ? Math.max(pageInput, 1) : 1;
      const skip = (page - 1) * limit;

      const filters: any = {
        orderType: "Buy",
        status: OrderStatus.Completed,
        "breakdown.outCurrencyName": "BTCY",
      };

      if (email) {
        filters["user.email"] = email;
      }

      if (from || to) {
        const dateFilter: any = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);
        filters.orderCompletedOn = dateFilter;
      }

      const [orders, total] = await Promise.all([
        orderService.findPaginatedSkip(
          limit,
          skip,
          { orderCompletedOn: -1, created: -1 },
          filters,
          {}
        ),
        orderService.findCount(filters),
      ]);

      return {
        status: 200,
        data: {
          total,
          page,
          limit,
          orders,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  private formatBtcyOrderDate(value: any): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);

    const day = parts.find((part) => part.type === "day")?.value || "";
    const month = parts.find((part) => part.type === "month")?.value || "";
    const year = parts.find((part) => part.type === "year")?.value || "";

    return [day, month].filter(Boolean).join(" ") + (year ? `, ${year}` : "");
  }

  private formatTokenAmount(amount: any, symbol: string): string {
    const numeric = Number(amount || 0);
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 8,
    }).format(Number.isFinite(numeric) ? numeric : 0);
    return `${formatted} ${symbol}`;
  }

  private formatUsdAmount(amount: any): string {
    const numeric = Number(amount || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numeric) ? numeric : 0);
  }

  private formatBtcyOrderStatus(status: any): string {
    const value = String(status || "").trim();
    if (value === OrderStatus.Completed) return "Completed";
    if (value === OrderStatus.OrderCancelled || value === "Cancelled") {
      return "Cancelled";
    }
    if (!value) return "Processing";
    return ["Pending", "Quoted", "Paid", "Payment Submitted"].includes(value)
      ? "Processing"
      : value;
  }

  private getBtcyOrderRate(order: any): number | null {
    const rate =
      order?.orderRate?.rate ??
      order?.orderRate?.buyPrice ??
      order?.orderRate?.sellPrice ??
      order?.orderRate?.marketPrice ??
      null;
    const numeric = Number(rate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    const type = String(order?.orderType || "");
    const isBuy = type === "Buy";
    const btcyAmount = Number(
      isBuy ? order?.breakdown?.outAmount : order?.breakdown?.inAmount
    );
    const stableAmount = Number(
      isBuy ? order?.breakdown?.inAmount : order?.breakdown?.outAmount
    );

    if (
      Number.isFinite(btcyAmount) &&
      btcyAmount > 0 &&
      Number.isFinite(stableAmount) &&
      stableAmount > 0
    ) {
      return Number((stableAmount / btcyAmount).toFixed(8));
    }

    return null;
  }

  private getBtcyOrderWalletAddress(order: any): string {
    return (
      String(order?.receiverAccount?.userReceiveAddress || "").trim() ||
      String(order?.receiverAccount?.exchangeReceiveAddress || "").trim() ||
      String(order?.transactions?.[0]?.walletAddress || "").trim()
    );
  }

  async getUserBtcyBuySellOrders(req: any, res: any) {
    try {
      const email = String(req.params?.email || req.query?.email || "")
        .toLowerCase()
        .trim();

      if (!email) {
        return { status: 400, data: { message: "email is required" } };
      }

      const user = await uservice.findOneSelect(
        { email },
        { email: 1 }
      );
      if (!user) {
        return { status: 404, data: { message: "emailNotRegistered" } };
      }

      const orders = await orderService.find({
        "user.email": email,
        $or: [
          {
            orderType: "Buy",
            "breakdown.outCurrencyName": "BTCY",
          },
          {
            orderType: "Sell",
            "breakdown.inCurrenyName": "BTCY",
          },
        ],
      });

      const formattedOrders = (orders || [])
        .sort((a: any, b: any) => {
          const aDate = new Date(a?.orderCompletedOn || a?.created || 0).getTime();
          const bDate = new Date(b?.orderCompletedOn || b?.created || 0).getTime();
          return bDate - aDate;
        })
        .map((order: any) => {
          const type = String(order?.orderType || "");
          const isBuy = type === "Buy";
          const date = order?.orderCompletedOn || order?.created;
          const btcyAmount = isBuy
            ? order?.breakdown?.outAmount
            : order?.breakdown?.inAmount;
          const usdtAmount = isBuy
            ? order?.breakdown?.inAmount
            : order?.breakdown?.outAmount;

          return {
            orderid: order?.orderId || String(order?._id || ""),
            date: this.formatBtcyOrderDate(date),
            type,
            btcyAmount: this.formatTokenAmount(btcyAmount, "BTCY"),
            usdtAmount: this.formatUsdAmount(usdtAmount),
            walletAddress: this.getBtcyOrderWalletAddress(order),
            status: this.formatBtcyOrderStatus(order?.status),
            rate: this.getBtcyOrderRate(order),
          };
        });

      return { status: 200, data: formattedOrders };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllOrdersByDate(req: any, res: any) {
    try {
      const allowedEmails = new Set([
        "sunkuomkarsai12121@gmail.com",
        "omkar@azooca.com",
        "cielinoinc@gmail.com",
        /* "169168011@qq.com",
         "b62721209@gmail.com",
         "banks144@yahoo.com",
         "bmoralez12@gmail.com",
         "bo.dagnall@gmail.com",
         "brownst81@yahoo.com",
         "carrieslyons@yahoo.com",
         "chrishumpherys@yahoo.com",
         "daniel.estrada1991@yahoo.com",
         "dave@cdgmaterials.com",
         "dawnmsonnier@icloud.com",
         "dbrevolution11@gmail.com",
         "devin.delamora@icloud.com",
         "dlcpmoralez@gmail.com",
         "donpanchos4me@gmail.com",
         "dpar4fam@hotmail.com",
         "espo66@hotmail.com",
         "fowlertrucking14@yahoo.com",
         "jeff@blackmoreranch.com",
         "jen@blackmoreranch.com",
         "jinelliott2013@yahoo.com",
         "judybriggs1@gmail.com",
         "kathy.oglesbee@yahoo.com",
         "kmonge10@yahoo.com",
         "lino.gomez1@gmail.com",
         "lmmecham@yahoo.com",
         "lololeveck@gmail.com",
         "martinmonge@verizon.net",
         "pearlsblingsnthings@gmail.com",
         "rey.barthelemy@gmail.com",
         "sharpline2004@yahoo.com",
         "sheilatosh@hotmail.com",
         "sherri@tristatematerials.com",
         "sj.brown@yahoo.com",
         "ssjriver@icloud.com",
         "taylorfowler@icloud.com",
         "trujillolouis@icloud.com",
         "uscmandyli60@gmail.com",
         "vosloo.wilmie@gmail.com",
         "wwrv@verizon.net" */
      ]);

      const { startDate, endDate } = req.query;

      // Parse startDate and endDate as Date objects in UTC
      const start = new Date(startDate);
      const end = new Date(endDate);

      console.log("Start Date (parsed UTC):", start.toISOString());
      console.log("Start Date (parsed):", start);
      console.log("End Date (parsed UTC):", end.toISOString());
      console.log("End Date (parsed):", end);

      // Fetch orders created within the specified date range
      const orders = await orderService.find({});

      // Fetch transactions within the specified date range
      const transactions = await txservice.find({});

      // Group orders and transactions by email
      const emailMap = new Map();

      orders.forEach((order) => {
        if (order.user?.email) {
          if (!emailMap.has(order.user.email)) {
            emailMap.set(order.user.email, { orders: [], transactions: [] });
          }
          emailMap.get(order.user.email).orders.push(order);
        }
      });

      transactions.forEach((tx) => {
        if (tx.email) {
          if (!emailMap.has(tx.email)) {
            emailMap.set(tx.email, { orders: [], transactions: [] });
          }
          emailMap.get(tx.email).transactions.push(tx);
        }
      });

      // Generate reports for each email
      for (let [email, { orders, transactions }] of emailMap.entries()) {
        // ✅ Skip if not in the allowed list
        if (!allowedEmails.has(email.toLowerCase())) continue;

        const userDetails = await uservice.findOne({ email });

        const completedOrders = orders.filter(
          (order: any) => order.status === "Completed"
        );
        const completedTransactions = transactions.filter(
          (tx: any) => tx.status === "Completed"
        );

        if (completedOrders.length > 0 || completedTransactions.length > 0) {
          await generatePDF(
            email,
            userDetails.userWallets,
            completedOrders,
            completedTransactions,
            start,
            end
          );
        }
      }

      const message = "Reports generated successfully";
      return { status: 200, data: message };
    } catch (err) {
      console.error(err);
      const message = "Error generating reports";
      return { status: 500, data: message };
    }
  }

  async getSellOrder() {
    try {
      // Add both orderType and status to the filter
      const filter = {
        orderType: "Sell",
        status: "Pending",
      };

      let orders = await orderService.find(filter);

      if (orders && orders.length > 0) {
        return { status: 200, data: orders };
      } else {
        // Return an empty array instead of a string to prevent .map() errors in React
        return { status: 200, data: [] };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllOrdersByDateWeekly(req: any, res: any) {
    try {
      const { startDate, endDate } = req.query;

      // Parse startDate and endDate as Date objects in UTC
      const start = new Date(startDate);
      const end = new Date(endDate);

      console.log("Start Date (parsed UTC):", start.toISOString());
      console.log("End Date (parsed UTC):", end.toISOString());

      // List of allowed emails
      const allowedEmails = new Set([
        "banks144@yahoo.com",
        //"donpanchos4me@gmail.com",
        //"rey.barthelemy@gmail.com",
        "fowlertrucking14@yahoo.com",
        // "cielinoinc@gmail.com",
        // "trujilloLouis@icloud.com",
        // "martinmonge@verizon.net",
        // "kathy.oglesbee@yahoo.com",
        // "gogirl124@hotmail.com",
        // "sherri@tristatematerials.com",
        // "dbrevolution11@gmail.com",
        // "taylorfowler@icloud.com",
        // "wwrv@verizon.net",
        // "devin.delamora@icloud.com",
        // "daniel.estrada1991@yahoo.com",
        // "sj.brown@yahoo.com",
        // "brownst81@yahoo.com",
      ]);

      // Fetch orders created within the specified date range
      const orders = await orderService.find({
        created: { $gte: start, $lte: end },
      });

      // Fetch transactions within the specified date range
      const transactions = await txservice.find({
        txDate: { $gte: start, $lte: end },
      });

      // Group orders and transactions by email
      const emailMap = new Map();

      orders.forEach((order) => {
        const email = order.user?.email;
        if (email && allowedEmails.has(email)) {
          if (!emailMap.has(email)) {
            emailMap.set(email, { orders: [], transactions: [] });
          }
          emailMap.get(email).orders.push(order);
        }
      });

      transactions.forEach((tx) => {
        const email = tx.email;
        if (email && allowedEmails.has(email)) {
          if (!emailMap.has(email)) {
            emailMap.set(email, { orders: [], transactions: [] });
          }
          emailMap.get(email).transactions.push(tx);
        }
      });

      // Generate reports for each email
      for (let [email, { orders, transactions }] of emailMap.entries()) {
        const userDetails = await uservice.findOne({
          email: email,
        });

        const completedOrders = orders.filter(
          (order: any) => order.status === "Completed"
        );
        const completedTransactions = transactions.filter(
          (tx: any) => tx.status === "Completed"
        );

        if (completedOrders.length > 0 || completedTransactions.length > 0) {
          await generatePDFForWeekly(
            email,
            userDetails.userWallets,
            completedOrders,
            completedTransactions,
            start,
            end
          );
        }
      }

      const message = "Reports generated successfully";
      return { status: 200, data: message };
    } catch (err) {
      console.error(err);
      const message = "Error generating reports";
      return { status: 500, data: message };
    }
  }

  async getAllOrdersByDate0(req: any, res: any) {
    try {
      const { year, month } = req.query;
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      // Fetch orders and transactions within the specified date range
      const orders = await orderService.find({
        created: { $gte: startDate, $lte: endDate },
      });

      const transactions = await txservice.find({
        txDate: { $gte: startDate, $lte: endDate },
      });

      // Filter for the specific email address
      const email = "omkar@azooca.com";
      const filteredOrders = orders.filter(
        (order: any) => order.user?.email === email
      );

      const filteredTransactions = transactions.filter(
        (tx: any) => tx.email === email
      );

      // Generate report if there are completed orders or transactions
      const completedOrders = filteredOrders.filter(
        (order: any) => order.status === "Completed"
      );

      const completedTransactions = filteredTransactions.filter(
        (tx: any) => tx.status === "Completed"
      );

      if (completedOrders.length > 0 || completedTransactions.length > 0) {
        generatePDF(
          email,
          [],
          completedOrders,
          completedTransactions,
          startDate,
          endDate
        );
      }

      const message = `Report generated successfully for ${email}`;
      return res.status(200).json({ message });
    } catch (err) {
      console.error(err);
      const message = "Error generating report";
      return res.status(500).json({ message });
    }
  }

  async getOrdersCount(req: any, res: any) {
    try {
      let orders = await orderService.findCount({});
      if (orders) {
        return { status: 200, data: orders };
      } else {
        const message = "No Orders found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getDiffOrdersCount(req: any, res: any) {
    try {
      let buyOrders = await orderService.findCount({
        orderType: "Buy",
      });
      let sellOrders = await orderService.findCount({
        orderType: "Sell",
      });
      let convertOrders = await orderService.findCount({
        orderType: "Convert",
      });

      let getIndexxTokenOrders = await orderService.findAggregate([
        {
          $match: {
            "breakdown.outCurrencyName": {
              $in: ["INEX", "IN500", "INXC", "IUSD+"],
            },
          },
        },
        {
          $count: "indexxTokenOrdersCount",
        },
      ]);

      let getOtherTokenOrders = await orderService.findAggregate([
        {
          $match: {
            "breakdown.outCurrencyName": {
              $nin: ["INEX", "IN500", "INXC", "IUSD+"],
            },
          },
        },
        {
          $count: "otherTokenOrdersCount",
        },
      ]);
      if (buyOrders || sellOrders || convertOrders) {
        let results = {
          buyOrdersCount: buyOrders,
          sellOrdersCount: sellOrders,
          convertOrdersCount: convertOrders,
          indexxTokenOrders: getIndexxTokenOrders[0].indexxTokenOrdersCount,
          otherTokenOrders: getOtherTokenOrders[0].otherTokenOrdersCount,
        };
        return { status: 200, data: results };
      } else {
        const message = "No Orders found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async validateDiscountCode(req: any, res: any) {
    try {
      const { discountCode, packName } = req.params; // Assuming the packName is also sent as a parameter
      console.log("Discount Code:", discountCode, "Pack:", packName);

      const getDiscountCode = await discountCodeService.findOne({
        code: discountCode,
      });
      console.log(getDiscountCode);

      if (getDiscountCode && getDiscountCode.isActive) {
        // Check if the discount code matches the provided pack
        if (getDiscountCode?.subType === packName) {
          return { status: 200, data: getDiscountCode };
        } else {
          const message =
            "The discount code is not valid for the selected pack.";
          return { status: 400, data: message }; // 400 is a more appropriate status code for bad request or invalid input
        }
      } else {
        const message =
          "This discount code is invalid Code. Please use a valid code.";
        return { status: 400, data: message }; // 400 is a more appropriate status code for bad request or invalid input
      }
    } catch (err) {
      console.error("Error in validateDiscountCode:", err); // It's good to log the actual error
      return { status: 500, data: "Internal Server Error" };
    }
  }

  async getDEXOrderDetails(req: any, res: any) {
    try {
      console.log(req.params.orderId, "orderId");
      let order = await orderService.findOne({
        orderId: req.params.orderId,
        exchangeName: "Decentralized",
      });
      if (order) {
        return { status: 200, data: order };
      } else {
        const message = "No Order found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getDEXOrderDetailsByOrderId(orderId: string) {
    try {
      console.log(orderId, "orderId");
      let order = await orderService.findOne({
        orderId: orderId,
        exchangeName: "Decentralized",
      });
      if (order) {
        return { status: 200, data: order };
      } else {
        const message = "No Order found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  //Helpers
  async getAdminFees(orderCurrency: string) {
    try {
      if (String(orderCurrency || "").toUpperCase() === "BTCY") {
        return getConfiguredBtcyFeePercent();
      }

      if (
        orderCurrency == "BTC" ||
        orderCurrency == "ETH" ||
        orderCurrency == "BNB" ||
        orderCurrency == "BUSD" ||
        orderCurrency == "LTC" ||
        orderCurrency == "USD" ||
        orderCurrency == "AMZN" ||
        orderCurrency == "APPL" ||
        orderCurrency == "GOOGL" ||
        orderCurrency == "MSFT" ||
        orderCurrency == "META" ||
        orderCurrency == "NVDA" ||
        orderCurrency == "PEP" ||
        orderCurrency == "BCM" ||
        orderCurrency == "CHZ" ||
        orderCurrency == "VET" ||
        orderCurrency == "BTCY" ||
        orderCurrency == "AVAX" ||
        orderCurrency == "THETA" ||
        orderCurrency == "NOT" ||
        orderCurrency == "FTM" ||
        orderCurrency == "RUNE" ||
        orderCurrency == "NEAR" ||
        orderCurrency == "AAVE" ||
        orderCurrency == "INJ" ||
        orderCurrency == "PYTH" ||
        orderCurrency == "BEAM" ||
        orderCurrency == "ADA" ||
        orderCurrency == "XLM" ||
        orderCurrency == "SUI" ||
        orderCurrency == "MANA" ||
        orderCurrency == "SNP500" ||
        orderCurrency == "TLSA" ||
        orderCurrency == "DAI" ||
        orderCurrency == "USDT" ||
        orderCurrency == "USDC" ||
        orderCurrency == "MATIC" ||
        orderCurrency == "BCH" ||
        orderCurrency == "SOL" ||
        orderCurrency == "DOT" ||
        orderCurrency == "SHIB" ||
        orderCurrency == "LINK" ||
        orderCurrency == "DAI" ||
        orderCurrency == "DOGE" ||
        orderCurrency == "LEO" ||
        orderCurrency == "TUSD" ||
        orderCurrency == "XRP" ||
        orderCurrency == "EQSTK" ||
        orderCurrency == "CRYC10" ||
        orderCurrency == "ALCRYP" ||
        orderCurrency == "INDXXF" ||
        orderCurrency == "TOB"
      ) {
        let adminFee = await appSettingsService.findOne({ key: "AdminFees" });
        return adminFee.value;
      } else if (
        orderCurrency == "IN500" ||
        orderCurrency == "INEX" ||
        orderCurrency == "DaCrazy" ||
        orderCurrency == "INXC" ||
        orderCurrency == "IUSD+" ||
        orderCurrency == "INXP" ||
        orderCurrency == "WIBS" ||
        orderCurrency == "DaCrazy" ||
        orderCurrency == "SRT"
      ) {
        let adminFee = await appSettingsService.findOne({
          key: "IndexxTokensAdminFees",
        });
        return adminFee.value;
      } else if (orderCurrency === "PowerPack") {
        let powerpackFee = await appSettingsService.findOne({
          key: "PowerPackFee",
        });
        return powerpackFee.value;
      } else {
        return 0;
      }
    } catch (err) {
      return 0;
    }
  }

  async getCurrencyPriceByName(name: string) {
    try {
      if (
        name.localeCompare("BTC") == 0 ||
        name.localeCompare("ETH") == 0 ||
        name.localeCompare("LTC") == 0 ||
        name.localeCompare("BNB") == 0 ||
        name.localeCompare("DOGE") == 0 ||
        name.localeCompare("TON") == 0 ||
        name.localeCompare("LINK") == 0 ||
        name.localeCompare("DOGE") == 0 ||
        name.localeCompare("SHIB") == 0 ||
        name.localeCompare("XRP") == 0 ||
        name.localeCompare("TUSD") == 0 ||
        name.localeCompare("LEO") == 0 ||
        name.localeCompare("USDC") == 0 ||
        name.localeCompare("MATIC") == 0 ||
        name.localeCompare("BCH") == 0 ||
        name.localeCompare("DOT") == 0 ||
        name.localeCompare("CHZ") == 0 ||
        name.localeCompare("VET") == 0 ||
        name.localeCompare("BTCY") == 0 ||
        name.localeCompare("AVAX") == 0 ||
        name.localeCompare("THETA") == 0 ||
        name.localeCompare("NOT") == 0 ||
        name.localeCompare("FTM") == 0 ||
        name.localeCompare("RUNE") == 0 ||
        name.localeCompare("NEAR") == 0 ||
        name.localeCompare("AAVE") == 0 ||
        name.localeCompare("INJ") == 0 ||
        name.localeCompare("PYTH") == 0 ||
        name.localeCompare("BEAM") == 0 ||
        name.localeCompare("XLM") == 0 ||
        name.localeCompare("SUI") == 0 ||
        name.localeCompare("MANA") == 0 ||
        name.localeCompare("ADA") == 0 ||
        name.localeCompare("USDT") == 0 ||
        name.localeCompare("BUSD") == 0 ||
        name.localeCompare("AMZN") == 0 ||
        name.localeCompare("APPL") == 0 ||
        name.localeCompare("GOOGL") == 0 ||
        name.localeCompare("MSFT") == 0 ||
        name.localeCompare("META") == 0 ||
        name.localeCompare("NVDA") == 0 ||
        name.localeCompare("PEP") == 0 ||
        name.localeCompare("BCM") == 0 ||
        name.localeCompare("SNP500") == 0 ||
        name.localeCompare("TLSA") == 0 ||
        name.localeCompare("TSLA") == 0
      ) {
        let latestBaseRate = await getPriceByName(name);
        console.log(latestBaseRate, "a");
        return latestBaseRate.data;
      } else if (
        name == "IN500" ||
        name == "IUSD+" ||
        name == "INXC" ||
        name == "INEX" ||
        name == "DaCrazy" ||
        name == "WIBS" ||
        name == "DaCrazy" ||
        name == "INXP"
      ) {
        let currency = await currencyService.findOne({ code: name });
        return currency.buyPrice;
      } else if (name == "FTT_ETH") {
        let currentFTTPrice = await getLatestFTTPrice();
        return currentFTTPrice;
      } else {
        return 0;
      }
    } catch (err) {
      return 0;
    }
  }

  //Helper
  async UpdateDBForCaptainOrder(
    honeyBeeEmail: string,
    CaptainEmail: string,
    order: Order
  ) {
    try {
      console.log(
        "honeyBeeEmail",
        honeyBeeEmail,
        order?.user?.email === honeyBeeEmail
      );
      console.log("CaptainEmail", CaptainEmail);
      console.log("order", order.orderId);
      let getCaptainData = await affilateService.findOne({
        Email: CaptainEmail,
      });

      if (getCaptainData) {
        if (order && order?.user?.email === honeyBeeEmail) {
          let currenctOrderCount = getCaptainData?.orderCount
            ? getCaptainData.orderCount
            : 0;
          let updateCaptainData = await affilateService.updatePart(
            {
              Email: CaptainEmail,
            },
            {
              $set: { orderCount: currenctOrderCount + 1 },
            }
          );
          console.log("updateCaptainData", updateCaptainData);
        } else {
          let data = {
            message: "No Order Found Existing",
          };
          return data;
        }
      } else {
        let data = {
          message: "No Captain Bee Existing",
        };
        return data;
      }
    } catch (err) {
      console.log("error");
    }
  }
}

export async function updateUserOrderHelper(
  email: string,
  orderId: string,
  orderType: string,
  orderStatus: string,
  stripePaymentIntent?: string
) {
  try {
    let user = await uservice.findOneSelect(
      {
        email: email,
      },
      {}
    );
    if (user && user.role == UserRoleTypes.Admin) {
      return { status: 500, data: "Admin cannot place order" };
    } else {
      let userOrder = await orderService.findOne({
        orderId: orderId,
        "user.email": email,
      });
      if (userOrder) {
        let createOrderTX = {
          currency: userOrder.breakdown.inCurrenyName,
          amount: userOrder.breakdown.inAmount,
          trnReference: stripePaymentIntent,
          trnHash: "",
          walletAddress: "",
          created: new Date(),
          status: "Completed",
        } as OrderTransaction;
        let updateOrder = await orderService.updatePart(
          { orderId: orderId, "user.email": email },
          {
            $set: {
              status: orderStatus,
              transactions: userOrder.transactions?.concat(createOrderTX),
            },
          }
        );

        if (orderStatus == "Completed") {
          // let currencyRes = await getCurrencyPriceByType(userOrder.breakdown.outCurrencyName);
          // let latestRates = {} as Rates;
          // if (currencyRes.status == 200 && orderType == "Buy") {
          //     latestRates = {
          //         currency: currencyRes.data.code,
          //         rate: currencyRes.data.buyPrice,
          //     } as Rates;
          // } else if (currencyRes.status == 200 && orderType == "Sell") {
          //     latestRates = {
          //         currency: currencyRes.data.code,
          //         rate: currencyRes.data.sellPrice,
          //     } as Rates;
          // }

          let process = await orderService.processOrder(userOrder);
          // send email to user and process payout
          let getLatestOrderDetails = await orderService.findOne({
            orderId: orderId,
            "user.email": email,
          });
          // send email to user and process payout
          await new SendEmail().sendOrderCompleted(
            userOrder.user.email,
            "User",
            getLatestOrderDetails.breakdown.outAmount,
            getLatestOrderDetails.breakdown.outCurrencyName,
            getLatestOrderDetails.orderType,
            getLatestOrderDetails.orderRate.rate,
            getLatestOrderDetails.breakdown.inAmount -
            getLatestOrderDetails.breakdown.inAmount *
            (Number(getLatestOrderDetails?.exchangeFees) / 100),
            "",
            getLatestOrderDetails.orderId
          );
          await new SendEmail().sendAccountsOrderCompleted({
            userEmail: getLatestOrderDetails.user?.email || "",
            orderId: getLatestOrderDetails.orderId,
            orderType: getLatestOrderDetails.orderType,
            paymentType: String(getLatestOrderDetails.paymentType || ""),
            inAmount: getLatestOrderDetails.breakdown?.inAmount,
            inCurrency: getLatestOrderDetails.breakdown?.inCurrenyName,
            outAmount: getLatestOrderDetails.breakdown?.outAmount,
            outCurrency: getLatestOrderDetails.breakdown?.outCurrencyName,
            status: getLatestOrderDetails.status,
            exchangeName: getLatestOrderDetails.exchangeName,
            blockchainName: getLatestOrderDetails.blockchainName,
            completedAt: getLatestOrderDetails.orderCompletedOn || new Date(),
            notes:
              getLatestOrderDetails.notes ||
              getLatestOrderDetails.comments ||
              "",
          });

          const newTx = await txservice.create({
            email: getLatestOrderDetails.user.email,
            orderId: getLatestOrderDetails.orderId,
            extRef: "",
            txId: "",
            from: "",
            to: getLatestOrderDetails.user.email,
            amount: getLatestOrderDetails.breakdown.outAmount,
            exchangeName: "CEX",
            info: "Buy crypto by user",
            status: OrderStatus.Completed,
            currencyRef: getLatestOrderDetails.breakdown.outCurrencyName,
            walletType: "ASSET_WALLET",
            transactionType: "BUY",
            txDate: new Date(),
            benificaryAddress: "",
          });
          //update task center if this is first time buy from user

          await checkAndUpdateFirstTimeTranactionPoints(getLatestOrderDetails);
          let resRewards = await addRewards(email, orderId);
          console.log(resRewards);
          //}
          return process;
        }
        return { status: 200, data: userOrder };
      } else {
        return { status: 500, data: "Order not found" };
      }
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}

export async function addRewards(
  email: string,
  orderId: string,
  usdAmount: number = 0
) {
  try {
    let user = await uservice.findOne({ email: email });
    let order = await orderService.findOne({ orderId: orderId });

    let userTaskCenter = await taskCenterService.findOne({
      email: email,
    });
    console.log("o", order);
    if (userTaskCenter && Number(userTaskCenter.tradeToEarnPercentage) > 0) {
      if (user && order) {
        if (order.status == "Completed") {
          let orderAmountInUSD = 0;
          if (order.orderType == "Buy" || order.orderType == "Sell") {
            orderAmountInUSD =
              order.orderType == "Buy"
                ? order.breakdown.inAmount
                : order.breakdown.outAmount;
          } else if (order.orderType == "Convert") {
            orderAmountInUSD = usdAmount;
          }
          console.log("Order AMOUNT", orderAmountInUSD);
          if (orderAmountInUSD < 50) {
            return {
              status: 200,
              data: {
                message:
                  "No rewards added to this order as order amount is less 50 USD",
                rewardAmount: 0,
              },
            };
          } else {
            let rewardAmountToAdd =
              orderAmountInUSD *
              (Number(userTaskCenter.tradeToEarnPercentage) / 100);
            let getUserRewards = await rewardService.findOne({ email: email });
            console.log("getUserRE", getUserRewards);
            if (getUserRewards) {
              let newRewards = rewardAmountToAdd + getUserRewards.totalRewards;
              if (newRewards >= 1500) {
                let updateTaskCenter = await taskCenterService.updatePart(
                  {
                    email: email,
                  },
                  {
                    $set: {
                      tradeToEarnPercentage: 0,
                    },
                  }
                );
              }
              console.log(
                "new rewards",
                newRewards,
                "TO ADD",
                rewardAmountToAdd
              );
              let updateReward = await rewardService.updatePart(
                { "user.email": email },
                {
                  $set: {
                    totalRewards: newRewards,
                    rewardTokenBalanceInUSD: newRewards * 0.1,
                  },
                }
              );
              if (updateReward) {
                const message = "rewardAdded";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileAddingReward";
                return { status: 500, data: message };
              }
            } else {
              let newReward = {
                userId: user._id,
                email: user.email,
                referralCode: "Reward for order",
                totalRewards: rewardAmountToAdd,
                rewardCurrency: "Indexx Exchange Token",
                rewardTokenBalanceInUSD: rewardAmountToAdd * 0.1,
                rewardUpdatedOn: new Date(),
                rewardTokenPrice: 0.1,
                rewardCurrencySymbol: "INEX",
                rewardCurrencyDecimals: 18,
                rewardTokenAddress: "",
              };
              let addReward = await rewardService.create(newReward);
              if (addReward) {
                const message = "rewardAdded";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileAddingReward";
                return { status: 500, data: message };
              }
            }
          }
        } else {
          const message = "No order or user found";
          return { status: 500, data: message };
        }
      }
    } else {
      const message = "User has not completed the taskcenter";
      return { status: 200, data: message };
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}

export async function addDEXUserRewards(
  userWalletAddr: string,
  orderId: string,
  usdAmount: number = 0
) {
  try {
    let user = await uservice.findOne({ walletAddress: userWalletAddr });
    let order = await orderService.findOne({ orderId: orderId });
    let appSettings = await appSettingsService.getSettingsBykey(
      "TradeToEarnPercentage"
    );
    console.log("o", order);
    //if (user && order) {
    if (order.status == "Completed") {
      let orderAmountInUSD = 0;
      if (order.orderType == "Buy" || order.orderType == "Sell") {
        orderAmountInUSD =
          order.orderType == "Buy"
            ? order.breakdown.inAmount
            : order.breakdown.outAmount;
      } else if (order.orderType == "Convert") {
        orderAmountInUSD = usdAmount;
      }
      console.log("Order AMOUNT");
      if (orderAmountInUSD < 50) {
        return {
          status: 200,
          data: {
            message:
              "No rewards added to this order as order amount is less 50 USD",
            rewardAmount: 0,
          },
        };
      } else {
        let rewardAmountToAdd =
          orderAmountInUSD * (appSettings.data.value / 100);
        let getUserRewards = await rewardService.findOne({
          rewardTokenAddress: userWalletAddr,
        });
        console.log("getUserRE", getUserRewards);
        if (getUserRewards) {
          let newRewards = rewardAmountToAdd + getUserRewards.totalRewards;
          console.log("new rewards", newRewards, "TO ADD", rewardAmountToAdd);
          let updateReward = await rewardService.updatePart(
            { rewardTokenAddress: userWalletAddr },
            {
              $set: {
                totalRewards: newRewards,
                rewardTokenBalanceInUSD: newRewards * 0.1,
              },
            }
          );
          if (updateReward) {
            const message = "rewardAdded";
            return { status: 200, data: message };
          } else {
            const message = "errorWhileAddingReward";
            return { status: 500, data: message };
          }
        } else {
          let newReward = {
            userId: user._id,
            email: "",
            referralCode: "Reward for order",
            totalRewards: rewardAmountToAdd,
            rewardCurrency: "Indexx Exchange Token",
            rewardTokenBalanceInUSD: rewardAmountToAdd * 0.1,
            rewardUpdatedOn: new Date(),
            rewardTokenPrice: 0.1,
            rewardCurrencySymbol: "INEX",
            rewardCurrencyDecimals: 18,
            rewardTokenAddress: userWalletAddr,
          };
          let addReward = await rewardService.create(newReward);
          if (addReward) {
            const message = "rewardAdded";
            return { status: 200, data: message };
          } else {
            const message = "errorWhileAddingReward";
            return { status: 500, data: message };
          }
        }
      }
    } else {
      const message = "No order or user found";
      return { status: 500, data: message };
    }
    //}
  } catch (err) {
    return { status: 500, data: err };
  }
}

export async function addDEXRewards(
  userWallerAddress: string,
  orderId: string,
  usdAmount: number = 0
) {
  try {
    let user = await uservice.findOne({ walletAddress: userWallerAddress });
    let order = await orderService.findOne({ orderId: orderId });
    let appSettings = await appSettingsService.getSettingsBykey(
      "TradeToEarnPercentage"
    );
    if (user && order) {
      if (order.status == "Completed") {
        let orderAmountInUSD = 0;
        if (order.orderType == "Buy" || order.orderType == "Sell") {
          orderAmountInUSD =
            order.orderType == "Buy"
              ? order.breakdown.inAmount
              : order.breakdown.outAmount;
        } else if (order.orderType == "Convert") {
          orderAmountInUSD = usdAmount;
        }
        if (orderAmountInUSD < 50) {
          return {
            status: 200,
            data: {
              message:
                "No rewards added to this order as order amount is less 50 USD",
              rewardAmount: 0,
            },
          };
        } else {
          let rewardAmountToAdd =
            orderAmountInUSD * (appSettings.data.value / 100);
          let getUserRewards = await rewardService.findOne({
            rewardTokenAddress: userWallerAddress,
          });
          if (getUserRewards) {
            let newRewards = rewardAmountToAdd + getUserRewards.totalRewards;
            let updateReward = await rewardService.updatePart(
              { "user.userWallerAddress": userWallerAddress },
              {
                $set: {
                  totalRewards: newRewards,
                  rewardTokenBalanceInUSD: newRewards * 0.1,
                },
              }
            );
            if (updateReward) {
              const message = "rewardAdded";
              return { status: 200, data: message };
            } else {
              const message = "errorWhileAddingReward";
              return { status: 500, data: message };
            }
          } else {
            let newReward = {
              userId: user._id,
              email: user.email,
              rewardTokenAddress: userWallerAddress,
              referralCode: "Reward for order",
              totalRewards: rewardAmountToAdd,
              rewardCurrency: "Indexx Exchange Token",
              rewardTokenBalanceInUSD: rewardAmountToAdd * 0.1,
              rewardUpdatedOn: new Date(),
              rewardTokenPrice: 0.1,
              rewardCurrencySymbol: "INEX",
              rewardCurrencyDecimals: 18,
            };
            let addReward = await rewardService.create(newReward);
            if (addReward) {
              const message = "rewardAdded";
              return { status: 200, data: message };
            } else {
              const message = "errorWhileAddingReward";
              return { status: 500, data: message };
            }
          }
        }
      } else {
        const message = "No order or user found";
        return { status: 500, data: message };
      }
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}

export async function addReferralRewards(
  email: string,
  orderId: string,
  usdAmount: number = 0
) {
  try {
    let user = await uservice.findOne({ email: email });
    let order = await orderService.findOne({ orderId: orderId });
    let appSettings = await appSettingsService.getSettingsBykey(
      "ReferralPercentage"
    );
    console.log("o", order);
    if (user && order) {
      if (order.status == "Completed") {
        let orderAmountInUSD = 0;
        if (order.orderType == "Buy" || order.orderType == "Sell") {
          orderAmountInUSD =
            order.orderType == "Buy"
              ? order.breakdown.inAmount
              : order.breakdown.outAmount;
        } else if (order.orderType == "Convert") {
          orderAmountInUSD = usdAmount;
        }
        console.log("Order AMOUNT", orderAmountInUSD);
        if (orderAmountInUSD < 50) {
          return {
            status: 200,
            data: {
              message:
                "No rewards added to this order as order amount is less 50 USD",
              rewardAmount: 0,
            },
          };
        } else {
          let rewardAmountToAdd =
            orderAmountInUSD * (appSettings.data.value / 100);
          let getUserRewards = await rewardService.findOne({ email: email });
          let newRewards = rewardAmountToAdd + getUserRewards.totalRewards;
          console.log("new rewards", newRewards, "TO ADD", rewardAmountToAdd);
          if (getUserRewards) {
            let updateReward = await rewardService.updatePart(
              { "user.email": email },
              {
                $set: {
                  totalRewards: newRewards,
                  rewardTokenBalanceInUSD: newRewards * 0.1,
                },
              }
            );
            if (updateReward) {
              const message = "rewardAdded";
              return { status: 200, data: message };
            } else {
              const message = "errorWhileAddingReward";
              return { status: 500, data: message };
            }
          } else {
            let newReward = {
              userId: user._id,
              email: user.email,
              referralCode: "Reward for order",
              totalRewards: rewardAmountToAdd,
              rewardCurrency: "Indexx Exchange Token",
              rewardTokenBalanceInUSD: rewardAmountToAdd * 0.1,
              rewardUpdatedOn: new Date(),
              rewardTokenPrice: 0.1,
              rewardCurrencySymbol: "INEX",
              rewardCurrencyDecimals: 18,
              rewardTokenAddress: "",
            };
            let addReward = await rewardService.create(newReward);
            if (addReward) {
              const message = "rewardAdded";
              return { status: 200, data: message };
            } else {
              const message = "errorWhileAddingReward";
              return { status: 500, data: message };
            }
          }
        }
      } else {
        const message = "No order or user found";
        return { status: 500, data: message };
      }
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}

export async function checkHasReferralCode(
  email: string,
  orderId: string,
  usdAmount: number = 0
) {
  try {
    let getUser = await uservice.findOne({ email: email });
    if (getUser) {
      if (getUser.referralCode) {
        let getReferralUser = await uservice.findOne({
          referralCode: getUser.referralCode,
        });
        if (getReferralUser) {
          let resRewards = await addRewards(
            getReferralUser.email,
            orderId,
            usdAmount
          );
          console.log(resRewards);
        }
      }
    } else {
      return { status: 500, data: "User not found" };
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}

async function getConvertOrderAmountINUSD(order: Order) {
  try {
    if (order.orderType == "Convert" && order.status == "Completed") {
      let orderAmountInUSD = 0;
      if (order.breakdown.inCurrenyName == "BTC") {
        let btcRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "BTC"
        );
        let btcRateInUSD = (btcRate.data.buyPrice + btcRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * btcRateInUSD;
      } else if (order.breakdown.inCurrenyName == "LTC") {
        let ltcRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "LTC"
        );
        let ltcRateInUSD = (ltcRate.data.buyPrice + ltcRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * ltcRateInUSD;
      } else if (order.breakdown.inCurrenyName == "ETH") {
        let ethRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "ETH"
        );
        let ethRateInUSD = (ethRate.data.buyPrice + ethRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * ethRateInUSD;
      } else if (order.breakdown.inCurrenyName == "IN500") {
        let in500Rate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "IN500"
        );
        let in500RateInUSD =
          (in500Rate.data.buyPrice + in500Rate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * in500RateInUSD;
      } else if (order.breakdown.inCurrenyName == "INXC") {
        let inxcRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "INXC"
        );
        let inxcRateInUSD =
          (inxcRate.data.buyPrice + inxcRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * inxcRateInUSD;
      } else if (order.breakdown.inCurrenyName == "IUSD+") {
        let iusdRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "IUSD+"
        );
        let iusdRateInUSD =
          (iusdRate.data.buyPrice + iusdRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * iusdRateInUSD;
      } else if (order.breakdown.inCurrenyName == "BNB") {
        let bnbRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "BNB"
        );
        let bnbRateInUSD = (bnbRate.data.buyPrice + bnbRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * bnbRateInUSD;
      } else if (order.breakdown.inCurrenyName == "BUSD") {
        let busdRate = await currencyService.getCurrencyPriceByType(
          "Crypto",
          "BUSD"
        );
        let busdRateInUSD =
          (busdRate.data.buyPrice + busdRate.data.sellPrice) / 2;
        orderAmountInUSD = order.breakdown.inAmount * busdRateInUSD;
      } else {
        return 0;
      }
      return orderAmountInUSD;
    } else {
      return 0;
    }
  } catch (err) {
    return 0;
  }
}

export async function checkAndUpdateFirstTimeTranactionPoints(order: Order) {
  try {
    if (order.orderType == "Buy" && order.status == "Completed") {
      let getUser = await uservice.findOne({ _id: order.user.userId });
      if (getUser) {
        let getTaskCenterDetails = await taskCenterService.findOne({
          email: getUser.email,
        });
        if (
          getTaskCenterDetails &&
          getTaskCenterDetails.isTransactionCompletedInExchange
        ) {
        } else if (
          getTaskCenterDetails &&
          !getTaskCenterDetails.isTransactionCompletedInExchange
        ) {
          if (
            order.breakdown.inCurrenyName.includes("I") &&
            !getTaskCenterDetails.isBuyIndexxTokens
          ) {
            let pointHistoryObjArr = [];
            let pointsHistoryObj = {
              email: getUser.email,
              points: buyIndexxTokensPoints,
              type: "Buy Indexx Token Points",
              date: new Date(),
            };
            let pointsHistoryObj2 = {
              email: getUser.email,
              points: transactionPoints,
              type: "First transaction Points",
              date: new Date(),
            };
            pointHistoryObjArr.push(pointsHistoryObj, pointsHistoryObj2);
            let updateTaskCenter = await taskCenterService.updatePart(
              { email: getUser.email },
              {
                $set: {
                  isTransactionCompletedInExchange: true,
                  transactionPoints: transactionPoints,
                  isBuyIndexxTokens: true,
                  isBuyIndexxTokensPoints: buyIndexxTokensPoints,
                  totalPoint:
                    getTaskCenterDetails.totalPoints +
                    buyIndexxTokensPoints +
                    transactionPoints,
                },
                $push: {
                  pointsHistory: pointHistoryObjArr,
                },
              }
            );
          } else {
            let pointHistoryObjArr = [];
            let pointsHistoryObj = {
              email: getUser.email,
              points: transactionPoints,
              type: "First transaction Points",
              date: new Date(),
            };
            pointHistoryObjArr.push(pointsHistoryObj);
            let updateTaskCenter = await taskCenterService.updatePart(
              { email: getUser.email },
              {
                $set: {
                  isTransactionCompletedInExchange: true,
                  transactionPoints: transactionPoints,
                },
                $push: {
                  pointsHistory: pointHistoryObjArr,
                },
              }
            );
          }
        } else {
          if (
            order.breakdown.inCurrenyName.includes("I") &&
            !getTaskCenterDetails.isBuyIndexxTokens
          ) {
            let pointHistoryObjArr = [];
            let pointsHistoryObj = {
              email: getUser.email,
              points: buyIndexxTokensPoints,
              type: "Buy Indexx Token Points",
              date: new Date(),
            };

            pointHistoryObjArr.push(pointsHistoryObj);
            let updateTasCenterForIndexxTokens =
              await taskCenterService.updatePart(
                {
                  email: getUser.email,
                },
                {
                  $set: {
                    isBuyIndexxTokens: true,
                    isBuyIndexxTokensPoints: buyIndexxTokensPoints,
                    totalPoint:
                      getTaskCenterDetails.totalPoints + buyIndexxTokensPoints,
                  },
                  $push: {
                    pointsHistory: pointHistoryObjArr,
                  },
                }
              );
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}
