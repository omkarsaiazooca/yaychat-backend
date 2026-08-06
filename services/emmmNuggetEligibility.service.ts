import { getPriceByName } from "../controllers/priceAPI";
import { UserService } from "./user.service";
import { UserMiningBalanceService } from "./userMiningBalance.service";
import { OrderService } from "./order.service";
import { OrderStatus } from "../data/order";

const BTCY_COIN_SYMBOL = "BTCY";
const NUGGET_COIN_NETWORK = "Stellar";          // nuggets live on Stellar wallet entry
// Must match the threshold configured in emmm-backend btcyNuggetsService.js
const NUGGET_MIN_TOTAL_MINED = Number(process.env.NUGGET_MIN_TOTAL_MINED || 10000);
const NUGGET_MAX_BET_AMOUNT = Number(process.env.NUGGET_MAX_BET_AMOUNT || 5000);
const NUGGET_MAX_BET_USD = Number(process.env.NUGGET_MAX_BET_USD || 25);
const EMMM_NUGGET_DEBIT_REF_PREFIX = "emmm-nugget-";

const userService = new UserService();
const userMiningBalanceService = new UserMiningBalanceService();
const orderService = new OrderService();

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function getBtcyPrice(): Promise<number> {
  const response = await getPriceByName(BTCY_COIN_SYMBOL);
  const price = Number(response?.data || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

// Returns user's nugget balance (available for betting) and lifetime migrated balance.
// Nuggets are stored in userWallets where coinSymbol="BTCY" and coinNetwork="Stellar".
// migratedBalance from userMiningBalance is used as the threshold gate (how much has been
// migrated to real tokens — a reliable proxy for committed mining activity).
async function getUserNuggetData(email: string) {
  const [userDoc, miningBalanceDoc] = await Promise.all([
    userService.findOneSelect({ email }, { userWallets: 1 }),
    userMiningBalanceService.findOne({ email, coinSymbol: BTCY_COIN_SYMBOL }),
  ]);

  const nuggetWallet = (userDoc as any)?.userWallets?.find(
    (w: any) =>
      String(w?.coinSymbol || "").toUpperCase() === BTCY_COIN_SYMBOL &&
      String(w?.coinNetwork || "") === NUGGET_COIN_NETWORK
  );

  return {
    nuggetBalance: Number(nuggetWallet?.coinBalance ?? 0),
    totalMined: Number((miningBalanceDoc as any)?.migratedBalance ?? 0),
  };
}

// Returns the total nuggets already debited for emmm bets (for audit/display).
async function getUsedNuggets(email: string): Promise<number> {
  const usedOrders = await orderService.find({
    "user.email": email,
    orderType: "EMMMNuggetBet",
    status: OrderStatus.Completed,
  });

  return usedOrders.reduce((sum: number, order: any) => {
    const amount = Number(order?.breakdown?.inAmount || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

export async function getNuggetEligibilityForEmmm(params: { email: string }) {
  const email = normalizeEmail(params.email);
  if (!email) throw new Error("Email is required");

  const [{ nuggetBalance, totalMined }, nuggetPrice] = await Promise.all([
    getUserNuggetData(email),
    getBtcyPrice(),
  ]);

  const meetsThreshold = totalMined >= NUGGET_MIN_TOTAL_MINED;
  const usdCapNuggets = nuggetPrice > 0 ? Math.floor(NUGGET_MAX_BET_USD / nuggetPrice) : NUGGET_MAX_BET_AMOUNT;
  const maxBetNuggets = Math.min(nuggetBalance, NUGGET_MAX_BET_AMOUNT, usdCapNuggets);

  return {
    email,
    eligible: meetsThreshold && nuggetBalance > 0,
    meetsThreshold,
    reason: !meetsThreshold
      ? `You need to mine at least ${NUGGET_MIN_TOTAL_MINED.toLocaleString()} BTCY Nuggets total to play on Emmm. You've mined ${totalMined.toLocaleString()} so far.`
      : nuggetBalance <= 0
      ? "Your BTCY Nugget balance is empty. Keep mining to accumulate nuggets."
      : null,
    nuggetBalance,
    totalMined,
    // tokenPrice is the BTCY price — nuggets share the same peg as BTCY
    tokenPrice: nuggetPrice,
    nuggetPrice,
    maxBetNuggets,
    maxBetUsd: NUGGET_MAX_BET_USD,
    minTotalMined: NUGGET_MIN_TOTAL_MINED,
  };
}

export async function debitNuggetsForEmmm(params: {
  email: string;
  nuggetAmount: number;
  externalReferenceId?: string;
  notes?: string;
}) {
  const email = normalizeEmail(params.email);
  const amount = Number(params.nuggetAmount);

  if (!email || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valid email and nugget amount are required");
  }

  // Re-check eligibility before debiting
  const eligibility = await getNuggetEligibilityForEmmm({ email });
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Not eligible to bet with BTCY Nuggets");
  }
  if (amount > eligibility.nuggetBalance) {
    throw new Error(`Insufficient nugget balance. Available: ${eligibility.nuggetBalance}, requested: ${amount}`);
  }
  if (amount > eligibility.maxBetNuggets) {
    throw new Error(
      `Nugget bet of ${amount} exceeds the allowed cap of ${eligibility.maxBetNuggets} (max ${NUGGET_MAX_BET_AMOUNT} nuggets or $${NUGGET_MAX_BET_USD} USD).`
    );
  }

  // Atomically debit nuggets from userWallets (coinSymbol=BTCY, coinNetwork=Stellar).
  // $gte guard on coinBalance ensures concurrent calls can't over-spend.
  const updateRes: any = await userService.updatePart(
    {
      email,
      userWallets: {
        $elemMatch: {
          coinSymbol: BTCY_COIN_SYMBOL,
          coinNetwork: NUGGET_COIN_NETWORK,
          coinBalance: { $gte: amount },
        },
      },
    },
    {
      $inc: { "userWallets.$.coinBalance": -amount },
      $set: { "userWallets.$.coinLastUsedOn": new Date() },
    }
  );

  const modified = updateRes?.modifiedCount ?? updateRes?.nModified ?? updateRes?.n ?? 0;
  if (!modified) {
    throw new Error("Insufficient BTCY Nugget balance or concurrent debit conflict. Please try again.");
  }

  const orderId = String(
    params.externalReferenceId || `${EMMM_NUGGET_DEBIT_REF_PREFIX}${Date.now()}`
  );

  // Record the debit as an order so it's auditable and shows in history
  try {
    await orderService.create({
      orderId,
      orderType: "EMMMNuggetBet",
      status: OrderStatus.Completed,
      paymentType: "EMMM",
      currency: "BTCY_NUGGETS",
      amount,
      user: { email },
      breakdown: {
        inCurrenyName: "BTCY_NUGGETS",
        inAmount: amount,
        outCurrencyName: "EMMM",
        outAmount: 0,
        finalAmountAfterDiscount: 0,
      },
      receiverAccount: {
        userReceiveAddress: "EMMM",
        userReceiveName: "EMMM",
      },
      blockchainName: "Bitcoin-Yay Mining",
      comments: params.notes || "EMMM nugget bet debit",
      created: new Date(),
      orderCompletedOn: new Date(),
    } as any);
  } catch (recordErr: any) {
    // Roll back the debit if we can't record it
    await userService.updatePart(
      {
        email,
        userWallets: {
          $elemMatch: { coinSymbol: BTCY_COIN_SYMBOL, coinNetwork: NUGGET_COIN_NETWORK },
        },
      },
      { $inc: { "userWallets.$.coinBalance": amount } }
    );
    throw new Error(`Nugget debit record failed, rolled back: ${recordErr.message}`);
  }

  const updatedUser = await userService.findOneSelect({ email }, { userWallets: 1 });
  const updatedWallet = (updatedUser as any)?.userWallets?.find(
    (w: any) =>
      String(w?.coinSymbol || "").toUpperCase() === BTCY_COIN_SYMBOL &&
      String(w?.coinNetwork || "") === NUGGET_COIN_NETWORK
  );

  return {
    email,
    nuggetDebited: amount,
    nuggetBalance: Number(updatedWallet?.coinBalance ?? 0),
    externalReferenceId: orderId,
    nuggetPrice: eligibility.nuggetPrice,
  };
}
