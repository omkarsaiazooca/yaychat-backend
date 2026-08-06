import express = require("express");
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

// Initialize MongoDB connections early
import "./db/connection";

import { basicRoute } from "./routes/basic.routes";
import { countryRoute } from "./routes/country.routes";
import { userkycRoutes } from "./routes/kyc.routes";
import { kycUserRoutes } from "./routes/kycUser.routes";
import { kycAdminRoutes } from "./routes/kycAdmin.routes";
import { kybUserRoutes } from "./routes/kybUser.routes";
import { kybAdminRoutes } from "./routes/kybAdmin.routes";
import { orderRoutes } from "./routes/order.routes";
import { paymentsRoute, paypalPaymentRoute } from "./routes/payment.routes";
import { authRoutes } from "./routes/user.routes";
import { walletRoute } from "./routes/wallet.routes";
import { transactionRoutes } from "./routes/txroutes";
import { dexRoutes } from "./routes/dex.routes";
import { sellRoute } from "./routes/sell.routes";
import { adminRoute } from "./routes/admin.routes";
import { shopRoute } from "./routes/shop.routes";
import { srtNFTRoute } from "./routes/sorekt.routes";
import { indexxWalletRoute } from "./routes/indexxwallet.routes";
import { xNFTRoutes } from "./routes/xnft.routes";
import { giftCardRoutes } from "./routes/gitcard.routes";
import { affiliateRoute } from "./routes/affiliate.routes";
import { daoRoute } from "./routes/daogopher.routes";
import { createClient } from "redis";
import { SendEmail } from "./platform/email.operations";
import { Queue } from "bull";
import Queue1 from "bull";
import { UserOperations } from "./platform/user.operations";
import { AffilateOperations } from "./platform/affilate.operations";
import { LotteryService } from "./services/lottery.service";
import { OrderOperations } from "./platform/order.operations";
import os from "os";
import { createUserWithEmailAndPasswordForWallet } from "./helpers/firebase";
import { createFirstTimeWallets } from "./helpers/createWallet";
import { UserService } from "./services/user.service";
import { TaskCenterService } from "./services/taskCenter.service";
import { signUpPoints, TaskCenter } from "./data/taskCenter";
import { WalletOperations } from "./platform/wallet.operations";
import { User, UserRoleTypes } from "./data/user";
import { AuthProviders, Currency } from "./data/common";
import { WalletUserService } from "./services/walletUser.service";
import { AffilateService } from "./services/affiliate.service";
import { createFreeGiftCard } from "./helpers/createShopGiftCard";
import { keys } from "./config/keys";
import axios from "axios";
import { CurrencyService } from "./services/currency.service";
import { OrderService } from "./services/order.service";
import http from "http";
import { MiningService } from "./services/mining.service";
import { miningRoute } from "./routes/mining.routes";
import { miningStationRoute } from "./routes/miningstation.routes";
import { vestingRoute } from "./routes/vesting.routes";
import { chatRoute } from "./routes/chat.routes";
import { ChatSocketService } from "./services/chatWebsocket.service";
import { aiInvestmentRoute } from "./routes/aiInvestment.routes";
import { alchemyRoute } from "./routes/alchemy.routes";
import { alchemyV2Route } from "./routes/alchemy.v2.routes";
import { alchemyPoolRoute } from "./routes/alchemyPool.routes";
import { btcyRewardRoute } from "./routes/btcyReward.routes";
import { notificationRoute } from "./routes/notfication.routes";
import { NotificationService } from "./services/notification.service";
import {
  daySlot,
  halfYearSlot,
  minuteSlot,
  monthSlot,
  quarterSlot,
  scheduleExactlyOnce,
} from "./helpers/scheduleExactlyOnce";
import { DailyMiningStatsService } from "./services/dailyMiningStats.service";
import { MiningCreditEventService } from "./services/miningCreditEvent.service";
import { dailyAdsRoute } from "./routes/dailyAds";
import { SubscriptionService } from "./services/subscription.service";
import { DailyAdStreakService } from "./services/dailyAdStreak.service";
import { AdMiningWatchService } from "./services/adMiningWatch.service";
import { UserMiningSessionService } from "./services/userMiningSession.service";
import { P2PCronService } from "./services/p2pCron.service";
import { adMiningWatchRoutes } from "./routes/adMiningWatch.routes";
import emmmBonusRouter from "./routes/emmmBonus.routes";
import { bitcoinyayAuditRoute } from "./routes/bitcoinyayAdAudit.routes";
import { bitcoinyaySubscriptionRoute } from "./routes/bitcoinyaySubscription.routes";
import { p2pRouter } from "./routes/p2p.routes";
import { smartCryptoSubscriptionRoute } from "./routes/smartCryptoSubscription.routes";
import { LinkedAccountService } from "./services/linkedAccount.service";
import { LinkedAccountBonusLogService } from "./services/linkedAccountBonusLog.service";
import { MiningStreakService } from "./services/miningStreak.service";
import { creditLinkedAccountBonus } from "./helpers/linkedAccountBonus";
import { emailValidationRoute } from "./routes/emailValidation.routes";
import { marketingEmailRoute } from "./routes/marketingEmail.routes";
import { whitelistRoute } from "./routes/whitelist.routes";
import { earningsRoute } from "./routes/earnings.routes";
import { shoperpalBtcyNuggetsRoute } from "./routes/shoperpalBtcyNuggets.routes";
import { socialCampaignRoute } from "./routes/socialCampaign.routes";
import { setupReferralMessageQueueProcessor } from "./services/referralMessageQueue.service";
const notificationService: NotificationService = new NotificationService();

export const emailQueue: Queue = new Queue1("sendEmail");
export const notificationQueue: Queue = new Queue1("admin-notifications", {
  redis: {
    port: Number(process.env.REDIS_PORT || 6379),
    host: process.env.REDIS_HOST || "127.0.0.1",
    password: process.env.REDIS_PASSWORD,
  },
});
//export const userTaskQueue: Queue = new Queue1("user-tasks");
const lotteryService: LotteryService = new LotteryService();
let uservice: UserService = new UserService();
let taskCenterService: TaskCenterService = new TaskCenterService();
let emailService: SendEmail = new SendEmail();
let wuserservice: WalletUserService = new WalletUserService();
let affilateService: AffilateService = new AffilateService();
let currencyService: CurrencyService = new CurrencyService();
let miningService: MiningService = new MiningService();
const orderService: OrderService = new OrderService();
const adMiningWatchService: AdMiningWatchService = new AdMiningWatchService();
const dailyStatsService = new DailyMiningStatsService();
const miningCreditEventService = new MiningCreditEventService();
const dailyAdStreakService = new DailyAdStreakService();
const subscriptionService = new SubscriptionService();
const userMiningSessionService = new UserMiningSessionService();
const p2pCronService = new P2PCronService();
const linkedAccountService = new LinkedAccountService();
const linkedAccountBonusLogService = new LinkedAccountBonusLogService();
const miningStreakService = new MiningStreakService();
const USER_STOP_LOCK_MS = 2 * 60_000;
const AD_EXTEND_THRESHOLD = 7;
// Keep this aligned with mining/ad-watch endpoints so ad counts are consistent.
// This back-buffer is required because the 2 “gate ads” can be recorded slightly BEFORE
// `startMining()` sets `lastClaimTime` (network delay / UX pacing).
const AD_WINDOW_BUFFER_MS = 600_000; // 10 minutes
// Initialize Redis Client
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

const app = express();
const port = process.env.PORT || 5000;
const corsOptions = {
  origin: "*",
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};

// per-HOUR reward rates
const PLAN_RATES_PER_HOUR = {
  Free: 3,
  "Electric Power": 9,
  "Turbo Power": 18,
  "Nuclear Power": 27,
} as const;

// Unique key per 6h bucket (works with scheduleExactlyOnce)
const SIX_HOUR_MS = 6 * 60 * 60 * 1000;
const sixHourSlot = (dt: Date) =>
  `sixhour:${Math.floor(dt.getTime() / SIX_HOUR_MS)}`;

app.use(cors()); // <---- use cors middleware
app.use((req, res, next) => {
  const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
  if (userAgent.includes("postman") || userAgent.includes("curl")) {
    return res.status(403).json({
      status: 403,
      data: { message: "Requests from this client are not allowed." },
    });
  }
  return next();
});
// app.all("/*", function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, Content-Type, Accept, Authorization, Content-Length, X-Requested-With"
//   );
//   next();
// });

/*app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  res.header("Access-Control-Allow-Credentials", true);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
  next();
});*/

app.use((req, res, next) => {
  // Skip json parsing for Stripe webhooks
  if (
    req.originalUrl?.startsWith(
      "/api/v1/bitcoinyay/subscriptions/webhooks/stripe"
    ) ||
    req.originalUrl?.startsWith("/api/v1/inex/stripe/webhook")
  ) {
    return next();
  }
  // Apply json parsing for all other routes
  return express.json({ limit: "100mb" })(req, res, next);
});

// Increase body size limit to 100MB for file uploads (KYB/KYC documents)
// This must be configured BEFORE routes are registered

app.use(express.urlencoded({ extended: true, limit: "100mb" }));

const server = http.createServer(app);
// Keep these higher than nginx keepalive_timeout (65s)
server.keepAliveTimeout = 75_000;
server.headersTimeout = 80_000;
(server as any).requestTimeout = 75_000; // TS may need cast

// Initialize WebSocket server
ChatSocketService.init(server);
setupReferralMessageQueueProcessor();
server.listen(process.env.PORT || 5000, () =>
  console.log(`⚡ Server on :${process.env.PORT || 5000}`)
);

app.use((req, res, next) => {
  console.log(" ------>>>>>> new request for %s", req.originalUrl);
  if (req.originalUrl.indexOf("/api/v1") >= 0) {
    return next();
  } else if (req.originalUrl.indexOf("/api") >= 0) {
    // require auth
  }
  return next();
});

app.use("/api/v1/inex/user", authRoutes);
app.use("/api/v1/inex/userkyc", userkycRoutes);
app.use("/api/v1/inex/userkyc", kycUserRoutes); // New KYC user routes
app.use("/api/v1/kyc", kycUserRoutes); // Alternative KYC route path
app.use("/api/v1/kyb", kybUserRoutes);
app.use("/api/v1/inex/kyb", kybUserRoutes);
app.use("/api/v1/inex/stripe", paymentsRoute);
app.use("/api/v1/inex/paypal", paypalPaymentRoute);
app.use("/api/v1/inex", countryRoute);
app.use("/api/v1/inex/basic", basicRoute);
app.use("/api/v1/inex/wallet", walletRoute);
app.use("/api/v1/inex/order", orderRoutes);
app.use("/api/v1/inex/transaction", transactionRoutes);
app.use("/api/v1/inex/admin", adminRoute);
app.use("/api/v1/inex/admin/kyc", kycAdminRoutes); // New KYC admin routes
app.use("/api/v1/inex/admin/kyb", kybAdminRoutes);
app.use("/api/v1/kyb/admin", kybAdminRoutes);
app.use("/api/v1/whitelist", whitelistRoute); // Whitelist management routes
app.use("/api/v1/inex/shop", shopRoute);
app.use("/api/v1/inex/alchemy", alchemyRoute);
app.use("/api/v1/inex/smart-crypto", smartCryptoSubscriptionRoute);
app.use("/api/v1/bitcoinyay/alchemy/pools", alchemyPoolRoute);
app.use("/api/v2/bitcoinyay/alchemy", alchemyV2Route);
app.use("/api/v1/bitcoinyay/audit-logs", bitcoinyayAuditRoute);
app.use("/api/v1/bitcoinyay/subscriptions", bitcoinyaySubscriptionRoute);
//Api for decentralized
app.use("/api/v1/dex/user", dexRoutes);
app.use("/api/v1/inex/sell-btcy", sellRoute);

//Api for NFT
app.use("/api/v1/srt/", srtNFTRoute);

//Api for wallet
app.use("/api/v1/wallet", indexxWalletRoute);

//Api for XNFT
app.use("/api/v1/xnft", xNFTRoutes);

//APi for gift Cards
app.use("/api/v1/xnft/giftcards", giftCardRoutes);

//API for affiliate
app.use("/api/v1/affiliate", affiliateRoute);

//API for mining related
app.use("/api/v1/mining", miningRoute);
app.use("/api/v1/mining/station", miningStationRoute);

//API for vesting related
app.use("/api/v1/vesting", vestingRoute);

//API for chat related
app.use("/api/v1/chat", chatRoute);

//API for DAI
app.use("/api/v1/dao", daoRoute);

//api for btcy rewards
app.use("/api/v1/btcy/reward", btcyRewardRoute);

//api for notification
app.use("/api/v1/notification", notificationRoute);
app.use("/api/v1/email-validation", emailValidationRoute);
app.use("/api/v1/marketing-email", marketingEmailRoute);
app.use("/api/v1/social-campaign", socialCampaignRoute);
app.use("/api/v1/earnings", earningsRoute);
app.use("/api/v1/shoperpal/btcy-nuggets", shoperpalBtcyNuggetsRoute);

//api for btcy rewards
app.use("/api/v1/rewards", dailyAdsRoute);

//api for ad mining watch
app.use("/api/v1/admining", adMiningWatchRoutes);

// Internal EMMM → Indexx bonus grants (turbo mining, nuggets, VIP)
app.use("/api/v1/emmm/bonus", emmmBonusRouter);

//api for p2p trading
app.use("/api/v1/p2p", p2pRouter);

//api for ai investments
app.use("/api/v1/aiengine", aiInvestmentRoute);

app.get("/debug/instance", (req, res) => {
  res.json({
    host: os.hostname(),
    pid: process.pid,
    pm_id: process.env.pm_id ?? null,
    NODE_APP_INSTANCE: process.env.NODE_APP_INSTANCE ?? null,
  });
});

app.get("/debug/leader", async (req, res) => {
  try {
    const env = process.env.NODE_ENV || "dev";
    const appName = process.env.APP_NAME || "indexx-api";
    const leaderKey = `btcy:scheduler:leader:${env}:${appName}`;
    const leader = await redisClient.get(leaderKey);
    const ttl = await redisClient.pTTL(leaderKey); // ms remaining
    res.json({ leader, ttl_ms: ttl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// 404 Handler - Catch all unhandled routes and pass to error handler
app.use((req, res, next) => {
  const err: any = new Error(
    `Route not found: ${req.method} ${req.originalUrl}`
  );
  err.statusCode = 404;
  err.errorCode = "ROUTE_NOT_FOUND";
  err.isOperational = true;
  next(err);
});

// Global Error Handler - Must be registered AFTER all routes and middleware
import { errorHandler } from "./helpers/middleware";
app.use(errorHandler);

// ---- Leader election for singleton schedulers ----
const ENV = process.env.NODE_ENV || "dev";
const APP = process.env.APP_NAME || "indexx-api";
const LEADER_KEY = `btcy:scheduler:leader:${ENV}:${APP}`;
const ID = `${os.hostname()}:${process.pid}`;
const LEASE_MS = 60_000; // 60s lease
const RENEW_MS = 20_000; // renew every 20s

// Admin notification queue processing
import { setupAdminNotificationQueueProcessor } from "./cron_jobs/adminNotificationQueue.job";
import { setupInexSponsorshipJob } from "./cron_jobs/inexSponsorship.job";
import { setupEngagementNotificationJob } from "./cron_jobs/engagementNotifications.job";
import { setupEmailVerificationJob } from "./cron_jobs/emailVerification.job";
import { setupGpaySubscriptionRenewalJob } from "./cron_jobs/gpaySubscriptionRenewal.job";
import { isMiningAdTestEmail } from "./helpers/miningAdTestEmails";

async function electLeader() {
  try {
    const ok = await redisClient.set(LEADER_KEY, ID, {
      NX: true,
      PX: LEASE_MS,
    });
    if (ok) {
      console.log("🟢 Became scheduler leader:", ID);

      const renew = setInterval(async () => {
        try {
          const cur = await redisClient.get(LEADER_KEY);
          if (cur === ID) await redisClient.pExpire(LEADER_KEY, LEASE_MS);
        } catch (e) {
          console.error("Leader renew error:", e);
        }
      }, RENEW_MS);

      const release = async () => {
        try {
          const cur = await redisClient.get(LEADER_KEY);
          if (cur === ID) await redisClient.del(LEADER_KEY);
        } catch { }
        clearInterval(renew);
      };
      process.on("SIGINT", release);
      process.on("SIGTERM", release);
      process.on("exit", release);

      // Register singleton cron jobs (exactly-once per slot)
      startSingletonCrons();
    } else {
      setTimeout(electLeader, 10_000); // retry later
    }
  } catch (e) {
    console.error("Leader election error:", e);
    setTimeout(electLeader, 10_000);
  }
}

// Call election after Redis connects
redisClient.on("connect", () => {
  console.log("Connected to Redis.");
  //electLeader();
});

// 👉 only the leader calls this:
function startSingletonCrons() {
  console.log("🗓️ Registering singleton cron jobs on leader:", ID);
  const tz = "Asia/Kolkata";

  // 1) Every minute — only once per minute
  scheduleExactlyOnce({
    cronExpr: "* * * * *",
    jobName: "stopMiningAfter24Hours",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: minuteSlot,
    lockTtlMs: 75_000,
    run: stopMiningAfter24Hours,
  });

  // 2) Every 5 minutes — P2P trade processing
  scheduleExactlyOnce({
    cronExpr: "*/5 * * * *",
    jobName: "p2p_trade_processing",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: minuteSlot,
    lockTtlMs: 4 * 60_000,
    run: async () => {
      await p2pCronService.runCronJobs();
    },
  });

  // 3) Daily 00:00 — once per day
  scheduleExactlyOnce({
    cronExpr: "0 0 * * *",
    jobName: "runstakedcoins",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: daySlot,
    lockTtlMs: 15 * 60_000,
    run: async () => {
      const userOps = new UserOperations({} as any, {} as any);
      await userOps.RunstakedCoins({} as any, {} as any);
    },
  });

  scheduleExactlyOnce({
    cronExpr: "0 0 * * *",
    jobName: "lottery_refresh",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: daySlot,
    lockTtlMs: 10 * 60_000,
    run: () => lotteryService.refreshTimes(),
  });

  scheduleExactlyOnce({
    cronExpr: "0 0 * * *",
    jobName: "aff_downgrade_ranks",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: daySlot,
    lockTtlMs: 10 * 60_000,
    run: async () => {
      const affOps = new AffilateOperations({} as any, {} as any);
      await affOps.downgradeUserRanks();
    },
  });

  // 3) Monthly 1st 00:00 — once per month
  scheduleExactlyOnce({
    cronExpr: "0 0 1 * *",
    jobName: "profit_calc_prev_week",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: monthSlot,
    lockTtlMs: 15 * 60_000,
    run: async () => {
      // await profitCalculation();
    },
  });

  scheduleExactlyOnce({
    cronExpr: "0 0 1 * *",
    jobName: "monthly_orders_report",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: monthSlot,
    lockTtlMs: 30 * 60_000,
    run: async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      const req: any = {
        query: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
      const res: any = {};
      const orderOperations = new OrderOperations(req, res);
      await orderOperations.getAllOrdersByDate(req, res);
      console.log("Report generated successfully");
    },
  });

  // 4) Quarterly 1st 00:00 — once per quarter
  scheduleExactlyOnce({
    cronExpr: "0 0 1 */3 *",
    jobName: "inex_price_increase",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: quarterSlot,
    lockTtlMs: 15 * 60_000,
    run: increaseINEXPrice,
  });

  // 5) Half-yearly 1st 00:00 — once per half
  scheduleExactlyOnce({
    cronExpr: "0 0 1 */6 *",
    jobName: "mining_halving",
    timezone: tz,
    redis: redisClient,
    slotKeyFn: halfYearSlot,
    lockTtlMs: 60 * 60_000,
    run: async () => {
      console.log("⛏️ Running Mining Reward Halving...");
      const allMiningUsers = await miningService.find({});
      if (!allMiningUsers.length) {
        console.log("🚫 No mining users found.");
        return;
      }
      for (const user of allMiningUsers) {
        const newMiningRate = Math.max(user.miningRate / 2, 0.001);
        await miningService.updatePart(
          { email: user.email },
          { $set: { miningRate: newMiningRate } }
        );
        console.log(
          `✅ Halved mining rate for ${user.email}: New rate = ${newMiningRate}`
        );
      }
      await new SendEmail().sendMiningHalvingReminder(
        "omkar@azooca.com",
        "omkarsunku",
        new Date()
      );
      console.log("🎉 Mining halving completed successfully!");
    },
  });

  setupInexSponsorshipJob(redisClient, tz);
  setupEngagementNotificationJob(redisClient, tz);
  setupGpaySubscriptionRenewalJob(redisClient as any, tz);
  setupEmailVerificationJob(redisClient, tz);

  // Admin notification queue processor should be single-leader only
  setupAdminNotificationQueueProcessor(notificationQueue);
}

// ---- 24h sweep (unchanged behavior) ----
const stopMiningAfter24Hours = async () => {
  console.log("⏰ 24h sweep: checking users to stop...");
  const usersToStop24 = await miningService.getUsersExceeding24Hours();

  for (const user of usersToStop24) {
    if (!user.lastClaimTime) {
      console.error(`Skipping ${user.email}: Missing lastClaimTime`);
      continue;
    }
    const result = await stopMiningForUser(
      user.email,
      user.coinSymbol || "BTCY"
    );
    console.log(`[24h] ${user.email}:`, result.data);
  }
};

function resolveSessionHours(userType?: string, planName?: string): number {
  const ut = String(userType || "").toLowerCase(); // "free mining" | "power mining"
  const pn = String(planName || "").toLowerCase(); // "electric power" | "turbo power" | "nuclear power"

  if (ut === "free mining") return 6;
  if (pn.includes("electric")) return 12;
  if (pn.includes("turbo") || pn.includes("nuclear")) return 24;
  return 24;
}

// ---- Per-user delayed queue to stop mining at 6 hours ----
export const miningStopQueue: Queue = new Queue1("mining-stop", {
  redis: {
    port: Number(process.env.REDIS_PORT || 6379),
    host: process.env.REDIS_HOST || "127.0.0.1",
    password: process.env.REDIS_PASSWORD,
  },
  // default job options for everything added to this queue
  defaultJobOptions: {
    // keep up to 1000 completed jobs OR up to 1 hour, whichever comes first
    removeOnComplete: { age: 3600, count: 1000 },
    // keep up to 1000 failed jobs OR up to 1 day
    removeOnFail: { age: 24 * 3600, count: 1000 },
  },
});

miningStopQueue.on("error", (err) =>
  console.error("mining-stop queue error:", err)
);
miningStopQueue.on("failed", (job, err) =>
  console.error(`mining-stop job ${job?.id} failed:`, err?.message)
);
miningStopQueue.on("completed", (job) =>
  console.log(
    `mining-stop job ${job?.id} completed for`,
    job?.data?.email,
    job?.data?.coin
  )
);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule a per-user stop check at +6h from cycleStart.
 * Call this when a mining session starts (new cycleStart/lastClaimTime).
 */
export async function scheduleMiningStop(
  email: string,
  coin: string,
  cycleStartISO: string
) {
  const lowerEmail = String(email).toLowerCase();
  const cycleStart = new Date(cycleStartISO);
  if (
    !lowerEmail ||
    !coin ||
    !cycleStartISO ||
    Number.isNaN(cycleStart.getTime())
  )
    return;

  // dedupe key per cycle
  const jobKey = `btcy:mining:job:${coin}:${lowerEmail}:${cycleStart.toISOString()}`;

  // setNX for > 1 day to prevent double-queueing per cycle
  const ok = await redisClient.set(jobKey, "1", {
    NX: true,
    PX: ONE_DAY_MS + 6 * 60 * 60 * 1000,
  });
  if (!ok) return; // already scheduled for this cycle

  const firstDelay = Math.max(
    0,
    6 * 60 * 60 * 1000 - (Date.now() - cycleStart.getTime())
  );
  await miningStopQueue.add(
    {
      email: lowerEmail,
      coin,
      cycleStart: cycleStart.toISOString(),
      step: "6h_check",
    },
    {
      delay: firstDelay,
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
    }
  );

  console.log(
    `[mining-stop] scheduled 6h check for ${lowerEmail} ${coin} in ${Math.round(
      firstDelay / 1000
    )}s`
  );
}

miningStopQueue.process(100, async (job) => {
  const { email, coin, cycleStart, step } = job.data as {
    email: string;
    coin: string;
    cycleStart: string;
    step: "6h_check";
  };

  // Ensure MongoDB connection is ready before querying
  const { ensureMongoConnected } = require("./db/connection");

  // Wait up to 10 seconds for connection (longer timeout for background jobs)
  let retries = 20; // 20 retries * 500ms = 10 seconds
  let isConnected = false;

  while (retries > 0 && !isConnected) {
    isConnected = await ensureMongoConnected();
    if (!isConnected) {
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before retry
      }
    }
  }

  if (!isConnected) {
    console.error(
      `[mining-stop] MongoDB not connected after retries for job ${job.id}, skipping`
    );
    // Return success to avoid infinite retries - the job will be skipped
    return { status: "skipped", reason: "MongoDB not available" };
  }

  const cycleStartDate = new Date(cycleStart);

  // Ensure user is still in same cycle and active
  const u = await miningService.findOne({ email, coinSymbol: coin });
  if (!u?.isMiningActive || !u?.lastClaimTime) {
    return { status: "skip", reason: "not active" };
  }
  if (
    new Date(u.lastClaimTime).toISOString() !== cycleStartDate.toISOString()
  ) {
    return { status: "skip", reason: "new cycle started" };
  }

  try {
    // Apply the same ad-based 6h/24h rule to all emails (keep helper for controlled rollouts).
    const APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS = true;
    if (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(email)) {
      const startWithBuffer = new Date(
        cycleStartDate.getTime() - AD_WINDOW_BUFFER_MS
      );
      const adCount = await adMiningWatchService.getAdCount(
        String(email).toLowerCase(),
        startWithBuffer,
        new Date()
      );
      // If user reached the extension threshold, do NOT stop at 6h.
      if (Number(adCount) >= AD_EXTEND_THRESHOLD) {
        return { status: "skip", reason: "ad_count>=7" };
      }
    }
  } catch (e) {
    console.error("[mining-stop] ad count check failed (ignored):", e);
  }

  // Always stop at 6h
  const res = await stopMiningForUser(email, coin);
  console.log(`[mining-stop] 6h stop ${email} ${coin}:`, res.status, res.data);
  return { status: "stopped@6h" };
});

// wherever stopMiningForUser lives
export const stopMiningForUser = async (
  email: string,
  coinSymbol: string = "BTCY"
) => {
  const lowerEmail = String(email).toLowerCase();
  const lockKey = `btcy:mining:stop:${coinSymbol}:${lowerEmail}`;
  const lockOwner = `${os.hostname()}:${process.pid}:${Date.now()}`;
  const HOUR_MS = 60 * 60 * 1000;

  try {
    if (!email || !coinSymbol)
      return { status: 400, data: "Email and coinSymbol are required" };

    const locked = await redisClient.set(lockKey, lockOwner, {
      NX: true,
      PX: USER_STOP_LOCK_MS,
    });
    if (!locked)
      return { status: 409, data: "Stop already in progress for this user" };

    const user = await miningService.findOne({ email: lowerEmail, coinSymbol });
    if (!user?.isMiningActive || !user?.lastClaimTime)
      return { status: 404, data: "User not actively mining" };

    if (
      user.lastProcessedCycleStart &&
      new Date(user.lastProcessedCycleStart) >= new Date(user.lastClaimTime)
    ) {
      return { status: 200, data: "Mining already stopped for this cycle" };
    }

    // --- subscription decides base session length ---
    const subUiResp = await subscriptionService.getUserSubscriptionForUi(
      lowerEmail,
      coinSymbol
    );
    const userType = subUiResp?.data?.userType; // e.g. "Free" or others
    const planName = subUiResp?.data?.planName; // e.g. "Electric Power", "Turbo Power", "Nuclear Power"
    let sessionHours = resolveSessionHours(userType, planName); // 6 / 12 / 24

    // Ad-based cycle duration should only affect Free Mining (2 ads => 6h, 7 ads => 24h).
    // For paid plans, keep plan-based durations (12/24) unchanged.
    const APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS = true;
    const isFreeMining = String(userType || "").toLowerCase() === "free mining";
    if (
      isFreeMining &&
      (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(lowerEmail))
    ) {
      try {
        const now = new Date();
        // subtract buffer to cover race condition
        const startWithBuffer = new Date(
          new Date(user.lastClaimTime).getTime() - AD_WINDOW_BUFFER_MS
        );
        const adCount = await adMiningWatchService.getAdCount(
          lowerEmail,
          startWithBuffer,
          now
        );

        if (Number(adCount) >= AD_EXTEND_THRESHOLD) {
          sessionHours = 24;
        } else if (Number(adCount) >= 2) {
          sessionHours = 6;
        } else {
          sessionHours = 24; // matches existing behavior in other endpoints
        }
      } catch (e) {
        console.error("ad count check failed (ignored):", e);
      }
    }

    // IMPORTANT: Removed the previous global override of `any ad => 6h`.
    // That behavior breaks 24h extensions (7 ads) and could prematurely stop sessions.

    // --- timing & cap ---
    const now = new Date();
    const cycleStart = new Date(user.lastClaimTime);
    const elapsedMs = Math.max(0, now.getTime() - cycleStart.getTime());
    const capMs = sessionHours * HOUR_MS;

    if (elapsedMs < capMs) {
      return { status: 200, data: `Not yet ${sessionHours}h session` };
    }

    const cappedNow = new Date(cycleStart.getTime() + capMs);

    // --- rewards (same logic as your code, but use cappedNow) ---
    let rewards: number;

    const FLAG_AD_REWARDS =
      (typeof keys?.FLAG_AD_REWARDS?.key !== "undefined"
        ? !!keys.FLAG_AD_REWARDS.key
        : false) || process.env.FLAG_AD_REWARDS === "1";

    const MIN_STREAK_DAYS = 1;
    const rows = await dailyAdStreakService.getEmailsWithStreaks(
      MIN_STREAK_DAYS
    );
    const AD_REWARDS_EMAILS = new Set(
      rows.map((r) => String(r.email).toLowerCase())
    );
    const shouldApplyAdRewards = (e: string) =>
      FLAG_AD_REWARDS && AD_REWARDS_EMAILS.has(String(e).toLowerCase());

    if (shouldApplyAdRewards(lowerEmail)) {
      const { reward, ms } = await subscriptionService.computeProratedRewards(
        lowerEmail,
        coinSymbol,
        cycleStart,
        cappedNow,
        PLAN_RATES_PER_HOUR
      );
      rewards = reward;
    } else {
      let elapsedHours = (cappedNow.getTime() - cycleStart.getTime()) / HOUR_MS;
      if (elapsedHours > sessionHours) elapsedHours = sessionHours;
      rewards = elapsedHours * user.miningRate;
    }

    await dailyStatsService.addDailyCredit(
      coinSymbol,
      email,
      rewards,
      cappedNow
    );

    const op = await miningService.stopAndCreditAtomic(
      lowerEmail,
      coinSymbol,
      rewards,
      cycleStart,
      cappedNow
    );
    const didApply =
      !!op && (op.modifiedCount > 0 || (op as any).nModified > 0);
    if (!didApply)
      return { status: 200, data: "Already processed by another worker" };

    try {
      await miningCreditEventService.recordCredit({
        email: lowerEmail,
        coinSymbol,
        amount: rewards,
        creditedAt: cappedNow,
        source: "auto_stop",
        miningPlan: user.miningPlan,
        miningRate: user.miningRate,
        sessionHours,
        sessionStartedAt: cycleStart,
      });
    } catch (err) {
      console.error("[mining-stop] failed to log mining credit event:", err);
    }

    await miningService.updateUserBalanceWhenMiningStopped(
      lowerEmail,
      coinSymbol,
      rewards
    );

    await creditLinkedAccountBonus({
      miningService,
      linkedAccountService,
      linkedAccountBonusLogService,
      userService: uservice,
      secondaryEmail: lowerEmail,
      coinSymbol: String(coinSymbol || "").toUpperCase(),
      secondaryRewards: rewards,
      source: "auto_stop",
      earnedAt: cappedNow,
    });

    // Update the UserMiningSession with end time and earned tokens (same as manual stopMining)
    const activeSession = await userMiningSessionService.findOne({
      email: lowerEmail,
      isActive: true,
    });

    if (activeSession) {
      const endTime = cappedNow;
      const startTime = new Date(activeSession.startedAt);
      const durationInSeconds = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );

      await userMiningSessionService.updatePart(
        { _id: activeSession._id },
        {
          $set: {
            endedAt: endTime,
            durationInSeconds: durationInSeconds,
            minedTokens: rewards,
            isActive: false,
          },
        }
      );
    }

    miningStreakService
      .recordCompletedSession(lowerEmail, cappedNow, sessionHours)
      .catch((err) => {
        console.error("[MiningStreak] recordCompletedSession failed:", err);
      });

    const currentUser = await uservice.findOne({ email: lowerEmail });
    if (currentUser) {
      // if (isNotificationBetaEmail(lowerEmail)) {
      await notificationService.sendMiningSessionEnded(lowerEmail, {
        user: currentUser,
        sessionLengthHours: sessionHours,
        sessionStart: cycleStart,
      });
      // } else if (currentUser.fcmToken) {
      //   await notificationService.sendNotification(
      //     currentUser,
      //     sessionHours === 6 ? "mining_reminder_6h" : "mining_reminder",
      //     { sessionHours }
      //   );
      // }
    }

    return {
      status: 200,
      data: `Mining stopped (${sessionHours}h session) successfully`,
    };
  } catch (err: any) {
    console.error("Error in stopMiningForUser:", err);
    return { status: 500, data: err.message || String(err) };
  } finally {
    try {
      const val = await redisClient.get(lockKey);
      if (val && val.startsWith(`${os.hostname()}:${process.pid}`)) {
        await redisClient.del(lockKey);
      }
    } catch { }
  }
};

async function main2() {
  let userOrder = await orderService.findOne({
    orderId: "95171698",
  });
  await new SendEmail().sendOrderCompleted(
    userOrder.user.email,
    "User",
    userOrder.breakdown.outAmount,
    userOrder.breakdown.outCurrencyName,
    userOrder.orderType,
    userOrder.orderRate.rate,
    userOrder.breakdown.inAmount -
    (userOrder.breakdown.inAmount * Number(userOrder?.exchangeFees)) / 100,
    "",
    userOrder.orderId
  );
}

async function getAndCreateUserWallets() {
  try {
    let allUsers = await uservice.findSelect(
      {},
      {
        userWallets: 1,
      }
    );

    for (let index = 0; index < allUsers.length; index++) {
      const element = allUsers[index];

      let findBTCYWallet = element.userWallets.find(
        (x) => x.coinSymbol === "BTCY"
      );

      if (findBTCYWallet) {
        console.log("wallet", findBTCYWallet);
      } else {
        console.log("no wallet ");
        let req: any, res: any;
        let dataResults;
        let coin = "BTCY";
        let email = element.email;
        dataResults = await orderService.createBitcoinYahWallet(email, coin);
      }
    }
  } catch (err) {
    console.error("Error in getUserWallets:", err);
  }
}

//getAndCreateUserWallets();

async function mainhow() {
  try {
    // Get the current date
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, so this is the current month

    // Calculate the start and end dates for the previous month
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)); // 1st of the previous month, 00:00 UTC
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // Last day of the previous month, 23:59 UTC

    console.log("Start Date (UTC):", startDate.toISOString());
    console.log("End Date (UTC):", endDate.toISOString());

    let req: any = {
      query: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
    let res: any = {};

    let orderOperations = new OrderOperations(req, res);
    const response = await orderOperations.getAllOrdersByDate(req, res);

    console.log("Report generated successfully");
  } catch (error) {
    console.error("Error in report scheduled task:", error);
  }
}

//mainhow();

async function getUserWallets() {
  try {
    let allUsers = await uservice.findOne({
      email: "zongzoraz@gmail.com",
    });

    let findBTCYWallet = allUsers.userWallets.find(
      (x) => x.coinSymbol === "BTCY"
    );

    if (findBTCYWallet) {
      console.log("wallet", findBTCYWallet);
    } else {
      console.log("no wallet ");
      let req: any, res: any;
      let dataResults;
      let coin = "BTCY";
      let email = "zongzoraz@gmail.com";
      dataResults = await orderService.createBitcoinYahWallet(email, coin);
    }
  } catch (err) {
    console.error("Error in getUserWallets:", err);
  }
}

//getUserWallets();

async function createWallet() {
  try {
    const getUsers = await uservice.findOne({
      email: "devin.delamora@icloud.com",
    });
    const coins = ["DOT", "SOL", "XRP"];
    const userWalletsSymbols = getUsers.userWallets.map(
      (wallet) => wallet.coinSymbol
    );
    if (getUsers.email) {
      coins.forEach((coin) => {
        if (!userWalletsSymbols.includes(coin)) {
          console.log("no wallet found", coin, getUsers.email);
          if (coin == "DOT") {
            orderService
              .createDOTWallet(getUsers.email, coin)
              .then((x: any) => {
                console.log(x);
              });
          } else if (coin == "SOL") {
            orderService
              .createSolanaWallet(getUsers.email, coin)
              .then((x: any) => {
                console.log(x);
              });
          } else if (coin == "XRP") {
            orderService
              .createRippleWallet(getUsers.email, coin)
              .then((x: any) => {
                console.log(x);
              });
          }
        }
      });
    }
  } catch (err) {
    console.log("err", err);
  }
}

//createWallet();
//main2();

async function mainSwitch() {
  try {
    const transactions = [
      {
        amount: 0.05743243843331413,
        coin: "BTC",
        notes: "xBitcoin Bitcoin $5,000 Package-Omkar-2025",
      },
      // {
      //   amount: 1001.7794979749657,
      //   coin: "XRP",
      //   notes:
      //     "xBitcoin Bull-Run $9,000 Package - Gabe, 10% tip taken in XRP (Crypto: 3.70002734 XRP, USD: $8.83) and transferred to wallet@azooca.com on Thu Jan 02 2025 19:57:08 GMT+0530 (India Standard Time), 10% tip taken in XRP (Crypto: 11.95842482 XRP, USD: $37.96) and transferred to wallet@azooca.com on Wed Jan 22 2025 22:46:45 GMT+0530 (India Standard Time), 10% tip taken in XRP (Crypto: 9.76589041 XRP, USD: $29.69) and transferred to wallet@azooca.com on Wed Jan 29 2025 22:00:43 GMT+0530 (India Standard Time)",
      // },
      // {
      //   amount: 2369.878875339849,
      //   coin: "XLM",
      //   notes:
      //     "xBitcoin Bull-Run $9,000 Package - Gabe, 10% tip taken in XLM (Crypto: 20.77412997 XLM, USD: $8.83) and transferred to wallet@azooca.com on Thu Jan 02 2025 19:57:11 GMT+0530 (India Standard Time), 10% tip taken in XLM (Crypto: 87.48473819 XLM, USD: $37.96) and transferred to wallet@azooca.com on Wed Jan 22 2025 22:46:49 GMT+0530 (India Standard Time), 10% tip taken in XLM (Crypto: 75.98747592 XLM, USD: $29.69) and transferred to wallet@azooca.com on Wed Jan 29 2025 22:00:46 GMT+0530 (India Standard Time)",
      // },
      // {
      //   amount: 957.9774105514657,
      //   coin: "ADA",
      //   notes:
      //     "xBitcoin Bull-Run $9,000 Package - Gabe, 10% tip taken in ADA (Crypto: 9.18922277 ADA, USD: $8.83) and transferred to wallet@azooca.com on Thu Jan 02 2025 19:57:15 GMT+0530 (India Standard Time), 10% tip taken in ADA (Crypto: 37.89898952 ADA, USD: $37.96) and transferred to wallet@azooca.com on Wed Jan 22 2025 22:46:52 GMT+0530 (India Standard Time)",
      // },
      // {
      //   amount: 880.6649694580733,
      //   coin: "MANA",
      //   notes:
      //     "xBitcoin Bull-Run $9,000 Package - Gabe, 10% tip taken in MANA (Crypto: 17.48317869 MANA, USD: $8.83) and transferred to wallet@azooca.com on Thu Jan 02 2025 19:57:19 GMT+0530 (India Standard Time)",
      // },
    ];

    console.log(transactions);

    let req: any, res: any;
    req = {
      body: {
        email: "seanapopp@gmail.com",
        currentPortfolioName: "SmartCrypto",
        planName: "xBitcoin Bull-Run New 2025",
        exitingCryptocurrencies: {
          rows: transactions,
        },
        managedBy: "Omkar",
      },
    };
    let email = String(req.body.email).toLowerCase();
    const { currentPortfolioName, planName } = req.body;
    if (
      !email == undefined ||
      !currentPortfolioName == undefined ||
      !currentPortfolioName ||
      !planName
    ) {
      res.statusCode = 500;
      res.send({ message: "Missing parameters" });
      return;
    }
    let orderOperations = new OrderOperations(req, res);
    let results = await orderOperations.switchSmartCryptoPlan(req, res);
    console.log("results", results);
    // res.statusCode = results.status;
    // res.send(results);
    return;
  } catch (err) {
    console.log("err", err);
  }
}
//mainSwitch();

async function createWallet1() {
  try {
    const getUsers = await uservice.find({ email: "martinmonge@verizon.net" });
    const coins = ["SUI"];
    let req: any;
    let res: any;
    const walletOps: WalletOperations = new WalletOperations(req, res);
    const wallet: OrderService = new OrderService();
    console.log(getUsers.length);
    getUsers.forEach((item: any) => {
      const userWalletsSymbols = item.userWallets.map(
        (wallet: any) => wallet.coinSymbol
      );

      if (item.email === "martinmonge@verizon.net") {
        coins.forEach((coin) => {
          if (!userWalletsSymbols.includes("SUI")) {
            wallet.createSUIWallet(item.email, "SUI").then((x: any) => {
              console.log(x);
            });
          }
        });
      }
    });
  } catch (err) {
    console.log("err", err);
  }
}

async function increaseINEXPrice() {
  try {
    const coin = "INEX"; // Ensure this matches the code used for INEX
    const currentPriceData = await currencyService.findOne({ code: coin });
    const currentPrice = currentPriceData.buyPrice || 0;

    // Increment the price by 0.25
    const newPrice = currentPrice + 0.25;

    // Update the INEX price
    await currencyService.updateMany(
      { code: coin },
      {
        buyPrice: newPrice,
        buyPriceUpdatedOn: new Date(),
      }
    );

    await new SendEmail().sendPriceIncreaseNotification(
      "omkar@azooca.com",
      coin,
      newPrice,
      new Date()
    );

    console.log(`INEX price updated to ${newPrice} at ${new Date()}`);
  } catch (error) {
    console.error("Error updating INEX price:", error);
  }
}

var uiOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Seafarer Crew Certificate Management API",
  customfavIcon: "favicon.ico",
};

redisClient.on("error", (err) => {
  console.error("Error connecting to Redis:", err);
});

redisClient.on("connect", () => {
  console.log("Connected to Redis.");
  // Kick off leader election (only the leader will register crons)
  electLeader();
});

// Establish a connection
if (!redisClient.isOpen) {
  redisClient.connect();
}

process.on("exit", async () => {
  await redisClient.quit();
});

emailQueue.process(async (job) => {
  console.log("Receved a job", job);
  const { email, userName, purchasedProduct, InexToSent } = job.data;
  return new SendEmail().sendCourseAttachmentToUser(
    email,
    userName,
    purchasedProduct,
    InexToSent
  );
});

emailQueue.on("completed", (job, result) => {
  console.log(
    `Email job ${job.id} completed with result ${JSON.stringify(result)}`
  );
});

emailQueue.on("failed", (job, err) => {
  console.error(
    `Email job ${job.id} failed with error ${JSON.stringify(err.message)}`
  );
});

//export const userTaskQueue: Queue = new Queue1("user-tasks");

// Create Bull queue instance
export const userTaskQueue: Queue = new Queue1("user-tasks", {
  redis: {
    port: Number(process.env.REDIS_PORT || 6379),
    host: process.env.REDIS_HOST || "127.0.0.1",
    password: process.env.REDIS_PASSWORD,
  },
});

userTaskQueue.on("error", (err) => {
  console.error("Bull Queue Error:", err);
});

userTaskQueue.process(async (job: any) => {
  console.log("Receved a user task", job);

  const {
    user,
    password,
    referralCode,
    type,
    UserCreatedFrom,
    affiliateUserRegister,
    reqBody,
  } = job.data;

  try {
    let getReferredUser, getReferredUserTaskCenter;

    // Referral code and affiliate-related tasks
    if (referralCode && referralCode !== "zsuitepay") {
      getReferredUser = await uservice.findOne({ referralCode });
      getReferredUserTaskCenter = await taskCenterService.findOne({
        email: getReferredUser?.email,
      });

      if (getReferredUser && getReferredUserTaskCenter) {
        await taskCenterService.updatePart(
          { email: getReferredUser.email },
          {
            $inc: { inivitedUsersCount: 1 },
            $set: {
              inivitedUsersEmail: [
                ...getReferredUserTaskCenter.inivitedUsersEmail,
                user.email,
              ],
            },
          }
        );
      }
    }

    // Hash the password and save
    const getPassword = await uservice.createPassword(password);
    const localAuthProvider = user.authProviders.find(
      (p: any) => p.provider === "Local"
    );
    if (localAuthProvider) {
      localAuthProvider.phash = getPassword.hash;
      localAuthProvider.psalt = getPassword.salt;
    }
    await uservice.updatePart(
      { email: user.email },
      { $set: { authProviders: user.authProviders } }
    );

    // Create Task Center for the new user
    const pointsHistoryObj = {
      email: user.email,
      points: 10, // Sign-up points (example value)
      type: "Sign Up Completed Points",
      date: new Date(),
    };
    //create a new Task center on user signUp;
    const newTaskCenter = {
      email: user.email,
      isTransactionCompletedInExchange: false,
      transactionPoints: 0,
      redeemPoints: 0,
      totalPoints: 10,
      inivitedUsersCount: 0,
      isInivitedThreeUsers: false,
      inivitedUserPoints: 0,
      isReportedBug: false,
      reportedBugPoints: 0,
      remainingPoints: 0,
      isParticipatedInLotto: false,
      lottoPoints: 0,
      pointsHistory: [pointsHistoryObj],
      signUpPoints: signUpPoints,
      isSignUp: true,
      isKYCPass: false,
      KYCPoints: 0,
      isBuyIndexxTokens: false,
      buyIndexxTokensPoints: 0,
    } as TaskCenter;
    await taskCenterService.create(newTaskCenter);

    // Create wallet user and other wallet-related tasks
    const walletWebUser = await createUserWithEmailAndPasswordForWallet(
      user.email,
      password
    );
    if (walletWebUser.success) {
      let basicDetails = {};
      const newUser: User = {
        email: String(user.email).toLowerCase(),
        role: UserRoleTypes.Standard,
        authProviders: [
          {
            provider: AuthProviders.Local,
          },
        ],
        baseCurrency: Currency.USD,
        basic: basicDetails,
        userMnemonic: "",
        password: password,
      } as User;
      await wuserservice.create(newUser);

      // use the greeting card if body has a value and add it to wallet balance
      let greetingCode = reqBody.body.gcode;
      console.log(greetingCode, "greetingCode");
      let inexAmountTobeAdded = 0;

      if (greetingCode && greetingCode !== "") {
        let getAffiliateUser = await affilateService.findOne({
          Email: getReferredUser?.email,
        });
        let getUsedGreetingCard: any = getAffiliateUser.greetingCards.find(
          (x) => x.code === greetingCode
        );

        console.log("I am here", getUsedGreetingCard);
        if (
          getUsedGreetingCard &&
          getUsedGreetingCard.receiverEmail === user.email
        ) {
          inexAmountTobeAdded = getUsedGreetingCard.numberOfTokens;
          let updateGreetingcard = await affilateService.updatePart(
            {
              Email: getReferredUser?.email,
              "greetingCards.code": greetingCode,
            },
            {
              $set: {
                "greetingCards.$.receiverActivatedDate": new Date(),
              },
            }
          );
        } else {
          console.log("Greeting code is not valid");
        }
      }
      let res: any;
      let req: any;
      //Exchange wallet
      await createFirstTimeWallets(user.email, inexAmountTobeAdded);
      // Web wallets
      const walletOps: WalletOperations = new WalletOperations(req, res);
      await walletOps.createBitcoinWalletForWalletUser(user.email);
      await walletOps.createEthereumWalletForWalletUser(user.email);
      await walletOps.createBinanceWalletForWalletUser(user.email);
      await walletOps.createMaticWalletForWalletUser(user.email);
      await walletOps.createeINEXWalletForWalletUser(user.email);
      await walletOps.createeIN500WalletForWalletUser(user.email);
      await walletOps.createeINXCWalletForWalletUser(user.email);
      await walletOps.createeIUSDPWalletForWalletUser(user.email);
      await walletOps.createETHINEXWalletForWalletUser(user.email);
      await walletOps.createETHIN500WalletForWalletUser(user.email);
      await walletOps.createETHINXCWalletForWalletUser(user.email);
      await walletOps.createETHIUSDPWalletForWalletUser(user.email);
      await walletOps.createMATICINEXWalletForWalletUser(user.email);
    } else {
      console.log("Failed to create wallet user");
    }

    // Handle referral-based affiliate relationship building
    if (getReferredUser) {
      // Perform relationship and affiliate updates
      // You can handle HoneyBee or CaptainBee logic here
    }

    // Send welcome or verification email
    await emailService.sendReviewEmail2(user.email, "User", "", type);

    console.log("affiliateUserRegister");
    if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
      //todo backup pass academy

      const url = `${keys.academyBaseUrl.key}/api/users/signup`;
      let academyUser = {
        email: user.email,
        first_name: reqBody.first_name ?? "User",
        last_name: reqBody.last_name ?? "User",
        password: reqBody.password,
        userCreatedFrom: UserCreatedFrom,
        referral_code: referralCode,
      };
      const payload = { ...academyUser };
      const response = await axios.post(url, payload);
      console.log("response", response);
      //Free gift card for new user signup added on 30-09-2024
      let createFreeGiftCardForUser = await createFreeGiftCard(
        "gift-card-50",
        user.email,
        50
      );
      await new SendEmail().sendSelfFreeGiftCardForNewSignUpNotification(
        user.email,
        "Gift Card $50",
        createFreeGiftCardForUser.currencies,
        50,
        createFreeGiftCardForUser.voucher,
        "",
        50
      );
      // await new SendEmail().sendAcademyAccountEmail(
      //   email,
      //   response.data.newUser,
      //   keys.academyBaseUrl.key
      // );
      const message = "createdUser";
      return { status: 200, data: message };
    } else {
      const url = `${keys.academyBaseUrl.key}/api/users/signup`;
      let academyUser = {
        email: user.email,
        first_name: reqBody.first_name ?? "User",
        last_name: reqBody.last_name ?? "User",
        password: reqBody.password,
        userCreatedFrom: UserCreatedFrom,
        referral_code: referralCode,
      };
      const payload = { ...academyUser };
      const response = await axios.post(url, payload);
      console.log("response", response);

      //Free gift card for new user signup added on 30-09-2024
      let createFreeGiftCardForUser = await createFreeGiftCard(
        "gift-card-50",
        user.email,
        50
      );
      await new SendEmail().sendSelfFreeGiftCardNotification(
        user.email,
        "Gift Card $50",
        createFreeGiftCardForUser.currencies,
        50,
        createFreeGiftCardForUser.voucher,
        "",
        50
      );
      // await new SendEmail().sendAcademyAccountEmail(
      //   email,
      //   response.data.newUser,
      //   keys.academyBaseUrl.key
      // );
    }

    console.log(`Successfully processed background tasks for ${user.email}`);
  } catch (error) {
    console.error(
      `Failed to process user registration tasks for ${user.email}:`,
      error
    );
  }
});

userTaskQueue.on("completed", (job, result) => {
  console.log(
    `Email job ${job.id} completed with result ${JSON.stringify(result)}`
  );
});

userTaskQueue.on("failed", (job, err) => {
  console.error(
    `Email job ${job.id} failed with error ${JSON.stringify(err.message)}`
  );
});

const SIX_H_MS = 6 * 60 * 60 * 1000;
export async function backfillAdWatchedOnly({
  coinSymbol = "BTCY",
  from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
  to = new Date(),
  pageSize = 1000,
  concurrency = 25,
}: {
  coinSymbol?: string;
  from?: Date;
  to?: Date;
  pageSize?: number;
  concurrency?: number;
}) {
  let page = 0;
  let totalEmails = 0;
  let considered = 0;
  let scheduled = 0;
  let stoppedNow = 0;
  let skippedInactive = 0;
  let skippedNewCycle = 0;
  let skippedNoClaim = 0;
  let errors = 0;

  const pool = new Set<Promise<any>>();
  const run = async (p: Promise<any>) => {
    pool.add(p.finally(() => pool.delete(p)));
    if (pool.size >= concurrency) await Promise.race(pool);
  };

  while (true) {
    const emails = await adMiningWatchService.getEmailsWithAdsBetween(
      from,
      to,
      page,
      pageSize
    );
    if (!emails.length) break;
    totalEmails += emails.length;

    for (const email of emails) {
      await run(
        (async () => {
          try {
            const u = await miningService.findOne({ email, coinSymbol });
            if (!u?.isMiningActive) {
              skippedInactive++;
              return;
            }
            if (!u?.lastClaimTime) {
              skippedNoClaim++;
              return;
            }

            const cycleStart = new Date(u.lastClaimTime);
            // Ensure user is still on the same cycle we’d be operating on
            // (If they restarted after watching ads, don’t touch)
            // Here we just use current lastClaimTime; ad window is filtered by `from/to`.
            const now = new Date();
            const elapsed = now.getTime() - cycleStart.getTime();
            if (elapsed < 0) {
              skippedNewCycle++;
              return;
            } // clock anomaly or future

            if (elapsed >= SIX_H_MS) {
              const r = await stopMiningForUser(email, coinSymbol);
              if (String(r?.status || "").startsWith("2")) stoppedNow++;
              else errors++;
            } else {
              await scheduleMiningStop(
                email,
                coinSymbol,
                cycleStart.toISOString()
              );
              scheduled++;
            }
            considered++;
          } catch (e) {
            errors++;
            console.error("[backfillAdWatchedOnly] error for", email, e);
          }
        })()
      );
    }

    // drain this page’s work before fetching next page
    await Promise.allSettled(Array.from(pool));
    pool.clear();

    page++;
  }

  console.log("[backfill-ad-watched] done:", {
    totalEmails,
    considered,
    scheduled,
    stoppedNow,
    skippedInactive,
    skippedNewCycle,
    skippedNoClaim,
    errors,
  });

  return {
    totalEmails,
    considered,
    scheduled,
    stoppedNow,
    skippedInactive,
    skippedNewCycle,
    skippedNoClaim,
    errors,
  };
}
