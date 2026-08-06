import { UserService } from "../services/user.service";
import { OrderService } from "../services/order.service";
import { OrderStatus } from "../data/order";
import { PaymentTypes } from "../data/common";
import { SellConfigService } from "../services/sellConfig.service";
import { KycStatus } from "../data/kycApplication";
import { KybStatus } from "../data/kybApplication";
import { SendEmail } from "./email.operations";
import { KycApplicationService } from "../services/kycApplication.service";
import { KybApplicationService } from "../services/kybApplication.service";
import { PaypalService } from "../services/paypal.service";
import { AlchemyService } from "../services/alchemy.service";
import {
  getBtcyToStablecoinRate,
  sendStablecoinToUserSolana,
  sendStablecoinToUserEVM,
  sendStablecoinToUserBinance,
  SendStablecoinResult,
} from "../services/sell.service";

const userService = new UserService();
const orderService = new OrderService();
const paypalService = new PaypalService();
const sellConfigService = new SellConfigService();
const alchemyService = new AlchemyService();
const kycApplicationService = new KycApplicationService();
const kybApplicationService = new KybApplicationService();
const BTCY_COIN_SYMBOL = "BTCY";
const BTCY_YING_YANG_NETWORK = "Ying Yang Chain";
const MIN_SELL_RECEIVE_AMOUNT_USDT = 10;
const BTCY_SELL_RESERVED_NOTE = "BTCY debited from user wallet at sell order creation.";
const BTCY_ALLOWED_SELL_BUY_PAYMENT_TYPES = [
  "USDT",
  "USDC",
  PaymentTypes.Paypal,
  PaymentTypes.Stripe,
  "Paypal",
  "Stripe",
];
const SELL_MIN_USD = 10;
const COMPLETED_PAYPAL_STATUSES = ["COMPLETED"];
const MIN_STATION_OWNER_REFERRALS = 25;

const KYC_REVIEW_MESSAGE =
  "Your KYC is in review. Please wait 1-3 business days for your KYC approval.";
const STATION_OWNER_GATE_MESSAGE =
  "Only mining station owners with 25 or more referrals can sell BTCY.";

function isEligibleStationOwnerForSell(user: any): boolean {
  const referralCount = Array.isArray(user?.relationships)
    ? user.relationships.length
    : 0;
  return referralCount >= MIN_STATION_OWNER_REFERRALS;
}

type KycGateStatus = "approved" | "pending" | "missing";

async function resolveKycGateStatus(user: any): Promise<KycGateStatus> {
  if (!user) return "missing";

  const userId = user?._id?.toString ? user._id.toString() : user?._id;
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
    const kycOr: any[] = [];
    if (userId) kycOr.push({ userId });
    if (emailLower) {
      kycOr.push({ userEmailLower: emailLower });
      kycOr.push({ userEmail: emailLower });
    }

    const kybOr: any[] = [];
    if (userId) kybOr.push({ userId });
    if (emailLower) {
      kybOr.push({ userEmail: emailLower });
    }

    const [latestKyc, latestKyb] = await Promise.all([
      kycOr.length ? kycApplicationService.findLatest({ $or: kycOr }) : null,
      kybOr.length ? kybApplicationService.findLatest({ $or: kybOr }) : null,
    ]);

    if (
      latestKyc?.status === KycStatus.APPROVED ||
      latestKyb?.status === KybStatus.APPROVED
    ) {
      return "approved";
    }

    if (
      (latestKyc &&
        [KycStatus.DRAFT, KycStatus.PENDING, KycStatus.UNDER_REVIEW].includes(
          latestKyc.status
        )) ||
      (latestKyb &&
        [KybStatus.DRAFT, KybStatus.PENDING, KybStatus.UNDER_REVIEW].includes(
          latestKyb.status
        ))
    ) {
      return "pending";
    }

    const hasApplication = !!latestKyc || !!latestKyb;

    if (
      hasApplication &&
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
    console.error("KYC check failed:", err);
    return "missing";
  }
}

export function calculateUSDAmount(
  btcyAmount: number,
  btcyPrice: number
): number {
  return btcyAmount * btcyPrice;
}

async function debitUserBtcyYingYangBalance(email: string, amount: number) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  const amountNum = Number(amount);

  if (!normalizedEmail || !Number.isFinite(amountNum) || amountNum <= 0) {
    return { status: 400, data: { message: "Missing BTCY debit details" } };
  }

  const updateRes: any = await userService.updatePart(
    {
      email: normalizedEmail,
      userWallets: {
        $elemMatch: {
          coinSymbol: BTCY_COIN_SYMBOL,
          coinNetwork: BTCY_YING_YANG_NETWORK,
          coinBalance: { $gte: amountNum },
        },
      },
    },
    {
      $inc: { "userWallets.$.coinBalance": -amountNum },
      $set: { "userWallets.$.coinLastUsedOn": new Date() },
    }
  );

  const modified =
    updateRes?.modifiedCount ?? updateRes?.nModified ?? updateRes?.n ?? 0;

  const user = await userService.findOneSelect(
    { email: normalizedEmail },
    { userWallets: 1 }
  );

  if (!user) {
    return { status: 404, data: { message: "email Not Registered" } };
  }

  const wallet = (user as any).userWallets?.find(
    (w: any) =>
      w?.coinSymbol === BTCY_COIN_SYMBOL &&
      w?.coinNetwork === BTCY_YING_YANG_NETWORK
  );

  if (!wallet) {
    return { status: 404, data: { message: "wallet Not Registered" } };
  }

  if (!modified) {
    return {
      status: 400,
      data: {
        message: "insufficientBalance",
        balance: wallet.coinBalance,
      },
    };
  }

  return {
    status: 200,
    data: {
      email: normalizedEmail,
      coinSymbol: BTCY_COIN_SYMBOL,
      coinNetwork: BTCY_YING_YANG_NETWORK,
      debited: amountNum,
      balance: wallet.coinBalance,
    },
  };
}

async function creditUserBtcyYingYangBalance(email: string, amount: number) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  const amountNum = Number(amount);

  if (!normalizedEmail || !Number.isFinite(amountNum) || amountNum <= 0) {
    return;
  }

  await userService.updatePart(
    {
      email: normalizedEmail,
      userWallets: {
        $elemMatch: {
          coinSymbol: BTCY_COIN_SYMBOL,
          coinNetwork: BTCY_YING_YANG_NETWORK,
        },
      },
    },
    {
      $inc: { "userWallets.$.coinBalance": amountNum },
      $set: { "userWallets.$.coinLastUsedOn": new Date() },
    }
  );
}

function normalizeOrderStatus(status: any) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isCancelledStatus(status: any) {
  const normalized = normalizeOrderStatus(status);
  return normalized === "cancelled" || normalized === "ordercancelled";
}

function uniqueOrdersByOrderId(orders: any[]) {
  const byOrderId = new Map<string, any>();
  for (const order of orders) {
    const orderId = String(order?.orderId || "").trim();
    if (!orderId || byOrderId.has(orderId)) {
      continue;
    }
    byOrderId.set(orderId, order);
  }
  return Array.from(byOrderId.values());
}

function isBtcySellReserved(order: any) {
  return String(order?.notes || "").includes(BTCY_SELL_RESERVED_NOTE);
}

function getOrderEventTime(order: any) {
  const candidates = [
    order?.orderCompletedOn,
    order?.completedAt,
    order?.created,
    order?.createdAt,
    order?.modified,
  ];

  for (const candidate of candidates) {
    const time = new Date(candidate).getTime();
    if (Number.isFinite(time)) {
      return time;
    }
  }

  return 0;
}

function getPositiveBtcyAmount(order: any, path: "inAmount" | "outAmount") {
  const amount = Number(order?.breakdown?.[path] || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getSellFeePercent(sellConfig: any) {
  const configuredFeePercent = Number(sellConfig?.dailyFeePercent);
  return Number.isFinite(configuredFeePercent) && configuredFeePercent >= 0
    ? configuredFeePercent
    : 3;
}

function roundStableAmount(amount: number) {
  return Number(amount.toFixed(12));
}

function getSellPayoutAmount(order: any) {
  const candidates = [
    order?.breakdown?.netAmount,
    order?.breakdown?.finalAmountAfterDiscount,
    order?.breakdown?.totalPayable,
    order?.breakdown?.outAmount,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return 0;
}

function getUserDisplayName(user: any) {
  const name = [user?.firstName, user?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  return name || "there";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getBtcySellEligibility(email: string) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) {
    return {
      eligible: false,
      purchasedAmount: 0,
      alchemyCompletedAmount: 0,
      totalEligibleAmount: 0,
      usedAmount: 0,
      remainingAmount: 0,
    };
  }

  const directlyEligibleBuys = await orderService.find({
    "user.email": normalizedEmail,
    orderType: "Buy",
    status: OrderStatus.Completed,
    "breakdown.outCurrencyName": BTCY_COIN_SYMBOL,
    $or: [
      { "breakdown.inCurrenyName": { $in: ["USDT", "USDC"] } },
      { currency: { $in: ["USDT", "USDC"] } },
      { paymentType: { $in: BTCY_ALLOWED_SELL_BUY_PAYMENT_TYPES } },
    ],
  });

  const completedBtcyBuyOrders = await orderService.find({
    "user.email": normalizedEmail,
    orderType: "Buy",
    status: OrderStatus.Completed,
    "breakdown.outCurrencyName": BTCY_COIN_SYMBOL,
  });

  const completedBtcyBuyOrderIds = completedBtcyBuyOrders
    .map((order: any) => String(order?.orderId || "").trim())
    .filter(Boolean);

  const completedPaypalForUserOrders = completedBtcyBuyOrderIds.length
    ? await paypalService.find({
        orderId: { $in: completedBtcyBuyOrderIds },
        status: { $in: COMPLETED_PAYPAL_STATUSES },
      })
    : [];
  const completedPaypalForUserOrderIds = new Set(
    completedPaypalForUserOrders
      .map((paypalOrder: any) => String(paypalOrder?.orderId || "").trim())
      .filter(Boolean)
  );

  const completedPaypalOrders = await paypalService.find({
    payerEmail: normalizedEmail,
    status: { $in: COMPLETED_PAYPAL_STATUSES },
  });

  const paypalOrderIds = completedPaypalOrders
    .map((paypalOrder: any) => String(paypalOrder?.orderId || "").trim())
    .filter(Boolean);

  const completedPaypalBtcyBuys = paypalOrderIds.length
    ? await orderService.find({
        orderId: { $in: paypalOrderIds },
        orderType: "Buy",
        status: OrderStatus.Completed,
        "breakdown.outCurrencyName": BTCY_COIN_SYMBOL,
      })
    : [];

  const eligibleBuyOrders = uniqueOrdersByOrderId([
    ...directlyEligibleBuys,
    ...completedBtcyBuyOrders.filter((order: any) =>
      completedPaypalForUserOrderIds.has(String(order?.orderId || "").trim())
    ),
    ...completedPaypalBtcyBuys,
  ]);

  const purchasedAmount = eligibleBuyOrders.reduce(
    (sum, order: any) => sum + getPositiveBtcyAmount(order, "outAmount"),
    0
  );

  const completedAlchemySessions = await alchemyService.find({
    email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
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

  const alchemyCompletedAmount = completedAlchemySessions.reduce(
    (sum: number, session: any) => {
      const amount = Number(session?.resultAmount || 0);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    },
    0
  );

  const usedOrders = await orderService.find({
    "user.email": normalizedEmail,
    $or: [
      {
        orderType: "Sell",
        status: { $nin: [OrderStatus.OrderCancelled, "Cancelled", "Expired"] },
        "breakdown.inCurrenyName": BTCY_COIN_SYMBOL,
      },
      {
        orderType: "Convert",
        status: OrderStatus.Completed,
        "breakdown.inCurrenyName": BTCY_COIN_SYMBOL,
      },
    ],
  });

  const eligibilityEvents = [
    ...eligibleBuyOrders.map((order: any) => ({
      type: "buy" as const,
      at: getOrderEventTime(order),
      amount: getPositiveBtcyAmount(order, "outAmount"),
      orderId: String(order?.orderId || ""),
    })),
    ...completedAlchemySessions.map((session: any) => ({
      type: "alchemy" as const,
      at: getOrderEventTime({
        orderCompletedOn: session?.completedAt,
        created: session?.startedAt,
      }),
      amount: Number(session?.resultAmount || 0),
      orderId: String(session?.sessionId || ""),
    })),
    ...usedOrders.map((order: any) => ({
      type: "usage" as const,
      at: getOrderEventTime(order),
      amount: isCancelledStatus(order?.status)
        ? 0
        : getPositiveBtcyAmount(order, "inAmount"),
      orderId: String(order?.orderId || ""),
    })),
  ]
    .filter((event) => event.amount > 0)
    .sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at;
      if (a.type === b.type) return a.orderId.localeCompare(b.orderId);
      const aPriority = a.type === "usage" ? 1 : 0;
      const bPriority = b.type === "usage" ? 1 : 0;
      return aPriority - bPriority;
    });

  let remainingAmount = 0;
  let usedAmount = 0;

  for (const event of eligibilityEvents) {
    if (event.type === "buy" || event.type === "alchemy") {
      remainingAmount += event.amount;
      continue;
    }

    const consumedAmount = Math.min(remainingAmount, event.amount);
    remainingAmount -= consumedAmount;
    usedAmount += consumedAmount;
  }

  remainingAmount = Math.max(0, remainingAmount);
  const totalEligibleAmount = purchasedAmount + alchemyCompletedAmount;

  return {
    eligible: totalEligibleAmount > 0 && remainingAmount > 0,
    purchasedAmount,
    alchemyCompletedAmount,
    totalEligibleAmount,
    usedAmount,
    remainingAmount,
  };
}

async function sendSellOrderCompletedEmails(order: any, txHash: string) {
  try {
    await new SendEmail().sendBtcySellOrderCompleted({
      userEmail: order.user?.email || "",
      userName: getUserDisplayName(order.user),
      orderId: order.orderId,
      btcyAmount: Number(order.breakdown?.inAmount || 0),
      usdtAmount: getSellPayoutAmount(order),
      walletAddress: order.receiverAccount?.userReceiveAddress || "",
      transactionHash: txHash,
      completedAt: order.orderCompletedOn || new Date(),
    });
  } catch (err) {
    console.error("Failed to send BTCY sell order completed email:", err);
  }

  await new SendEmail().sendAccountsOrderCompleted({
    userEmail: order.user?.email || "",
    orderId: order.orderId,
    orderType: order.orderType,
    paymentType: String(order.paymentType || ""),
    inAmount: order.breakdown?.inAmount,
    inCurrency: order.breakdown?.inCurrenyName,
    outAmount: getSellPayoutAmount(order),
    outCurrency: order.breakdown?.outCurrencyName,
    status: order.status,
    exchangeName: order.exchangeName,
    blockchainName: order.blockchainName,
    completedAt: order.orderCompletedOn || new Date(),
    notes: order.notes || order.comments || "",
  });
}

export async function getSellBtcyEligibility(email: string) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) {
    return {
      status: 400,
      data: {
        email: normalizedEmail,
        canCreateSellOrder: false,
        sellAllowanceEligible: false,
        kycStatus: "missing",
        serviceStatus: "UNKNOWN",
        purchasedAmount: 0,
        alchemyCompletedAmount: 0,
        totalEligibleAmount: 0,
        usedAmount: 0,
        remainingAmount: 0,
        message: "Email is required.",
      },
    };
  }

  const [user, sellConfig, sellEligibility] = await Promise.all([
    userService.findOne({ email: normalizedEmail }),
    sellConfigService.getAdminConfig(),
    getBtcySellEligibility(normalizedEmail),
  ]);

  if (!user) {
    return {
      status: 404,
      data: {
        email: normalizedEmail,
        canCreateSellOrder: false,
        sellAllowanceEligible: sellEligibility.eligible,
        kycStatus: "missing",
        serviceStatus: sellConfig?.status || "UNKNOWN",
        purchasedAmount: sellEligibility.purchasedAmount,
        alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
        totalEligibleAmount: sellEligibility.totalEligibleAmount,
        usedAmount: sellEligibility.usedAmount,
        remainingAmount: sellEligibility.remainingAmount,
        message: "User not found.",
      },
    };
  }

  const kycGate = await resolveKycGateStatus(user);
  const isStationOwner = isEligibleStationOwnerForSell(user);
  const baseData = {
    email: normalizedEmail,
    canCreateSellOrder: false,
    sellAllowanceEligible: sellEligibility.eligible,
    kycStatus: kycGate,
    isStationOwner,
    serviceStatus: sellConfig?.status || "UNKNOWN",
    purchasedAmount: sellEligibility.purchasedAmount,
    alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
    totalEligibleAmount: sellEligibility.totalEligibleAmount,
    usedAmount: sellEligibility.usedAmount,
    remainingAmount: sellEligibility.remainingAmount,
  };

  if (kycGate !== "approved") {
    return {
      status: 200,
      data: {
        ...baseData,
        message:
          kycGate === "pending"
            ? KYC_REVIEW_MESSAGE
            : "User not allowed to place order. Please complete KYC first",
      },
    };
  }

  if (!isStationOwner) {
    return {
      status: 200,
      data: {
        ...baseData,
        message: STATION_OWNER_GATE_MESSAGE,
      },
    };
  }

  if (!sellConfig) {
    return {
      status: 200,
      data: {
        ...baseData,
        message: "Sell config not found.",
      },
    };
  }

  if (sellConfig.status === "CLOSED") {
    return {
      status: 200,
      data: {
        ...baseData,
        message:
          sellConfig.unavailableMessage ||
          "The sell service is temporarily unavailable.",
      },
    };
  }

  if (!sellEligibility.eligible) {
    if (sellEligibility.totalEligibleAmount > 0) {
      return {
        status: 200,
        data: {
          ...baseData,
          message:
            "No eligible BTCY remaining to sell. Prior BTCY sell/convert usage has already consumed the eligible BTCY allowance.",
        },
      };
    }

    return {
      status: 200,
      data: {
        ...baseData,
        message:
          "Only users with completed BTCY buys via USDT/USDC/PayPal/Stripe or completed Alchemy session credits can sell BTCY.",
      },
    };
  }

  return {
    status: 200,
    data: {
      ...baseData,
      canCreateSellOrder: true,
      message: "User is eligible to create sell orders.",
    },
  };
}

export async function getBtcyEmmmEligibilityStatus(email: string) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) {
    return {
      status: 400,
      data: { message: "Email is required." },
    };
  }

  const sellEligibility = await getBtcySellEligibility(normalizedEmail);
  const btcyPrice = await getBtcyToStablecoinRate();
  const usableBtcy = Number(sellEligibility.remainingAmount || 0);
  const usdBuyingPower =
    Number.isFinite(btcyPrice) && btcyPrice > 0
      ? Number((usableBtcy * btcyPrice).toFixed(8))
      : 0;

  return {
    status: 200,
    data: {
      email: normalizedEmail,
      source: "EMMM",
      coinSymbol: BTCY_COIN_SYMBOL,
      coinNetwork: BTCY_YING_YANG_NETWORK,
      eligible: sellEligibility.eligible,
      purchasedAmount: sellEligibility.purchasedAmount,
      alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
      totalEligibleAmount: sellEligibility.totalEligibleAmount,
      usedAmount: sellEligibility.usedAmount,
      remainingAmount: sellEligibility.remainingAmount,
      usableBtcy,
      btcyPrice,
      usdBuyingPower,
    },
  };
}

export async function createSellBtcyOrder(input: any) {
  const {
    email,
    btcyAmount,
    receiveCurrency,
    destinationWallet,
    network,
  } = input;
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  const [user, sellConfig] = await Promise.all([
    userService.findOne({ email: normalizedEmail }),
    sellConfigService.getAdminConfig(),
  ]);

  if (!user) {
    return { status: 404, data: { message: "User not found" } };
  }

  const kycGate = await resolveKycGateStatus(user);
  if (kycGate !== "approved") {
    return {
      status: 403,
      data: {
        message:
          kycGate === "pending"
            ? KYC_REVIEW_MESSAGE
            : "User not allowed to place order. Please complete KYC first",
      },
    };
  }

  if (!isEligibleStationOwnerForSell(user)) {
    return {
      status: 403,
      data: { message: STATION_OWNER_GATE_MESSAGE },
    };
  }

  const sellEligibility = await getBtcySellEligibility(normalizedEmail);
  if (!sellEligibility.eligible) {
    if (sellEligibility.totalEligibleAmount > 0) {
      return {
        status: 400,
        data: {
          message:
            "No eligible BTCY remaining to sell. Prior BTCY sell/convert usage has already consumed the eligible BTCY allowance.",
          purchasedAmount: sellEligibility.purchasedAmount,
          alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
          totalEligibleAmount: sellEligibility.totalEligibleAmount,
          usedAmount: sellEligibility.usedAmount,
          remainingAmount: sellEligibility.remainingAmount,
        },
      };
    }
    return {
      status: 403,
      data: {
        message:
          "Only users with completed BTCY buys via USDT/USDC/PayPal/Stripe or completed Alchemy session credits can sell BTCY.",
      },
    };
  }

  const requestedBtcyAmount = Number(btcyAmount);
  if (!Number.isFinite(requestedBtcyAmount) || requestedBtcyAmount <= 0) {
    return {
      status: 400,
      data: { message: "BTCY amount must be greater than 0." },
    };
  }

  const rate = await getBtcyToStablecoinRate();
  const grossReceiveAmount = roundStableAmount(
    calculateUSDAmount(requestedBtcyAmount, rate)
  );

  if (
    !Number.isFinite(grossReceiveAmount) ||
    grossReceiveAmount < MIN_SELL_RECEIVE_AMOUNT_USDT
  ) {
    return {
      status: 400,
      data: {
        message: `Minimum sell amount is ${MIN_SELL_RECEIVE_AMOUNT_USDT} USDT.`,
        grossReceiveAmount,
        rate,
      },
    };
  }

  if (requestedBtcyAmount > sellEligibility.remainingAmount) {
    return {
      status: 400,
      data: {
        message: `Sell amount exceeds eligible BTCY limit. You can sell up to ${sellEligibility.remainingAmount} BTCY.`,
        purchasedAmount: sellEligibility.purchasedAmount,
        alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
        totalEligibleAmount: sellEligibility.totalEligibleAmount,
        usedAmount: sellEligibility.usedAmount,
        remainingAmount: sellEligibility.remainingAmount,
      },
    };
  }

  if (sellConfig?.status === "CLOSED") {
    return {
      status: 403,
      data: {
        message:
          sellConfig.unavailableMessage ||
          "The sell service is temporarily unavailable.",
      },
    };
  }

  const feePercent = getSellFeePercent(sellConfig);
  const feeAmount = roundStableAmount(
    grossReceiveAmount * (feePercent / 100)
  );
  const netReceiveAmount = roundStableAmount(
    Math.max(0, grossReceiveAmount - feeAmount)
  );

  const orderId = `CRYPTO_SELL${Date.now()}`;

  const orderData: any = {
    orderId,
    user: {
      userId: user._id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    },
    status: OrderStatus.Pending,
    orderType: "Sell",
    orderRate: { currency: "BTCY", rate: rate },
    paymentType: "CRYPTO",
    exchangeFees: feePercent,
    breakdown: {
      inCurrenyName: "BTCY",
      inAmount: requestedBtcyAmount,
      feePercent,
      feeAmount,
      netAmount: netReceiveAmount,
      totalPayable: netReceiveAmount,
      outCurrencyName: receiveCurrency,
      outAmount: grossReceiveAmount,
      finalAmountAfterDiscount: netReceiveAmount,
    },
    receiverAccount: {
      userReceiveAddress: destinationWallet,
      userReceiveName: `${receiveCurrency} Wallet`,
    },
    created: new Date(),
    blockchainName: network,
    comments: `Sell order: ${requestedBtcyAmount} BTCY to ${grossReceiveAmount} ${receiveCurrency} on ${network}; final payout ${netReceiveAmount} ${receiveCurrency} after ${feePercent}% fee`,
    notes: BTCY_SELL_RESERVED_NOTE,
  };

  let createdOrder: any;
  try {
    createdOrder = await orderService.create(orderData);
  } catch (err) {
    throw err;
  }

  const debitResult = await debitUserBtcyYingYangBalance(
    normalizedEmail,
    requestedBtcyAmount
  );
  if (debitResult.status !== 200) {
    try {
      await orderService.updatePart(
        { orderId: createdOrder.orderId },
        {
          $set: {
            status: "Cancelled",
            notes: `${createdOrder.notes || ""}\nBalance reservation failed: ${debitResult.data?.message || "Unable to debit BTCY"}`.trim(),
          },
        }
      );
    } catch (err) {
      console.error("Failed to cancel sell order after BTCY debit failure:", err);
    }
    return debitResult;
  }

  try {
    await new SendEmail().sendBtcySellOrderReceived({
      userEmail: normalizedEmail,
      userName: getUserDisplayName(user),
      orderId: createdOrder.orderId,
      btcyAmount: requestedBtcyAmount,
      usdtAmount: netReceiveAmount,
      walletAddress: destinationWallet,
      submittedAt: createdOrder.created || new Date(),
    });
  } catch (err) {
    console.error("Failed to send BTCY sell order received email:", err);
  }

  return {
    status: 200,
    data: {
      orderId: createdOrder.orderId,
      feePercent,
      feeAmount,
      grossReceiveAmount,
      netReceiveAmount,
      rate,
      message: "Sell request submitted successfully.",
    },
  };
}

export async function debitBtcyForEmmm(input: {
  email: string;
  btcyAmount: number;
  externalReferenceId?: string;
  notes?: string;
}) {
  const normalizedEmail = String(input?.email || "")
    .toLowerCase()
    .trim();
  const requestedBtcyAmount = Number(input?.btcyAmount);
  const externalReferenceId = String(input?.externalReferenceId || "").trim();
  const notes = String(input?.notes || "").trim();
  const now = new Date();

  if (
    !normalizedEmail ||
    !Number.isFinite(requestedBtcyAmount) ||
    requestedBtcyAmount <= 0
  ) {
    return { status: 400, data: { message: "Missing EMMM BTCY debit details" } };
  }

  if (externalReferenceId) {
    const existingOrder = await orderService.findOne({
      merchantName: "EMMM",
      merchantReferenceId: externalReferenceId,
      orderType: "Sell",
    });

    if (existingOrder) {
      return {
        status: 200,
        data: {
          idempotent: true,
          orderId: existingOrder.orderId,
          email: existingOrder.user?.email,
          source: "EMMM",
          externalReferenceId,
          btcyDebited: existingOrder.breakdown?.inAmount || 0,
          btcyPrice: existingOrder.orderRate?.rate || 0,
          sourceAmount: existingOrder.breakdown?.outAmount || 0,
          status: existingOrder.status,
          message: "EMMM BTCY debit was already processed.",
        },
      };
    }
  }

  const user = await userService.findOne({ email: normalizedEmail });
  if (!user) {
    return { status: 404, data: { message: "User not found" } };
  }

  const sellEligibility = await getBtcySellEligibility(normalizedEmail);
  if (!sellEligibility.eligible) {
    return {
      status: sellEligibility.totalEligibleAmount > 0 ? 400 : 403,
      data: {
        message:
          sellEligibility.totalEligibleAmount > 0
            ? "No eligible BTCY remaining. Prior BTCY sell/convert/external usage has already consumed the eligible BTCY allowance."
            : "Only users with completed BTCY buys via USDT/USDC/PayPal/Stripe or completed Alchemy session credits can use BTCY for EMMM.",
        purchasedAmount: sellEligibility.purchasedAmount,
        alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
        totalEligibleAmount: sellEligibility.totalEligibleAmount,
        usedAmount: sellEligibility.usedAmount,
        remainingAmount: sellEligibility.remainingAmount,
      },
    };
  }

  if (requestedBtcyAmount > sellEligibility.remainingAmount) {
    return {
      status: 400,
      data: {
        message: `BTCY amount exceeds eligible limit. User can use up to ${sellEligibility.remainingAmount} BTCY.`,
        purchasedAmount: sellEligibility.purchasedAmount,
        alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
        totalEligibleAmount: sellEligibility.totalEligibleAmount,
        usedAmount: sellEligibility.usedAmount,
        remainingAmount: sellEligibility.remainingAmount,
      },
    };
  }

  const btcyPrice = await getBtcyToStablecoinRate();
  if (!Number.isFinite(btcyPrice) || btcyPrice <= 0) {
    return { status: 500, data: { message: "Unable to resolve BTCY price" } };
  }

  const sourceAmount = Number((requestedBtcyAmount * btcyPrice).toFixed(8));
  const orderId = `EMMM_BTCY${Date.now()}`;
  const orderData: any = {
    orderId,
    user: {
      userId: user._id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    },
    status: OrderStatus.Completed,
    orderType: "Sell",
    orderRate: { currency: "BTCY", rate: btcyPrice },
    paymentType: "EMMM",
    merchantName: "EMMM",
    merchantReferenceId: externalReferenceId || orderId,
    merchantStatus: "EMMM Completed",
    exchangeFees: 0,
    breakdown: {
      inCurrenyName: "BTCY",
      inAmount: requestedBtcyAmount,
      feePercent: 0,
      feeAmount: 0,
      netAmount: sourceAmount,
      totalPayable: sourceAmount,
      outCurrencyName: "EMMM",
      outAmount: sourceAmount,
      finalAmountAfterDiscount: sourceAmount,
    },
    receiverAccount: {
      userReceiveAddress: "EMMM",
      userReceiveName: "EMMM",
    },
    created: now,
    orderCompletedOn: now,
    blockchainName: BTCY_YING_YANG_NETWORK,
    comments: `EMMM debit: ${requestedBtcyAmount} BTCY at ${btcyPrice} = ${sourceAmount} EMMM source value`,
    notes:
      notes ||
      "BTCY debited from Ying Yang Chain for EMMM using sell eligibility allowance.",
  };

  const debitResult = await debitUserBtcyYingYangBalance(
    normalizedEmail,
    requestedBtcyAmount
  );
  if (debitResult.status !== 200) {
    return debitResult;
  }

  let createdOrder: any;
  try {
    createdOrder = await orderService.create(orderData);
  } catch (err) {
    await creditUserBtcyYingYangBalance(normalizedEmail, requestedBtcyAmount);
    throw err;
  }

  return {
    status: 200,
    data: {
      orderId: createdOrder.orderId,
      email: normalizedEmail,
      source: "EMMM",
      externalReferenceId: createdOrder.merchantReferenceId,
      coinSymbol: BTCY_COIN_SYMBOL,
      coinNetwork: BTCY_YING_YANG_NETWORK,
      btcyDebited: requestedBtcyAmount,
      btcyPrice,
      sourceCurrency: "EMMM",
      sourceAmount,
      purchasedAmount: sellEligibility.purchasedAmount,
      alchemyCompletedAmount: sellEligibility.alchemyCompletedAmount,
      totalEligibleAmount: sellEligibility.totalEligibleAmount,
      usedAmountBeforeDebit: sellEligibility.usedAmount,
      remainingEligibleBeforeDebit: sellEligibility.remainingAmount,
      remainingEligibleAfterDebit: Number(
        Math.max(0, sellEligibility.remainingAmount - requestedBtcyAmount).toFixed(12)
      ),
      walletBalance: debitResult.data?.balance,
      message: "BTCY debited for EMMM successfully.",
    },
  };
}

export async function creditBtcyForEmmm(input: {
  email: string;
  btcyAmount: number;
  externalReferenceId: string;
  notes?: string;
}) {
  const normalizedEmail = String(input?.email || "")
    .toLowerCase()
    .trim();
  const btcyAmount = Number(input?.btcyAmount);
  const externalReferenceId = String(input?.externalReferenceId || "").trim();
  const notes = String(input?.notes || "").trim();
  const now = new Date();

  if (
    !normalizedEmail ||
    !Number.isFinite(btcyAmount) ||
    btcyAmount <= 0 ||
    !externalReferenceId
  ) {
    return { status: 400, data: { message: "Missing EMMM BTCY credit details" } };
  }

  const existingOrder = await orderService.findOne({
    merchantName: "EMMM",
    merchantReferenceId: externalReferenceId,
    orderType: "Deposit",
  });

  if (existingOrder) {
    return {
      status: 200,
      data: {
        idempotent: true,
        orderId: existingOrder.orderId,
        email: existingOrder.user?.email,
        source: "EMMM",
        externalReferenceId,
        btcyCredited: existingOrder.breakdown?.outAmount || 0,
        status: existingOrder.status,
        message: "EMMM BTCY credit was already processed.",
      },
    };
  }

  const user = await userService.findOne({ email: normalizedEmail });
  if (!user) {
    return { status: 404, data: { message: "User not found" } };
  }

  await creditUserBtcyYingYangBalance(normalizedEmail, btcyAmount);

  const orderId = `EMMM_BTCY_CREDIT${Date.now()}`;
  const orderData: any = {
    orderId,
    user: {
      userId: user._id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    },
    status: OrderStatus.Completed,
    orderType: "Deposit",
    orderRate: { currency: "BTCY", rate: 1 },
    paymentType: "EMMM",
    merchantName: "EMMM",
    merchantReferenceId: externalReferenceId,
    merchantStatus: "EMMM BTCY Credit Completed",
    exchangeFees: 0,
    breakdown: {
      inCurrenyName: "EMMM",
      inAmount: btcyAmount,
      feePercent: 0,
      feeAmount: 0,
      netAmount: btcyAmount,
      totalPayable: btcyAmount,
      outCurrencyName: BTCY_COIN_SYMBOL,
      outAmount: btcyAmount,
      finalAmountAfterDiscount: btcyAmount,
    },
    receiverAccount: {
      userReceiveAddress: BTCY_YING_YANG_NETWORK,
      userReceiveName: "BTCY Ying Yang Wallet",
    },
    created: now,
    orderCompletedOn: now,
    blockchainName: BTCY_YING_YANG_NETWORK,
    comments: `EMMM credit: ${btcyAmount} BTCY credited to Ying Yang Chain wallet`,
    notes:
      notes ||
      "BTCY credited to Ying Yang Chain wallet from EMMM payout/refund.",
  };

  let createdOrder: any;
  try {
    createdOrder = await orderService.create(orderData);
  } catch (err) {
    await debitUserBtcyYingYangBalance(normalizedEmail, btcyAmount);
    throw err;
  }

  return {
    status: 200,
    data: {
      orderId: createdOrder.orderId,
      email: normalizedEmail,
      source: "EMMM",
      externalReferenceId,
      coinSymbol: BTCY_COIN_SYMBOL,
      coinNetwork: BTCY_YING_YANG_NETWORK,
      btcyCredited: btcyAmount,
      message: "BTCY credited from EMMM successfully.",
    },
  };
}

export async function approveSellOrder(orderId: string) {
  // 1. FETCH ORDER & CONFIG
  const [order, sellConfig] = await Promise.all([
    orderService.findOne({ orderId }),
    sellConfigService.getAdminConfig(),
  ]);

  if (!order) {
    return { status: 404, data: { message: "Order not found" } };
  }

  if (order.status === OrderStatus.Completed) {
    return { status: 400, data: { message: "Order is already completed" } };
  }
  if (isCancelledStatus(order.status)) {
    return { status: 400, data: { message: "Order is already cancelled" } };
  }

  if (isCancelledStatus(order.status)) {
    return { status: 400, data: { message: "Cancelled order cannot be approved" } };
  }

  if (sellConfig?.status === "CLOSED") {
    return {
      status: 403,
      data: {
        message:
          sellConfig.unavailableMessage ||
          "The sell service is temporarily unavailable.",
      },
    };
  }

  const inAmount = order.breakdown?.inAmount || 0;
  const orderRate = Number(order?.orderRate?.rate || 0);
  const rateForMinimumCheck =
    Number.isFinite(orderRate) && orderRate > 0
      ? orderRate
      : await getBtcyToStablecoinRate();
  const orderUsdAmount = calculateUSDAmount(inAmount, rateForMinimumCheck);
  if (orderUsdAmount < SELL_MIN_USD) {
    return {
      status: 400,
      data: {
        message: `Minimum sell amount is $${SELL_MIN_USD} USD.`,
        minUsdRequired: SELL_MIN_USD,
        requestedUsdAmount: Number(orderUsdAmount.toFixed(8)),
      },
    };
  }

  const toAddress = order.receiverAccount?.userReceiveAddress;
  const amount = getSellPayoutAmount(order);
  const currency = order.breakdown?.outCurrencyName;
  const blockchain = order.blockchainName;
  const userEmail = String(order.user?.email || "")
    .toLowerCase()
    .trim();
  const btcyAmount = Number(order.breakdown?.inAmount || 0);
  const normalizedBlockchain = String(blockchain || "").toLowerCase();

  if (!toAddress || !amount || !currency || !userEmail || !btcyAmount) {
    return {
      status: 400,
      data: { message: "Missing payout or BTCY debit details in order" },
    };
  }

  if (!["solana", "ethereum", "binance"].includes(normalizedBlockchain)) {
    return {
      status: 400,
      data: { message: `Unsupported blockchain: ${blockchain}` },
    };
  }

  const reservedAtCreation = isBtcySellReserved(order);
  if (!reservedAtCreation) {
    const debitResult = await debitUserBtcyYingYangBalance(userEmail, btcyAmount);
    if (debitResult.status !== 200) {
      return debitResult;
    }
  }

  // 2. TRIGGER REAL CRYPTO TRANSFER (Remains the same)
  let txResult: SendStablecoinResult;
  if (normalizedBlockchain === "solana") {
    txResult = await sendStablecoinToUserSolana(toAddress, amount, currency);
  } else if (normalizedBlockchain === "binance") {
    txResult = await sendStablecoinToUserBinance(toAddress, amount, currency);
  } else {
    txResult = await sendStablecoinToUserEVM(
      toAddress,
      amount,
      currency,
      normalizedBlockchain as "ethereum" | "binance"
    );
  }

  if (!txResult.success) {
    await creditUserBtcyYingYangBalance(userEmail, btcyAmount);
    await orderService.updatePart(
      { orderId },
      {
        $set: {
          status: "Cancelled",
          notes: `${order.notes || ""}\nPayout failed and reserved BTCY was returned: ${txResult.error || ""}`.trim(),
        },
      }
    );
    return {
      status: 500,
      data: { message: "Failed to send funds on-chain", error: txResult.error },
    };
  }

  // 3. UPDATE DATABASE
  await orderService.updatePart(
    { orderId },
    {
      status: OrderStatus.Completed,
      orderCompletedOn: new Date(),
      transactionHash: txResult.txHash,
      notes: `Payout TxHash: ${txResult.txHash}`,
    }
  );
  const getNewDetails = await orderService.findOne({ orderId });

  // 4. SEND EMAILS
  await sendSellOrderCompletedEmails(getNewDetails, txResult.txHash || "");

  return {
    status: 200,
    data: {
      message: "Sell order approved & funds sent on-chain",
      txHash: txResult.txHash,
    },
  };
}

export async function completeSellOrderManually(input: {
  orderId: string;
  txHash?: string;
  notes?: string;
}) {
  const orderId = String(input?.orderId || "").trim();
  const txHash = String(input?.txHash || "").trim();
  const adminNotes = String(input?.notes || "").trim();

  const order = await orderService.findOne({ orderId });
  if (!order) {
    return { status: 404, data: { message: "Order not found" } };
  }

  if (order.status === OrderStatus.Completed) {
    return { status: 400, data: { message: "Order is already completed" } };
  }

  if (isCancelledStatus(order.status)) {
    return { status: 400, data: { message: "Cancelled order cannot be completed" } };
  }

  if (
    order.orderType !== "Sell" ||
    String(order.breakdown?.inCurrenyName || "").toUpperCase() !== BTCY_COIN_SYMBOL
  ) {
    return {
      status: 400,
      data: { message: "Only BTCY sell orders can be completed by this API" },
    };
  }

  const userEmail = String(order.user?.email || "")
    .toLowerCase()
    .trim();
  const btcyAmount = Number(order.breakdown?.inAmount || 0);
  const payoutAmount = getSellPayoutAmount(order);
  const walletAddress = order.receiverAccount?.userReceiveAddress;

  if (!userEmail || !btcyAmount || !payoutAmount || !walletAddress) {
    return {
      status: 400,
      data: { message: "Missing payout or BTCY debit details in order" },
    };
  }

  if (!isBtcySellReserved(order)) {
    return {
      status: 400,
      data: {
        message:
          "BTCY was not reserved on this order. Manual complete will not debit BTCY automatically.",
      },
    };
  }

  const completedAt = new Date();
  const completionNote = [
    order.notes || "",
    txHash ? `Payout TxHash: ${txHash}` : "Payout completed manually",
    adminNotes ? `Admin notes: ${adminNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  await orderService.updatePart(
    { orderId },
    {
      $set: {
        status: OrderStatus.Completed,
        orderCompletedOn: completedAt,
        transactionHash: txHash,
        notes: completionNote,
      },
    }
  );

  const completedOrder = await orderService.findOne({ orderId });
  await sendSellOrderCompletedEmails(completedOrder, txHash);

  return {
    status: 200,
    data: {
      message: "Sell order marked completed and completion email sent",
      orderId,
      txHash,
    },
  };
}

export async function getSellBtcyOrderStatus(orderId: string) {
  const order = await orderService.findOne({ orderId });
  if (!order) return { status: 404, data: { message: "Order not found" } };
  return {
    status: 200,
    data: { orderId: order.orderId, status: order.status, notes: order.notes },
  };
}

export async function cancelSellBtcyOrder(orderId: string, email: string) {
  const order = await orderService.findOne({ orderId });
  if (!order || order.user.email !== email.toLowerCase())
    return { status: 403, data: { message: "Unauthorized" } };

  if (order.status === OrderStatus.Completed) {
    return { status: 400, data: { message: "Completed order cannot be cancelled" } };
  }

  if (isCancelledStatus(order.status)) {
    return { status: 200, data: { message: "Order already cancelled" } };
  }

  if (isBtcySellReserved(order)) {
    await creditUserBtcyYingYangBalance(
      String(order.user?.email || "").toLowerCase(),
      Number(order.breakdown?.inAmount || 0)
    );
  }

  await orderService.updatePart(
    { orderId },
    {
      $set: {
        status: "Cancelled",
        notes: `${order.notes || ""}\nSell order cancelled; reserved BTCY returned to user wallet.`.trim(),
      },
    }
  );
  return { status: 200, data: { message: "Order cancelled" } };
}
