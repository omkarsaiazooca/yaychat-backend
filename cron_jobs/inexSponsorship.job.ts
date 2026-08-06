import { monthSlot, scheduleExactlyOnce } from "../helpers/scheduleExactlyOnce";
import { UserService } from "../services/user.service";
import { StakingService } from "../services/staking.service";
import { TransactionService } from "../services/transaction.service";
import { WalletOperations } from "../platform/wallet.operations";
import { SendEmail } from "../platform/email.operations";
import { OrderStatus } from "../data/order";
import { Staking } from "../data/staking";
import { v1 as uuidv1 } from "uuid";

const TARGET_EMAIL = "indigo.pickleball@gmail.com";
const REPORT_RECIPIENT = "omkar@azooca.com";
const MONTHLY_USD = 200;
const APR = 0; // percent
const APR_DECIMAL = APR / 100;
const QUARTER_INCREMENT = 0.25; // USD per quarter
const BASE_QUARTER = { year: 2024, quarter: 4, price: 3.5 }; // Dec 2024 price

const userService = new UserService();
const stakingService = new StakingService();
const transactionService = new TransactionService();
const walletOps = new WalletOperations({} as any, {} as any);
const emailService = new SendEmail();

type YearMonth = { year: number; month: number };
type WalletSnapshot = {
  coinBalance: number;
  coinStakedBalance: number;
  amountInvested: number;
  coinPrice: number;
  lastUsedISO: string;
};

const toYearMonth = (d: Date): YearMonth => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
});

const priceForMonth = ({ year, month }: YearMonth): number => {
  const quarter = Math.floor((month - 1) / 3) + 1;
  const index = year * 4 + quarter - 1;
  const baseIndex = BASE_QUARTER.year * 4 + BASE_QUARTER.quarter - 1;
  const diff = index - baseIndex;
  const price = BASE_QUARTER.price + diff * QUARTER_INCREMENT;
  if (price <= 0) {
    throw new Error(`Calculated non-positive INEX price for ${year}-${month}: ${price}`);
  }
  return Number(price.toFixed(4));
};

const monthBounds = ({ year, month }: YearMonth) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, nextMonth };
};

const buildSnapshot = (wallet: any | undefined): WalletSnapshot => ({
  coinBalance: Number(wallet?.coinBalance ?? 0),
  coinStakedBalance: Number(wallet?.coinStakedBalance ?? 0),
  amountInvested: Number(wallet?.amountInvested ?? 0),
  coinPrice: Number(wallet?.coinPrice ?? 0),
  lastUsedISO: wallet?.coinLastUsedOn ? new Date(wallet.coinLastUsedOn).toISOString() : "N/A",
});

async function ensureInexWallet(email: string) {
  const user = await userService.findOne({ email });
  if (!user) {
    throw new Error(`User ${email} not found`);
  }
  const hasWallet = (user.userWallets || []).some((w: any) => w.coinSymbol === "INEX");
  if (!hasWallet) {
    await walletOps.createINEXWallet(email, "INEX", 0);
  }
}

async function createMonthlyGrant(targetMonth: YearMonth) {
  await ensureInexWallet(TARGET_EMAIL);

  const userBefore = await userService.findOne({ email: TARGET_EMAIL });
  if (!userBefore) {
    throw new Error(`User ${TARGET_EMAIL} not found after wallet ensure`);
  }

  const walletBefore = (userBefore.userWallets || []).find((w: any) => w.coinSymbol === "INEX");
  if (!walletBefore) {
    throw new Error("INEX wallet missing after ensure");
  }

  const beforeSnapshot = buildSnapshot(walletBefore);

  const price = priceForMonth(targetMonth);
  const tokens = Number((MONTHLY_USD / price).toFixed(8));
  const { start, nextMonth } = monthBounds(targetMonth);
  const monthLabel = start.toLocaleString("en-US", { month: "long", year: "numeric" });

  const existingStake = await stakingService.findOne({
    email: TARGET_EMAIL,
    coin: "INEX",
    startDate: { $gte: start, $lt: nextMonth },
  });

  const txId = `SPONSOR-${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`;
  const existingTx = await transactionService.findOne({ txId });

  let tokensAdded = 0;
  let usdAdded = 0;
  let transactionCreated = false;

  if (!existingStake) {
    const stake: Staking = {
      stakingId: uuidv1(),
      stakedAmount: tokens,
      rewardAmount: Number((tokens * APR_DECIMAL * 2).toFixed(8)),
      finalAmount: Number((tokens + tokens * APR_DECIMAL * 2).toFixed(8)),
      coin: "INEX",
      rewardCoin: "INEX",
      email: TARGET_EMAIL,
      percentage: APR_DECIMAL,
      startDate: start,
      endDate: new Date(Date.UTC(targetMonth.year + 2, targetMonth.month - 1, 1, 0, 0, 0)),
      isActive: true,
      type: "Long",
      duration: "2 years",
    };

    await stakingService.create(stake);
    tokensAdded += tokens;
    usdAdded += MONTHLY_USD;
    console.log(`[inex-sponsor] Staked ${tokens.toFixed(6)} INEX for ${TARGET_EMAIL} (${targetMonth.year}-${targetMonth.month}).`);
  } else {
    console.log(`[inex-sponsor] Skipping staking; already exists for ${targetMonth.year}-${targetMonth.month}.`);
  }

  if (!existingTx) {
    await transactionService.create({
      email: TARGET_EMAIL,
      orderId: uuidv1(),
      extRef: "",
      txId,
      from: "",
      to: TARGET_EMAIL,
      amount: tokens,
      exchangeName: "CEX",
      info: "INEX Monthly Sponsorship",
      status: OrderStatus.Completed,
      currencyRef: "INEX",
      walletType: "ASSET_WALLET",
      transactionType: "SALARY_COINS",
      txDate: start,
      benificaryAddress: walletBefore.coinWalletAddress || "",
      amountInvested: MONTHLY_USD,
      rate: price,
      notes: `${start.toLocaleString("en-US", { month: "short", year: "numeric" })} Sponsorship Tokens`,
    });
    transactionCreated = true;
    console.log(`[inex-sponsor] Logged transaction ${txId} for ${TARGET_EMAIL}.`);
  } else {
    console.log(`[inex-sponsor] Transaction ${txId} already exists; skipping.`);
  }

  if (tokensAdded > 0 || usdAdded > 0) {
    await userService.updatePart(
      { email: TARGET_EMAIL, "userWallets.coinSymbol": "INEX" },
      {
        $inc: {
          "userWallets.$.coinStakedBalance": tokensAdded,
          "userWallets.$.amountInvested": usdAdded,
        },
        $set: {
          "userWallets.$.coinLastUsedOn": new Date(),
          "userWallets.$.coinPrice": price,
        },
      }
    );
  }

  const userAfter = await userService.findOne({ email: TARGET_EMAIL });
  const walletAfter = (userAfter?.userWallets || []).find((w: any) => w.coinSymbol === "INEX");
  const afterSnapshot = buildSnapshot(walletAfter);

  await emailService.sendInexSponsorshipReport(REPORT_RECIPIENT, {
    monthLabel,
    price,
    usdAmount: MONTHLY_USD,
    tokens,
    tokensAdded,
    usdAdded,
    transactionCreated,
    txId: transactionCreated ? txId : undefined,
    beforeSnapshot,
    afterSnapshot,
  });
}

export const setupInexSponsorshipJob = (redisClient: any, timezone = "Asia/Kolkata") => {
  scheduleExactlyOnce({
    cronExpr: "10 0 1 * *", // 00:10 on the 1st of every month
    jobName: "inex_sponsorship_auto",
    timezone,
    redis: redisClient,
    slotKeyFn: monthSlot,
    lockTtlMs: 10 * 60_000,
    run: async () => {
      const now = new Date();
      const currentMonth = toYearMonth(now);
      await createMonthlyGrant(currentMonth);
    },
  });
};

export const runInexSponsorshipForMonth = async (year: number, month: number) => {
  await createMonthlyGrant({ year, month });
};
