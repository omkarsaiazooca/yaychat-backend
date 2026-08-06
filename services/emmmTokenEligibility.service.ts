import { PaymentTypes } from "../data/common";
import { OrderStatus } from "../data/order";
import { getPriceByName } from "../controllers/priceAPI";
import { OrderService } from "./order.service";
import { PaypalService } from "./paypal.service";
import { AlchemyService } from "./alchemy.service";
import { UserService } from "./user.service";

export type EmmmPaymentToken = "BTCY" | "INEX" | "WIBS";

const SUPPORTED_TOKENS = new Set<EmmmPaymentToken>(["BTCY", "INEX", "WIBS"]);
const COMPLETED_PAYPAL_STATUSES = ["COMPLETED"];
const ELIGIBLE_PAYMENT_TYPES = new Set(
  [PaymentTypes.Paypal, PaymentTypes.Stripe, "Paypal", "PayPal", "Stripe", "EMMMRefund"].map((value) =>
    String(value).toUpperCase()
  )
);
const ELIGIBLE_STABLECOIN_PAYMENT_CURRENCIES = new Set(["USDT", "USDC"]);
const USAGE_REFERENCE_PREFIX = "emmm-trade-";

const orderService = new OrderService();
const paypalService = new PaypalService();
const alchemyService = new AlchemyService();
const userService = new UserService();

const TOKEN_NETWORKS: Record<EmmmPaymentToken, string> = {
  BTCY: "Ying Yang Chain",
  INEX: "Binance Smart Chain",
  WIBS: "Ethereum",
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeToken(value: unknown): EmmmPaymentToken {
  const token = String(value || "").trim().toUpperCase() as EmmmPaymentToken;
  if (!SUPPORTED_TOKENS.has(token)) {
    throw new Error("Unsupported EMMM payment token");
  }
  return token;
}

function normalizeOrderStatus(status: unknown) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isCancelledStatus(status: unknown) {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "ordercancelled" ||
    normalized === "expired"
  );
}

function getOrderEventTime(record: any) {
  const candidates = [
    record?.orderCompletedOn,
    record?.completedAt,
    record?.created,
    record?.createdAt,
    record?.modified,
    record?.startedAt,
  ];

  for (const candidate of candidates) {
    const time = new Date(candidate as any).getTime();
    if (Number.isFinite(time)) return time;
  }

  return 0;
}

function getPositiveTokenAmount(order: any, pathName: "inAmount" | "outAmount") {
  const amount = Number(order?.breakdown?.[pathName] || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isEligiblePaymentType(order: any) {
  const paymentType = String(order?.paymentType || "").toUpperCase();
  return ELIGIBLE_PAYMENT_TYPES.has(paymentType);
}

function isEligibleStablecoinFundedBuy(order: any) {
  const inCurrency = String(
    order?.breakdown?.inCurrenyName ||
      order?.breakdown?.inCurrencyName ||
      order?.currency ||
      ""
  ).toUpperCase();
  return ELIGIBLE_STABLECOIN_PAYMENT_CURRENCIES.has(inCurrency);
}

function isEligibleBuyOrder(order: any, paypalLinkedOrderIds: Set<string>) {
  const orderId = String(order?.orderId || "").trim();
  return (
    isEligiblePaymentType(order) ||
    isEligibleStablecoinFundedBuy(order) ||
    paypalLinkedOrderIds.has(orderId)
  );
}

async function getCompletedPaypalLinkedOrderIds(orderIds: string[]) {
  if (!orderIds.length) return new Set<string>();

  const paypalPayments = await paypalService.find({
    orderId: { $in: orderIds },
    status: { $in: COMPLETED_PAYPAL_STATUSES },
  });

  return new Set(
    paypalPayments
      .map((payment: any) => String(payment?.orderId || "").trim())
      .filter(Boolean)
  );
}

async function getTokenPrice(token: EmmmPaymentToken) {
  const response = await getPriceByName(token);
  const price = Number(response?.data || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function getTokenNetwork(token: EmmmPaymentToken) {
  return TOKEN_NETWORKS[token];
}

async function getTokenWalletBalance(email: string, token: EmmmPaymentToken) {
  const network = getTokenNetwork(token);
  const user = await userService.findOneSelect(
    { email },
    { userWallets: 1 }
  );
  const wallet = (user as any)?.userWallets?.find(
    (item: any) =>
      String(item?.coinSymbol || "").toUpperCase() === token &&
      String(item?.coinNetwork || "") === network
  );
  const balance = Number(wallet?.coinBalance ?? 0);
  return {
    tokenNetwork: network,
    walletBalance: Number.isFinite(balance) && balance > 0 ? balance : 0,
  };
}

async function ensureTokenWallet(email: string, token: EmmmPaymentToken) {
  const network = getTokenNetwork(token);
  const created = await orderService.checkAndCreateUserWallet(
    email,
    token,
    false,
    network
  );

  if (!created) {
    throw new Error(`${token} wallet is not available`);
  }

  return network;
}

async function updateUserTokenWallet({
  email,
  token,
  amount,
  direction,
}: {
  email: string;
  token: EmmmPaymentToken;
  amount: number;
  direction: "credit" | "debit";
}) {
  const network = await ensureTokenWallet(email, token);
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Token amount must be greater than 0");
  }

  const walletMatch: any = {
    coinSymbol: token,
    coinNetwork: network,
  };
  if (direction === "debit") {
    walletMatch.coinBalance = { $gte: amountNum };
  }

  const updateRes: any = await userService.updatePart(
    {
      email,
      userWallets: {
        $elemMatch: walletMatch,
      },
    },
    {
      $inc: {
        "userWallets.$.coinBalance":
          direction === "debit" ? -amountNum : amountNum,
      },
      $set: { "userWallets.$.coinLastUsedOn": new Date() },
    }
  );

  const modified =
    updateRes?.modifiedCount ?? updateRes?.nModified ?? updateRes?.n ?? 0;
  if (!modified) {
    throw new Error(
      direction === "debit"
        ? `Insufficient ${token} wallet balance`
        : `${token} wallet update failed`
    );
  }

  return network;
}

async function buildTokenAllowance({ email, token }: { email: string; token: EmmmPaymentToken }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const completedBuyOrders = await orderService.find({
    orderType: "Buy",
    status: OrderStatus.Completed,
    "user.email": normalizedEmail,
    "breakdown.outCurrencyName": token,
  });

  const completedBuyOrderIds = completedBuyOrders
    .map((order: any) => String(order?.orderId || "").trim())
    .filter(Boolean);
  const paypalLinkedOrderIds = await getCompletedPaypalLinkedOrderIds(completedBuyOrderIds);

  const events: Array<{ type: "credit" | "usage"; amount: number; at: number }> = [];
  let purchasedAmount = 0;

  for (const order of completedBuyOrders) {
    if (!isEligibleBuyOrder(order, paypalLinkedOrderIds)) continue;

    const amount = getPositiveTokenAmount(order, "outAmount");
    if (amount <= 0) continue;

    purchasedAmount += amount;
    events.push({ type: "credit", amount, at: getOrderEventTime(order) });
  }

  let alchemyCompletedAmount = 0;
  if (token === "BTCY") {
    const completedAlchemySessions = await alchemyService.find({
      email: normalizedEmail,
      status: "completed",
      $or: [
        { withdrawalType: { $exists: false } },
        { withdrawalType: null },
        { withdrawalType: "" },
        {
          withdrawalType: {
            $nin: ["solana", "tron", "SOLANA", "TRON", "Solana", "Tron"],
          },
        },
      ],
    });

    for (const session of completedAlchemySessions) {
      const amount = Number(session?.resultAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      alchemyCompletedAmount += amount;
      events.push({ type: "credit", amount, at: getOrderEventTime(session) });
    }
  }

  const usedOrders = await orderService.find({
    "user.email": normalizedEmail,
    $or: [
      {
        orderType: "Sell",
        status: { $nin: [OrderStatus.OrderCancelled, "Cancelled", "Canceled", "Expired"] },
        "breakdown.inCurrenyName": token,
      },
      {
        orderType: "Convert",
        status: OrderStatus.Completed,
        "breakdown.inCurrenyName": token,
      },
      {
        orderType: "EMMMTrade",
        status: OrderStatus.Completed,
        "breakdown.inCurrenyName": token,
      },
    ],
  });

  for (const order of usedOrders) {
    if (isCancelledStatus(order?.status)) continue;
    const amount = getPositiveTokenAmount(order, "inAmount");
    if (amount <= 0) continue;
    events.push({ type: "usage", amount, at: getOrderEventTime(order) });
  }

  events.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    return a.type === "credit" ? -1 : 1;
  });

  let remainingAmount = 0;
  let usedAmount = 0;
  for (const event of events) {
    if (event.type === "credit") {
      remainingAmount += event.amount;
      continue;
    }

    const consumedAmount = Math.min(remainingAmount, event.amount);
    remainingAmount -= consumedAmount;
    usedAmount += consumedAmount;
  }

  const tokenPrice = await getTokenPrice(token);
  const totalEligibleAmount = purchasedAmount + alchemyCompletedAmount;
  const ledgerRemainingAmount = Math.max(0, remainingAmount);
  const wallet = await getTokenWalletBalance(normalizedEmail, token);
  const usableAmount = Math.min(ledgerRemainingAmount, wallet.walletBalance);

  return {
    email: normalizedEmail,
    token,
    tokenNetwork: wallet.tokenNetwork,
    eligible: usableAmount > 0,
    usableAmount,
    remainingAmount: usableAmount,
    ledgerRemainingAmount,
    walletBalance: wallet.walletBalance,
    tokenPrice,
    usdBuyingPower: tokenPrice > 0 ? usableAmount * tokenPrice : 0,
    purchasedAmount,
    alchemyCompletedAmount,
    usedAmount,
    totalEligibleAmount,
    usableBtcy: token === "BTCY" ? usableAmount : undefined,
    btcyPrice: token === "BTCY" ? tokenPrice : undefined,
  };
}

export async function getTokenEligibilityForEmmm(params: { email: string; token: string }) {
  return buildTokenAllowance({
    email: params.email,
    token: normalizeToken(params.token),
  });
}

export async function debitTokenForEmmm(params: {
  email: string;
  token: string;
  tokenAmount: number;
  externalReferenceId?: string;
  notes?: string;
}) {
  const token = normalizeToken(params.token);
  const email = normalizeEmail(params.email);
  const amount = Number(params.tokenAmount);
  if (!email || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valid email and token amount are required");
  }

  const eligibility = await buildTokenAllowance({ email, token });
  if (Number(eligibility.remainingAmount || 0) < amount) {
    throw new Error(`Insufficient eligible ${token}`);
  }

  const orderId = String(params.externalReferenceId || `${USAGE_REFERENCE_PREFIX}${Date.now()}`);
  const tokenNetwork = await updateUserTokenWallet({
    email,
    token,
    amount,
    direction: "debit",
  });

  try {
    await orderService.create({
      orderId,
      orderType: "EMMMTrade",
      status: OrderStatus.Completed,
      paymentType: "EMMM",
      currency: token,
      amount,
      user: { email },
      breakdown: {
        inCurrenyName: token,
        inAmount: amount,
        outCurrencyName: "EMMM",
        outAmount: 0,
        finalAmountAfterDiscount: 0,
      },
      receiverAccount: {
        userReceiveAddress: "EMMM",
        userReceiveName: "EMMM",
      },
      blockchainName: tokenNetwork,
      comments: params.notes || "EMMM trade token debit",
      created: new Date(),
      orderCompletedOn: new Date(),
    } as any);
  } catch (err) {
    await updateUserTokenWallet({
      email,
      token,
      amount,
      direction: "credit",
    });
    throw err;
  }

  return {
    email,
    token,
    tokenNetwork,
    tokenDebited: amount,
    externalReferenceId: orderId,
    eligibility: await buildTokenAllowance({ email, token }),
  };
}

export async function creditTokenForEmmm(params: {
  email: string;
  token: string;
  tokenAmount: number;
  externalReferenceId?: string;
  notes?: string;
}) {
  const token = normalizeToken(params.token);
  const email = normalizeEmail(params.email);
  const amount = Number(params.tokenAmount);
  if (!email || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valid email and token amount are required");
  }

  const orderId = String(params.externalReferenceId || `${USAGE_REFERENCE_PREFIX}refund-${Date.now()}`);
  const tokenNetwork = await updateUserTokenWallet({
    email,
    token,
    amount,
    direction: "credit",
  });

  try {
    await orderService.create({
      orderId,
      orderType: "Buy",
      status: OrderStatus.Completed,
      paymentType: "EMMMRefund",
      currency: "EMMM",
      amount,
      user: { email },
      breakdown: {
        inCurrenyName: "EMMM",
        inAmount: 0,
        outCurrencyName: token,
        outAmount: amount,
        finalAmountAfterDiscount: 0,
      },
      receiverAccount: {
        userReceiveAddress: tokenNetwork,
        userReceiveName: `${token} Wallet`,
      },
      blockchainName: tokenNetwork,
      comments: params.notes || "EMMM trade token credit",
      created: new Date(),
      orderCompletedOn: new Date(),
    } as any);
  } catch (err) {
    await updateUserTokenWallet({
      email,
      token,
      amount,
      direction: "debit",
    });
    throw err;
  }

  return {
    email,
    token,
    tokenNetwork,
    tokenCredited: amount,
    externalReferenceId: orderId,
    eligibility: await buildTokenAllowance({ email, token }),
  };
}
