import { scheduleMiningStop } from "../helpers/miningStopScheduler";
import { getRedis } from "../cache/redis";
import { getSubscriptionPlansCached, invalidateSubscriptionPlansCache } from "../cache/subscriptionPlansCache";
import { defaultPowerMiningPlans } from "../data/defaultPowerMiningPlans";
import { SubscriptionPlan } from "../data/miningSubcriptionPlans";
import { AdMiningWatchService } from "../services/adMiningWatch.service";
import { MiningService } from "../services/mining.service";
import { SubscriptionPlansService } from "../services/miningSubscriptionPlan.service";
import { SubscriptionService } from "../services/subscription.service";
import { UserService } from "../services/user.service";
import { UserMiningSessionService } from "../services/userMiningSession.service";
import { LinkedAccountService, getLinkedAccountBonusPercentage } from "../services/linkedAccount.service";
import { LinkedAccountBonusLogService } from "../services/linkedAccountBonusLog.service";
import { NotificationService } from "../services/notification.service";
import { MiningCreditEventService } from "../services/miningCreditEvent.service";
import { creditLinkedAccountBonus } from "../helpers/linkedAccountBonus";
import { isMiningAdTestEmail } from "../helpers/miningAdTestEmails";
import { isFreeMiningPlan, isFreeMiningSession, resolvePlanSessionHours, resolveSessionHours } from "../helpers/miningSession";
import { SpecialMiningEligibilityService } from "../services/specialMiningEligibility.service";
import { MiningStreakService } from "../services/miningStreak.service";
import { format } from "fast-csv";
const miningStreakService: MiningStreakService = new MiningStreakService();
const adMiningWatchService: AdMiningWatchService = new AdMiningWatchService();
const miningService = new MiningService();
const subscriptionService: SubscriptionService = new SubscriptionService();
const uservice: UserService = new UserService();
const subscriptionPlansService: SubscriptionPlansService =
  new SubscriptionPlansService();
const userMiningSessionService: UserMiningSessionService = new UserMiningSessionService();
const linkedAccountService: LinkedAccountService = new LinkedAccountService();
const linkedAccountBonusLogService: LinkedAccountBonusLogService =
  new LinkedAccountBonusLogService();
const notificationService: NotificationService = new NotificationService();
const miningCreditEventService = new MiningCreditEventService();
const specialMiningEligibilityService = new SpecialMiningEligibilityService();
const AD_EXTEND_THRESHOLD = 7;       // must match frontend EXTRA_ADS_FOR_24H
// Apply ad-based 6h/24h logic to all users. We keep the test-email helper for controlled rollouts,
// but default to global behavior as requested.
const APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS = true;
// 10-min buffer: covers gate ads recorded before startMining (2 ads watched before calling startMining).
const AD_WINDOW_BUFFER_MS = 600_000;
const AD_WINDOW_BUFFER_MS_24HR = 600_000;
const HOUR_MS = 60 * 60 * 1000;

const sanitizeNumber = (value: any, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const buildProductId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `power_${slug || "plan"}`;
};

function getLinkedBonusRate(activeCount: number): number {
  return getLinkedAccountBonusPercentage(activeCount) / 100;
}
export class MiningOperations {

  async startMining(req: any, res: any) {
    try {
      const { email, coinSymbol, adWatched } = req.body;

      if (!email || !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol are required" };
      }
      const lowerEmail = String(email).toLowerCase();

      const [existing, eligibility] = await Promise.all([
        miningService.getMiningData(email, coinSymbol),
        specialMiningEligibilityService.getEligibility(lowerEmail).catch(() => null),
      ]);

      if (existing?.isMiningActive) {
        return { status: 400, data: "Mining is already in progress" };
      }

      const isSpecialUser = eligibility?.specialMiningEligible === true;
      const skipAds = eligibility?.skipMiningAds === true;
      const specialSessionHours = eligibility?.sessionHours ?? 168;

      const hadSessionBefore = !!(await userMiningSessionService.findOne({
        email: lowerEmail,
      }));

      // Subscription and plans
      const subResp = await subscriptionService.getUserSubscription(email, coinSymbol);
      if (subResp.status !== 200) {
        return { status: 400, data: "Invalid subscription" };
      }
      const subscription = subResp.data;
      console.log("subscription", subscription);

      const allPlans = await subscriptionPlansService.find({});
      const freeTemplate = allPlans.find(x => x.name == "Free") as SubscriptionPlan;
      const freePlan = freeTemplate;

      if (!freePlan) {
        return { status: 500, data: "Plan configuration missing: Free" };
      }

      const now = new Date();
      const planName = subscription?.plan ?? "Free";
      const endDate = subscription?.endDate ? new Date(subscription.endDate) : now;
      const isExpired = endDate < now;

      console.log("isExpired", isExpired)
      const findPlan = allPlans.find(X => X.name === planName) as SubscriptionPlan;
      const chosenPlan = isExpired ? freePlan : (findPlan ?? freePlan);

      console.log("chosenPlan", chosenPlan)

      const rate = (chosenPlan.miningRate || 0);

      await miningService.findOneUpdate(
        { email, coinSymbol },
        {
          $setOnInsert: {
            totalMined: 0,
            coinSymbol,
          },
          $set: {
            isMiningActive: true,
            miningPlan: chosenPlan.name,
            miningRate: rate,
            lastClaimTime: new Date(),
            startTime: new Date(),
            adsExtendedEndAt: null,
            // Store session duration so getMiningStatus can compute sessionEndTime
            sessionDurationHours: isSpecialUser ? specialSessionHours : null,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Read back exact stored cycle start
      const user = await miningService.findOne({ email: lowerEmail, coinSymbol });
      if (!user?.isMiningActive || !user?.lastClaimTime) {
        return { status: 500, data: "Failed to start mining" };
      }
      const cycleStart = new Date(user.lastClaimTime);

      // Record session aligned to cycle start
      await userMiningSessionService.create({
        email: lowerEmail,
        startedAt: cycleStart,
        miningRate: rate,
        miningPlan: chosenPlan.name,
        isActive: true,
      });

      if (!hadSessionBefore) {
        const user = await uservice.findOne({ email: lowerEmail });
        if (user) {
          await notificationService.sendFirstTimeMiningWelcome(lowerEmail, { user });
        }
      }

      // Special users skip ad-gated cycle logic entirely — their session runs for specialSessionHours
      if (isSpecialUser && skipAds) {
        const sessionEndTime = new Date(
          cycleStart.getTime() + specialSessionHours * 3600 * 1000
        ).toISOString();
        return {
          status: 200,
          data: {
            started: true,
            skipMiningAds: true,
            sessionHours: specialSessionHours,
            sessionEndTime,
          },
        };
      }

      // ── Normal flow: decide 6h vs 24h based on recent ads ────────
      try {
        if (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(lowerEmail)) {
          const windowStart = new Date(cycleStart.getTime() - AD_WINDOW_BUFFER_MS);
          const adCount = await adMiningWatchService.getAdCount(lowerEmail, windowStart, new Date());
          const effectiveAdCount = Math.max(Number(adCount) || 0, adWatched ? 1 : 0);

          if (effectiveAdCount >= 2 && effectiveAdCount < AD_EXTEND_THRESHOLD) {
            await scheduleMiningStop(lowerEmail, coinSymbol, cycleStart.toISOString());
          }
        }
      } catch (e) {
        console.error("startMining -> adCount/schedule(6h) failed (ignored):", e);
      }

      return { status: 200, data: "Mining started successfully" };
    } catch (err) {
      console.error("startMining error:", err);
      return { status: 500, data: "Internal error starting mining" };
    }
  }

  async stopMining(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.body;
      const lowerEmail = String(email || "").trim().toLowerCase();
      const symbol = String(coinSymbol || "").trim();

      if (!lowerEmail || !symbol) {
        return { status: 400, data: "Email and coinSymbol are required" };
      }

      const user = await miningService.findOne({
        email: lowerEmail,
        coinSymbol: symbol,
        isMiningActive: true,
      });

      if (!user || !user.lastClaimTime) {
        return { status: 404, data: "Active mining session not found" };
      }

      const miningDurationMs = Date.now() - new Date(user.lastClaimTime).getTime();

      const elapsedDays = miningDurationMs / (1000 * 60 * 60);
      const rewards = elapsedDays * user.miningRate;
      const stopTime = new Date();
      const cycleStart = new Date(user.lastClaimTime);

      const op = await miningService.stopAndCreditAtomic(
        lowerEmail,
        symbol,
        rewards,
        cycleStart,
        stopTime
      );
      const didApply =
        !!op && (op.modifiedCount > 0 || (op as any).nModified > 0);

      if (!didApply) {
        return { status: 200, data: "Mining already stopped for this cycle" };
      }

      await miningService.updateUserBalanceWhenMiningStopped(
        lowerEmail,
        symbol,
        rewards
      );

      // Update the UserMiningSession with end time and earned tokens
      const activeSession = await userMiningSessionService.findOne({
        email: lowerEmail,
        isActive: true
      });

      if (activeSession) {
        const endTime = new Date();
        const startTime = new Date(activeSession.startedAt);
        const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        await userMiningSessionService.updatePart(
          { _id: activeSession._id },
          {
            $set: {
              endedAt: endTime,
              durationInSeconds: durationInSeconds,
              minedTokens: rewards,
              isActive: false
            }
          }
        );
      }

      // 2. Check and reward the referred user 
      //const getCurrentUser = await uservice.findOne({ email: lowerEmail });

      /*if (getCurrentUser?.referralCodeUsed && getCurrentUser.referralCodeUsed.trim() !== "") {
        const getReferredUser = await uservice.findOne({
          referralCode: getCurrentUser.referralCodeUsed,
        });

        if (getReferredUser?.email) {
          const referralBonus = rewards * 0.10;

          const referredFromKYCVerified = getCurrentUser?.kycStatus === "Completed" && getCurrentUser?.isKYCPass === true;

          await miningService.updateUserBalanceWhenMiningStopped(
            getReferredUser.email,
            symbol,
            referralBonus,
            referredFromKYCVerified
          );

          console.log(`Referral bonus of ${referralBonus} given to ${getReferredUser.email}`);
        }
      }*/

      await creditLinkedAccountBonus({
        miningService,
        linkedAccountService,
        linkedAccountBonusLogService,
        userService: uservice,
        secondaryEmail: lowerEmail,
        coinSymbol: String(symbol || "").toUpperCase(),
        secondaryRewards: rewards,
        source: "mining_stop",
        earnedAt: stopTime,
      });

      const subUiResp = await subscriptionService.getUserSubscriptionForUi(lowerEmail, symbol);
      const userType = subUiResp?.data?.userType;
      const planName = subUiResp?.data?.planName ?? user.miningPlan;
      let sessionHours = resolveSessionHours(userType, planName);

      if (isFreeMiningSession(userType, planName) && (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(lowerEmail))) {
        try {
          const startWithBuffer = new Date(new Date(user.lastClaimTime).getTime() - AD_WINDOW_BUFFER_MS);
          const adCount = await adMiningWatchService.getAdCount(lowerEmail, startWithBuffer, stopTime);

          if (Number(adCount) >= AD_EXTEND_THRESHOLD) {
            sessionHours = 24;
          } else if (Number(adCount) >= 2) {
            sessionHours = 6;
          }
        } catch (err) {
          console.error("[MiningStreak] ad-count check failed during manual stop:", err);
        }
      }

      try {
        await miningCreditEventService.recordCredit({
          email: lowerEmail,
          coinSymbol: symbol,
          amount: rewards,
          creditedAt: stopTime,
          source: "manual_stop",
          miningPlan: user.miningPlan,
          miningRate: user.miningRate,
          sessionHours,
          sessionStartedAt: cycleStart,
        });
      } catch (err) {
        console.error("Failed to log manual mining credit event:", err);
      }

      try {
        await miningStreakService.recordCompletedSession(lowerEmail, stopTime, sessionHours);
      } catch (err) {
        console.error("[MiningStreak] Failed to record completed session on stop:", err);
      }

      return { status: 200, data: "Mining stopped successfully" };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async claimMiningRewards(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.body;
      if (!email && !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol is required" };
      }

      const miningData = await miningService.getMiningData(email, coinSymbol);
      if (!miningData || !miningData.isMiningActive) {
        return { status: 400, data: "Mining is not active" };
      }
      const getAllsubscriptionPlans = await subscriptionPlansService.find({});
      const miningRateObj = getAllsubscriptionPlans.find(
        (plan) => plan.name === miningData.miningPlan
      );
      if (!miningRateObj) {
        return { status: 400, data: "Invalid mining plan" };
      }

      const miningRate = miningRateObj.miningRate;
      const currentTime = new Date();
      const lastClaimTime = new Date(
        miningData.lastClaimTime || miningData.startTime
      );
      const elapsedDays = Math.floor(
        (currentTime.getTime() - lastClaimTime.getTime()) /
        (1000 * 60 * 60)
      );

      if (elapsedDays <= 0) {
        return { status: 400, data: "Rewards can be claimed once per day" };
      }

      const rewards = elapsedDays * miningRate;
      await miningService.updateMiningRewards(email, rewards);

      return { status: 200, data: `Successfully claimed ${rewards} BTCY` };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getMiningStatus(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.params;
      if (!email || !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol is required" };
      }

      const [miningData, eligibility] = await Promise.all([
        miningService.getMiningData(email, coinSymbol),
        specialMiningEligibilityService.getEligibility(email).catch(() => null),
      ]);

      const specialMiningEligible = eligibility?.specialMiningEligible ?? false;
      const skipMiningAds = eligibility?.skipMiningAds ?? false;
      const sessionHours = eligibility?.sessionHours ?? null;

      if (!miningData) {
        return {
          status: 200,
          data: {
            isMiningActive: false,
            last24HourRunAt: null,
            specialMiningEligible,
            skipMiningAds,
            sessionHours,
            sessionEndTime: null,
            specialMiningReason: eligibility?.reason ?? null,
          },
          reason: "no_mining_session",
        };
      }

      const plainMiningData =
        typeof (miningData as any).toObject === "function"
          ? (miningData as any).toObject()
          : { ...(miningData as any) };

      // Compute sessionEndTime from lastClaimTime + sessionDurationHours (or eligibility hours)
      const activeDurationHours =
        plainMiningData.sessionDurationHours ?? sessionHours ?? null;
      let sessionEndTime: string | null = null;
      if (plainMiningData.isMiningActive && plainMiningData.lastClaimTime && activeDurationHours) {
        sessionEndTime = new Date(
          new Date(plainMiningData.lastClaimTime).getTime() + activeDurationHours * 3600 * 1000
        ).toISOString();
      }

      return {
        status: 200,
        data: {
          ...plainMiningData,
          last24HourRunAt: plainMiningData.last24HourRunAt ?? null,
          specialMiningEligible,
          skipMiningAds,
          sessionHours: activeDurationHours,
          sessionEndTime,
          specialMiningReason: eligibility?.reason ?? null,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserBalance(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.params;
      if (!email || !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol is required" };
      }

      const miningData = await subscriptionService.getUserSubscription012(email, coinSymbol);
      if (!miningData) {
        return { status: 404, data: "Mining data not found" };
      }

      return { status: 200, data: miningData.data };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getCurrentMiningRewards(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.params;
      if (!email || !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol is required" };
      }

      const miningData = await miningService.getMiningData(email, coinSymbol);
      if (!miningData || !miningData.isMiningActive) {
        return {
          status: 200,
          data: { status: "inactive", estimatedRewards: 0 },
          reason: miningData ? "mining_inactive" : "no_mining_session",
        };
      }

      const getAllsubscriptionPlans = await subscriptionPlansService.find({});
      const miningRateObj = getAllsubscriptionPlans.find(
        (plan) => plan.name === miningData.miningPlan
      );
      if (!miningRateObj) {
        return { status: 400, data: "Invalid mining plan" };
      }

      const miningRate = miningRateObj.miningRate;
      const currentTime = new Date();
      const lastClaimTime = new Date(
        miningData.lastClaimTime || miningData.startTime
      );
      const elapsedDays = Math.floor(
        (currentTime.getTime() - lastClaimTime.getTime()) /
        (1000 * 60 * 60)
      );

      const estimatedRewards = elapsedDays > 0 ? elapsedDays * miningRate : 0;

      return {
        status: 200,
        data: {
          status: "active",
          estimatedRewards,
          totalMined: miningData.totalMined,
          miningRateObj,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getMiningUsersCount(req: any, res: any) {
    try {
      const coinSymbol =
        typeof req?.query?.coinSymbol === "string" && req.query.coinSymbol.trim()
          ? String(req.query.coinSymbol).trim().toUpperCase()
          : "BTCY";
      const count = await miningService.getDistinctMiningEmailsCountByCoin(coinSymbol);
      return { status: 200, data: { coinSymbol, count } };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBTCYNewUsersToday(req: any, res: any) {
    try {
      const tz = (req.query.tz as string) || "Asia/Kolkata";
      const data = await miningService.getDailyNewUsersTodayByObjectId({ coinSymbol: "BTCY", tz });
      return { status: 200, data };
    } catch (err: any) {
      console.error("getBTCYNewUsersToday error", err);
      return { status: 500, data: err };
    }
  }

  async getBTCYNewUsersRange(req: any, res: any) {
    try {
      const startStr = req.query.start as string;
      const endStr = req.query.end as string;
      const tz = (req.query.tz as string) || "Asia/Kolkata";

      if (!startStr || !endStr) {
        return { status: 400, message: "start and end are required as YYYY-MM-DD (end exclusive)" };
      }

      // Basic YYYY-MM-DD validation
      const ymd = /^\d{4}-\d{2}-\d{2}$/;
      if (!ymd.test(startStr) || !ymd.test(endStr)) {
        return { status: 400, message: "Invalid date format. Use YYYY-MM-DD." };
      }

      // Build UTC bounds for the given TZ day range
      const startLocal = new Date(`${startStr}T00:00:00`);
      const endLocal = new Date(`${endStr}T00:00:00`);
      const start = new Date(startLocal.toLocaleString("en-US", { timeZone: "UTC" }));
      const end = new Date(endLocal.toLocaleString("en-US", { timeZone: "UTC" }));

      // Query using the computed Date objects (not raw strings)
      const rows = await miningService.getDailyNewUsersByObjectIdRange({
        coinSymbol: "BTCY",
        start,
        end,
        tz,
      });

      // Prepare a map for quick lookup: { "YYYY-MM-DD" -> count }
      const map = new Map<string, number>(rows.map((r: any) => [r.day as string, r.newUsersCount as number]));

      // Formatter to emit YYYY-MM-DD in the same TZ we grouped by
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Fill missing days with zeros
      const out: Array<{ day: string; newUsersCount: number }> = [];
      for (let d = new Date(start.getTime()); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = fmt.format(d); // already "YYYY-MM-DD" in tz
        out.push({ day, newUsersCount: map.get(day) ?? 0 });
      }

      return { status: 200, data: out };
    } catch (err: any) {
      console.error("getBTCYNewUsersRange error", err);
      return { status: 500, data: err };
    }
  }

  async getTotalBtcyMined(req: any, res: any) {
    try {
      const btcyMinedValue = await miningService.getBTCYTotals();
      return { status: 200, data: btcyMinedValue };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBTCYMinedRange(req: any, res: any) {
    try {
      const rawDays = Number(req?.query?.days ?? 30);
      const days = Number.isFinite(rawDays)
        ? Math.min(Math.max(Math.floor(rawDays), 1), 180)
        : 30;
      const tz =
        typeof req?.query?.tz === "string" && req.query.tz.trim()
          ? req.query.tz.trim()
          : "UTC";

      const DAY_MS = 24 * 60 * 60 * 1000;

      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      startDay.setDate(startDay.getDate() - (days - 1));

      const endExclusive = new Date(startDay.getTime() + days * DAY_MS);

      const pipeline: any[] = [
        {
          $addFields: {
            sessionDate: { $ifNull: ["$endedAt", "$startedAt"] },
          },
        },
        {
          $match: {
            sessionDate: { $gte: startDay, $lt: endExclusive },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$sessionDate",
                timezone: tz,
              },
            },
            totalMined: { $sum: { $ifNull: ["$minedTokens", 0] } },
            sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const rows: any = await userMiningSessionService.findAggregate(pipeline);

      const totals = new Map<
        string,
        { totalMined: number; sessions: number }
      >();

      for (const row of rows || []) {
        const key = row?._id;
        if (!key) continue;
        const totalMined =
          typeof row.totalMined === "number"
            ? row.totalMined
            : Number(row.totalMined || 0);
        const sessions =
          typeof row.sessions === "number"
            ? row.sessions
            : Number(row.sessions || 0);
        totals.set(key, { totalMined, sessions });
      }

      const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const labelFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
      });

      const daily: Array<{
        day: string;
        label: string;
        totalMined: number;
        sessionCount: number;
      }> = [];

      const startMs = startDay.getTime();
      for (let i = 0; i < days; i++) {
        const dayDate = new Date(startMs + i * DAY_MS);
        const dayKey = dateKeyFmt.format(dayDate);
        const summary = totals.get(dayKey);
        daily.push({
          day: dayKey,
          label: labelFmt.format(dayDate),
          totalMined: summary ? Number(summary.totalMined) : 0,
          sessionCount: summary ? Number(summary.sessions) : 0,
        });
      }

      return {
        status: 200,
        data: {
          days,
          timezone: tz,
          daily,
          totalMined: daily.reduce((acc, cur) => acc + cur.totalMined, 0),
          totalSessions: daily.reduce((acc, cur) => acc + cur.sessionCount, 0),
        },
      };
    } catch (err) {
      console.error("getBTCYMinedRange error:", err);
      return { status: 500, data: err };
    }
  }

  async getBTCYMinedWindows(req: any, res: any) {
    try {
      const coinSymbol =
        typeof req?.query?.coinSymbol === "string" && req.query.coinSymbol.trim()
          ? req.query.coinSymbol.trim()
          : "BTCY";

      const rawHours =
        typeof req?.query?.hours === "string" && req.query.hours.trim()
          ? req.query.hours
              .split(",")
              .map((value: string) => Number(value.trim()))
          : [6, 12, 24];

      const windows = rawHours
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .map((value: number) => Math.min(Math.max(Math.floor(value), 1), 168));

      const data = await miningCreditEventService.getRollingTotals(
        coinSymbol,
        windows.length ? windows : [6, 12, 24]
      );

      return { status: 200, data };
    } catch (err) {
      console.error("getBTCYMinedWindows error:", err);
      return { status: 500, data: err };
    }
  }

  async getMiningWindowTotals(req: any, res: any) {
    try {
      const coinSymbol =
        typeof req?.params?.coinSymbol === "string" && req.params.coinSymbol.trim()
          ? req.params.coinSymbol.trim()
          : typeof req?.query?.coinSymbol === "string" && req.query.coinSymbol.trim()
            ? req.query.coinSymbol.trim()
            : "BTCY";

      const email =
        typeof req?.query?.email === "string" && req.query.email.trim()
          ? req.query.email.trim().toLowerCase()
          : undefined;

      const rawHours =
        typeof req?.query?.hours === "string" && req.query.hours.trim()
          ? req.query.hours
              .split(",")
              .map((value: string) => Number(value.trim()))
          : [6, 12, 24];

      const windows = rawHours
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .map((value: number) => Math.min(Math.max(Math.floor(value), 1), 168));

      const data = await miningCreditEventService.getRollingTotals(
        coinSymbol,
        windows.length ? windows : [6, 12, 24],
        new Date(),
        email
      );

      return { status: 200, data };
    } catch (err) {
      console.error("getMiningWindowTotals error:", err);
      return { status: 500, data: err };
    }
  }

  async getMiningRewardSummary(req: any, _res: any) {
    try {
      const coinSymbol = String(req?.params?.coinSymbol || "BTCY").trim();
      const email =
        typeof req?.query?.email === "string" && req.query.email.trim()
          ? req.query.email.trim().toLowerCase()
          : "";

      if (!email) return { status: 400, data: "email is required" };

      const data = await miningCreditEventService.getRewardSummary(email, coinSymbol);
      return { status: 200, data };
    } catch (err) {
      console.error("getMiningRewardSummary error:", err);
      return { status: 500, data: err };
    }
  }

  async getActiveAndTotalMiningUsers(req: any, res: any) {
    try {

      const activeMiningUsers = await miningService.getActiveMiningUsers();
      const totalMiningUsers = await miningService.getMiningUsersCount();

      return {
        status: 200,
        data: {
          activeMiningUsers,
          totalMiningUsers,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllMiiningUsers(req: any, res: any) {
    try {
      const rawPage = Number(req?.query?.page ?? 1);
      const rawLimit = Number(req?.query?.limit ?? 50);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 500) : 50;

      const { miningPlan, search } = req?.query ?? {};
      const rawMinMined = req?.query?.minMined !== undefined ? Number(req.query.minMined) : undefined;
      const rawMaxMined = req?.query?.maxMined !== undefined ? Number(req.query.maxMined) : undefined;

      const plans =
        typeof miningPlan === "string" && miningPlan
          ? miningPlan.split(",").map((p: string) => p.trim()).filter(Boolean)
          : undefined;

      return await miningService.getAllMiningUsersPaginated({
        page,
        limit,
        coinSymbol: "BTCY",
        miningPlan: plans && plans.length === 1 ? plans[0] : plans,
        minMined: rawMinMined !== undefined && Number.isFinite(rawMinMined) ? rawMinMined : undefined,
        maxMined: rawMaxMined !== undefined && Number.isFinite(rawMaxMined) ? rawMaxMined : undefined,
        search: typeof search === "string" && search.trim() ? search.trim() : undefined,
      });
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async downloadAllBTCYMiningUsersEmails(req: any, res: any) {
    try {
      const coinSymbol = "BTCY";
      const rawBatchSize = Number(req?.query?.batchSize ?? 2000);
      const batchSize = Number.isFinite(rawBatchSize)
        ? Math.min(Math.max(Math.floor(rawBatchSize), 100), 10000)
        : 2000;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${coinSymbol}_mining_users_emails_${timestamp}.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");

      const csvStream = format({
        headers: ["email"],
      });
      csvStream.pipe(res);

      const cursor: any = await miningService.getDistinctMiningEmailsCursorByCoin(coinSymbol, batchSize);
      let exportedCount = 0;

      await cursor.eachAsync(
        async (row: any) => {
          const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
          if (!email) return;
          csvStream.write({ email });
          exportedCount += 1;
        },
        { parallel: 1 }
      );

      csvStream.end();
      console.log(`[AdminExport] Exported ${exportedCount} ${coinSymbol} mining emails`);
      return;
    } catch (err: any) {
      console.error("downloadAllBTCYMiningUsersEmails error:", err);
      if (!res.headersSent) {
        return res.status(500).json({
          status: 500,
          data: { message: "Failed to export BTCY mining emails" },
        });
      }
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async getMiningDetails(req: any, res: any) {
    try {
      const { email } = req.params;

      if (!email) {
        return { status: 400, data: "Email is required" };
      }

      // Get mining session data
      const coinSymbol = "BTCY";
      const miningData = await miningService.getMiningData(email, coinSymbol);
      console.log("miningData", miningData);

      if (!miningData) {
        return {
          status: 400,
          data: "No mining session found for user"
        };
      }

      let timeRemaining = { hours: 0, minutes: 0, seconds: 0 };
      let sessionEndTime: Date | null = null;

      // Calculate time remaining from current mining session start time
      if (miningData.isMiningActive && miningData.startTime) {
        const now = new Date();
        const startTime = new Date(miningData.startTime);

        let sessionHours = resolvePlanSessionHours(miningData.miningPlan);
        if (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(email)) {
          // decide session length: 6h if user watched 2-6 ads this cycle, else 24h
          const startWindow = new Date(startTime.getTime() - AD_WINDOW_BUFFER_MS);
          const adCount = await adMiningWatchService.getAdCount(email, startWindow, now);
          sessionHours = adCount >= AD_EXTEND_THRESHOLD ? 24 : (adCount >= 2 ? 6 : 24);
        }

        sessionEndTime = new Date(startTime.getTime() + sessionHours * 60 * 60 * 1000);

        const timeRemainingMs = Math.max(0, sessionEndTime.getTime() - now.getTime());

        // Convert to hours, minutes, seconds (max 24 hours)
        const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);

        timeRemaining = { hours, minutes, seconds };
      }

      // Get subscription plans to determine speed boost from plan name
      const allPlans = await subscriptionPlansService.find({});
      const currentPlan = allPlans.find(plan => plan.name === miningData.miningPlan);

      const miningDetails = {
        planName: miningData.miningPlan || "Free",
        speedBoost: currentPlan?.speedBoost || 1,
        miningRate: miningData.miningRate || 0,
        timeRemaining,
        sessionEndTime: sessionEndTime ? sessionEndTime.toISOString() : null,
        isMiningActive: miningData.isMiningActive || false,
      };

      return {
        status: 200,
        data: miningDetails
      };

    } catch (err) {
      console.error("getMiningDetails error:", err);
      return { status: 500, data: "Internal error fetching mining details" };
    }
  }

  async extendMiningCycleByAds(req: any, res: any) {
    try {
      const { email, coinSymbol } = req.body || {};
      if (!email || !coinSymbol) {
        return { status: 400, data: "Email and coinSymbol are required" };
      }

      const lowerEmail = String(email).toLowerCase();
      const miningData = await miningService.getMiningData(lowerEmail, coinSymbol);
      if (!miningData || !miningData.isMiningActive || !miningData.lastClaimTime) {
        return { status: 400, data: "Mining is not active" };
      }

      const now = new Date();
      const cycleStart = new Date(miningData.lastClaimTime);
      let adCount: number | null = null;
      let sessionHours = resolvePlanSessionHours(miningData.miningPlan);

      if (true || isMiningAdTestEmail(lowerEmail)) {
        const startWindow = new Date(cycleStart.getTime() - AD_WINDOW_BUFFER_MS_24HR);
        adCount = await adMiningWatchService.getAdCount(lowerEmail, startWindow, now);
        sessionHours = adCount >= AD_EXTEND_THRESHOLD ? 24 : (adCount >= 2 ? 6 : 24);
      }

      const sessionEndTime = new Date(cycleStart.getTime() + sessionHours * 60 * 60 * 1000);
      const timeRemainingMs = Math.max(0, sessionEndTime.getTime() - now.getTime());

      // Persist 24h extension so getMiningStatus after app restart has a server-side source of truth.
      // Without this, the stop worker may still stop at 6h based on ad-count timing/window differences.
      if (adCount != null && adCount >= AD_EXTEND_THRESHOLD) {
          try {
            await miningService.updatePart(
              { email: lowerEmail, coinSymbol, isMiningActive: true },
              {
                $set: {
                  adsExtendedEndAt: sessionEndTime,
                  last24HourRunAt: cycleStart,
                },
              }
            );
          } catch (e) {
            console.error("extendMiningCycleByAds -> adsExtendedEndAt update failed (ignored):", e);
          }
        }

      return {
        status: 200,
        data: {
          extended: adCount != null ? adCount >= AD_EXTEND_THRESHOLD : false,
          adCount,
          required: AD_EXTEND_THRESHOLD,
          sessionHours,
          sessionEndTime: sessionEndTime.toISOString(),
          timeRemainingMs,
        }
      };
    } catch (err: any) {
      console.error("extendMiningCycleByAds error:", err);
      return { status: 500, data: "Internal error extending mining cycle" };
    }
  }

  async getMiningHistory(req: any, res: any) {
    try {
      const { email } = req.params;

      if (!email) {
        return { status: 400, data: "Email is required" };
      }

      // Get last 7 days
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6); // Include today, so -6 days
      sevenDaysAgo.setHours(0, 0, 0, 0); // Start of day

      // Get mining sessions from last 7 days
      const miningSessions = await userMiningSessionService.find({
        email,
        startedAt: {
          $gte: sevenDaysAgo,
          $lte: today
        }
      });
      console.log("miningSessions", miningSessions);

      // Get subscription plans for speed boost lookup
      const allPlans = await subscriptionPlansService.find({});

      // Create array for last 7 days
      const history = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() - i);
        currentDate.setHours(0, 0, 0, 0);

        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 1);

        // Find all sessions for this day
        const daySessions = miningSessions.filter(session => {
          const sessionDate = new Date(session.startedAt);
          return sessionDate >= currentDate && sessionDate < nextDate;
        });

        if (daySessions.length > 0) {
          // Calculate total BTCY earned and total mining time for all sessions in this day
          let totalBtcyEarned = 0;
          let totalMiningTimeSeconds = 0;
          let avgMiningRate = 0;
          let miningPlan = "Free";

          daySessions.forEach(session => {
            totalBtcyEarned += session.minedTokens || 0;
            totalMiningTimeSeconds += session.durationInSeconds || 0;
            avgMiningRate = session.miningRate || 1; // Use the mining rate from any session
            miningPlan = session.miningPlan || "Free"; // Use the plan from any session
          });

          // Convert total mining time to hours, minutes, and seconds
          const totalHours = Math.floor(totalMiningTimeSeconds / 3600);
          const remainingSecondsAfterHours = totalMiningTimeSeconds % 3600;
          const totalMinutes = Math.floor(remainingSecondsAfterHours / 60);
          const totalSeconds = remainingSecondsAfterHours % 60;

          history.push({
            day: dayNames[currentDate.getDay()],
            date: currentDate,
            miningRate: avgMiningRate,
            miningPlan: miningPlan,
            btcyEarned: Math.round(totalBtcyEarned * 100000) / 100000, // Round to 5 decimal places
            totalMiningTime: {
              hours: totalHours,
              minutes: totalMinutes,
              seconds: totalSeconds,
            },
            sessionsCount: daySessions.length,
            hasMining: true
          });
        } else {
          // No mining session for this day
          history.push({
            day: dayNames[currentDate.getDay()],
            date: currentDate,
            miningRate: 0,
            miningPlan: "Free",
            btcyEarned: 0,
            totalMiningTime: {
              hours: 0,
              minutes: 0,
              seconds: 0,
            },
            sessionsCount: 0,
            hasMining: false
          });
        }
      }

      return {
        status: 200,
        data: {
          email,
          period: "Last 7 days",
          history
        }
      };

    } catch (err) {
      console.error("getMiningHistory error:", err);
      return { status: 500, data: "Internal error fetching mining history" };
    }
  }

  async syncPowerMiningPlans(req: any, res: any) {
    try {
      const bodyPlans = Array.isArray(req.body?.plans) ? req.body.plans : [];
      const sourcePlans = bodyPlans.length > 0 ? bodyPlans : defaultPowerMiningPlans;

      const normalizedPlans: SubscriptionPlan[] = sourcePlans.map((rawPlan: any) => {
        const input = rawPlan ?? {};
        const rawName = input.name ?? input.plan;
        const trimmedName = String(rawName ?? "").trim();
        if (!trimmedName) {
          throw new Error("Each plan must include a name.");
        }

        const parsedCost = sanitizeNumber(input.cost ?? input.monthlyFee ?? input.amount ?? 0);
        const parsedMiningRate = sanitizeNumber(
          input.miningRate ?? input.hourlyOutput ?? input.speedOutput ?? 0
        );
        const parsedSpeedBoost = sanitizeNumber(
          input.speedBoost ?? input.speedMultiplier ?? 0
        );

        const normalizedBoost =
          parsedSpeedBoost || (trimmedName === "Free" ? 1 : Math.max(parsedMiningRate, 1));
        const normalizedRate = parsedMiningRate || (trimmedName === "Free" ? 1 : 0);
        const normalizedDisplayName = String(
          input.displayName ?? input.label ?? (trimmedName === "Free" ? "Snatch (Free)" : trimmedName)
        ).trim();

        return {
          name: trimmedName,
          displayName: normalizedDisplayName || trimmedName,
          speedBoost: normalizedBoost,
          cost: parsedCost,
          miningRate: normalizedRate,
          coinSymbol: String(input.coinSymbol ?? input.token ?? "BTCY").toUpperCase(),
          productId: String(input.productId ?? input.sku ?? buildProductId(trimmedName)),
          displaySpeed: input.displaySpeed ?? input.speedOutput ?? input.speedLabel,
          benefits: input.benefits ?? input.keyBenefits,
          tier: input.tier ?? input.category,
        };
      });

      const updatedPlans = await subscriptionPlansService.upsertPlans(normalizedPlans);
      await invalidateSubscriptionPlansCache();

      return {
        status: 200,
        data: updatedPlans,
        message: `Upserted ${updatedPlans.length} power mining plan(s)`,
      };
    } catch (err) {
      console.error("syncPowerMiningPlans error:", err);
      return { status: 500, data: "Failed to sync power mining plans" };
    }
  }

  async setMiningEligibility(req: any, res: any) {
    try {
      const {
        email,
        specialMiningEligible,
        skipMiningAds,
        sessionHours,
        reason,
        addedBy,
        notes,
      } = req.body;

      if (!email || typeof specialMiningEligible !== "boolean") {
        return {
          status: 400,
          data: "email and specialMiningEligible (boolean) are required",
        };
      }

      const record = await specialMiningEligibilityService.setEligibility(email, {
        specialMiningEligible,
        skipMiningAds: skipMiningAds ?? true,
        sessionHours: sessionHours ?? 168,
        reason: reason ?? "eligible_email_whitelist",
        addedBy,
        notes,
      });

      return { status: 200, data: record };
    } catch (err) {
      console.error("setMiningEligibility error:", err);
      return { status: 500, data: "Failed to update mining eligibility" };
    }
  }

  async getMiningEligibility(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        return { status: 400, data: "email is required" };
      }

      const record = await specialMiningEligibilityService.getEligibility(email);
      if (!record) {
        return {
          status: 200,
          data: {
            email: String(email).trim().toLowerCase(),
            specialMiningEligible: false,
            skipMiningAds: false,
            sessionHours: null,
            reason: null,
          },
        };
      }

      return { status: 200, data: record };
    } catch (err) {
      console.error("getMiningEligibility error:", err);
      return { status: 500, data: "Failed to get mining eligibility" };
    }
  }

  async listMiningEligibility(req: any, res: any) {
    try {
      const records = await specialMiningEligibilityService.listEligible();
      return { status: 200, data: records };
    } catch (err) {
      console.error("listMiningEligibility error:", err);
      return { status: 500, data: "Failed to list mining eligibility" };
    }
  }

  async removeMiningEligibility(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        return { status: 400, data: "email is required" };
      }
      const removed = await specialMiningEligibilityService.removeEligibility(email);
      return { status: 200, data: { removed, email } };
    } catch (err) {
      console.error("removeMiningEligibility error:", err);
      return { status: 500, data: "Failed to remove mining eligibility" };
    }
  }
}
