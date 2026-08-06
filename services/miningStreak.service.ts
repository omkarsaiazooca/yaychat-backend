// services/miningStreak.service.ts
import miningStreakSchema, { MiningStreakModel } from "../models/miningStreak";
import { MiningStreak } from "../data/miningStreak";
import { ServiceBase } from "./base";
import { ymdInSystemTz } from "../helpers/dayHelper";
import { MiningService } from "./mining.service";
import { SubscriptionService } from "./subscription.service";
import { resolveSessionHours } from "../helpers/miningSession";

const ELECTRIC_WEEKLY_PLAN = "Electric Mining Weekly Pass";
const ELECTRIC_MINING_RATE = 4.5;
const ELECTRIC_SPEED_BOOST = 4.5;
const STREAK_REWARD_DAYS = 7;
const MAX_STREAK = 7;
const COIN_SYMBOL = "BTCY";
const DAY_MS = 86_400_000;

const hasTurboOrNuclearPlan = (planName?: string): boolean => {
  const plan = String(planName || "").toLowerCase();
  return plan.includes("turbo") || plan.includes("nuclear");
};

const buildPendingRewardSource = (planName: string, suffix: string): string => {
  const normalized = String(planName || "").toLowerCase();
  if (normalized.includes("nuclear")) return `NUCLEAR:days=${STREAK_REWARD_DAYS}|${suffix}`;
  if (normalized.includes("turbo")) return `TURBO:days=${STREAK_REWARD_DAYS}|${suffix}`;
  return suffix;
};

export class MiningStreakService extends ServiceBase<MiningStreak, MiningStreakModel> {
  constructor() {
    super(miningStreakSchema, "MiningStreak");
  }

  /**
   * Record a completed mining session toward the daily streak.
   *
   * Rule: at least one session per calendar day increments the streak.
   * Missing a day resets to 1.
   */
  async recordCompletedSession(
    email: string,
    completedAt: Date,
    sessionHours: number
  ): Promise<void> {
    const emailL = String(email).toLowerCase();
    const today = ymdInSystemTz(completedAt);

    const existing = await this.findOne({ email: emailL });
    const lastCycleDay = existing?.lastCycleStartedAt
      ? ymdInSystemTz(new Date(existing.lastCycleStartedAt))
      : null;

    // Already counted a session today — skip
    if (lastCycleDay === today) return;

    const yesterday = ymdInSystemTz(new Date(completedAt.getTime() - DAY_MS));
    const isConsecutive = lastCycleDay === yesterday;

    const nextStreak =
      lastCycleDay === null ? 1
      : isConsecutive ? Math.min((existing?.currentStreak || 0) + 1, MAX_STREAK)
      : 1;

    await this.upsertOne(
      { email: emailL },
      {
        $set: {
          currentStreak: nextStreak,
          lastCycleStartedAt: completedAt,
          activeCycleStartedAt: completedAt,
          completedSessionsToday: 1,
          completedHoursToday: Math.max(1, Number(sessionHours) || 0),
          requiredSessionsToday: 1,
        },
      }
    );

    if (nextStreak === MAX_STREAK) {
      await this.grantStreakReward(emailL);
      await this.upsertOne({ email: emailL }, { $set: { currentStreak: 0 } });
    }
  }

  private async getDailyRequirement(email: string): Promise<{
    planName: string;
    userType: string | null;
    sessionHours: number;
    requiredSessions: number;
  }> {
    const subscriptionService = new SubscriptionService();
    const ui = await subscriptionService.getUserSubscriptionForUi(
      String(email).toLowerCase(),
      COIN_SYMBOL
    );
    const planName = String(ui?.data?.planName || ui?.data?.plan || "Free");
    const userType = ui?.data?.userType || null;
    const sessionHours = Math.max(1, resolveSessionHours(userType || undefined, planName));
    // 1 session = streak day regardless of plan
    const requiredSessions = 1;
    return { planName, userType, sessionHours, requiredSessions };
  }

  /**
   * Returns the full streak status for the GET endpoint.
   *
   * `currentStreak` is the effective streak day for today:
   * - completed today -> show the completed day
   * - completed yesterday -> show the next day the user needs to complete today
   * - otherwise -> reset view to day 1
   */
  async getStreakStatus(
    email: string,
    now = new Date()
  ): Promise<{
    currentStreak: number;
    completedStreak: number;
    minedToday: boolean;
    completedSessionsToday: number;
    requiredSessionsToday: number;
    completedHoursToday: number;
    requiredHoursToday: number;
    planName: string;
    userType: string | null;
    sessionHours: number;
    lastCycleStartedAt: string | null;
  }> {
    const emailL = String(email).toLowerCase();
    const s = await this.findOne({ email: emailL });
    const requirement = await this.getDailyRequirement(emailL);

    const today = ymdInSystemTz(now);
    const yesterday = ymdInSystemTz(new Date(now.getTime() - DAY_MS));
    const lastCycleDay = s?.lastCycleStartedAt
      ? ymdInSystemTz(new Date(s.lastCycleStartedAt))
      : null;

    const streakAlive = lastCycleDay === today || lastCycleDay === yesterday;
    const minedToday = lastCycleDay === today;
    const completedStreak = streakAlive
      ? Math.max(Math.min(Number(s?.currentStreak || 0), MAX_STREAK), 0)
      : 0;
    const currentStreak = minedToday
      ? Math.max(completedStreak, 1)
      : lastCycleDay === yesterday
      ? Math.min(completedStreak + 1, MAX_STREAK)
      : 1;

    return {
      currentStreak,
      completedStreak,
      minedToday,
      completedSessionsToday: minedToday ? Number(s?.completedSessionsToday || 0) : 0,
      requiredSessionsToday: requirement.requiredSessions,
      completedHoursToday: minedToday ? Number(s?.completedHoursToday || 0) : 0,
      requiredHoursToday: 24,
      planName: requirement.planName,
      userType: requirement.userType,
      sessionHours: requirement.sessionHours,
      lastCycleStartedAt: s?.lastCycleStartedAt
        ? new Date(s.lastCycleStartedAt).toISOString()
        : null,
    };
  }

  async getEffectiveStreak(email: string, now = new Date()): Promise<number> {
    const status = await this.getStreakStatus(email, now);
    return status.currentStreak;
  }

  private async queuePendingStreakReward(
    email: string,
    rewardPlan: string,
    currentSubscription: any,
    now: Date
  ): Promise<boolean> {
    const source = buildPendingRewardSource(
      rewardPlan,
      `streak_reward:${ymdInSystemTz(now)}`
    );
    const grant = {
      kind: "electric_minutes",
      minutes: STREAK_REWARD_DAYS * 1440,
      source,
      grantedAt: now,
    };

    const filter = {
      email,
      coinSymbol: COIN_SYMBOL,
      status: "Active",
      pendingRewards: { $not: { $elemMatch: { source } } },
    };

    const update = {
      $setOnInsert: {
        email,
        coinSymbol: COIN_SYMBOL,
        plan: currentSubscription?.plan || "Free",
        speedBoost: Number(currentSubscription?.speedBoost || 1),
        cost: Number(currentSubscription?.cost || 0),
        paymentMethod: currentSubscription?.paymentMethod || "",
        startDate: currentSubscription?.startDate || now,
        endDate: currentSubscription?.endDate || now,
        status: "Active",
        miningRate: Number(currentSubscription?.miningRate || 0),
        referralBonusUsed: Number(currentSubscription?.referralBonusUsed || 0),
      },
      $push: { pendingRewards: grant },
    };

    await (new SubscriptionService() as any).upsertOne(filter, update);
    return true;
  }

  private async grantStreakReward(email: string): Promise<void> {
    try {
      const miningService = new MiningService();
      const subscriptionService = new SubscriptionService();

      const now = new Date();
      const currentSubscription = await subscriptionService.findOne({
        email,
        coinSymbol: COIN_SYMBOL,
        status: "Active",
      });
      const miningRecord = await miningService.findOne({ email, coinSymbol: COIN_SYMBOL });
      const isMiningActive = !!miningRecord?.isMiningActive;

      const isActivePlan = (sub: any) =>
        !!sub?.endDate && new Date(sub.endDate).getTime() > now.getTime();

      // Turbo/Nuclear users: don't touch their plan — queue Electric so they can
      // activate it after their current premium plan expires.
      if (hasTurboOrNuclearPlan(currentSubscription?.plan) && isActivePlan(currentSubscription)) {
        await this.queuePendingStreakReward(email, ELECTRIC_WEEKLY_PLAN, currentSubscription, now);
        console.log(
          `[MiningStreak] Queued Electric reward as pending for ${email} (active ${currentSubscription!.plan})`
        );
        return;
      }

      // Mining session still running: queue and apply after the session ends.
      if (isMiningActive) {
        await this.queuePendingStreakReward(email, ELECTRIC_WEEKLY_PLAN, currentSubscription, now);
        console.log(`[MiningStreak] Queued pending streak reward for ${email} while mining is active`);
        return;
      }

      // Electric plan already active: extend its end date by 7 days.
      const hasActiveElectric =
        !!currentSubscription &&
        String(currentSubscription.plan || "").toLowerCase().includes("electric") &&
        isActivePlan(currentSubscription);

      const startDate = hasActiveElectric
        ? new Date(currentSubscription!.startDate || now)
        : now;
      const endDate = hasActiveElectric
        ? new Date(new Date(currentSubscription!.endDate).getTime() + STREAK_REWARD_DAYS * DAY_MS)
        : new Date(now.getTime() + STREAK_REWARD_DAYS * DAY_MS);
      const referralBonusUsed = Number(currentSubscription?.referralBonusUsed || 0);

      await (subscriptionService as any).upsertOne(
        { email, coinSymbol: COIN_SYMBOL },
        {
          $set: {
            plan: ELECTRIC_WEEKLY_PLAN,
            speedBoost: ELECTRIC_SPEED_BOOST,
            cost: 0,
            paymentMethod: "streak_reward",
            startDate,
            endDate,
            status: "Active",
            miningRate: ELECTRIC_MINING_RATE,
            coinSymbol: COIN_SYMBOL,
            referralBonusUsed,
          },
        }
      );

      if (miningRecord) {
        await miningService.updatePart(
          { email, coinSymbol: COIN_SYMBOL },
          { $set: { miningPlan: ELECTRIC_WEEKLY_PLAN, miningRate: ELECTRIC_MINING_RATE } }
        );
      }

      const action = hasActiveElectric ? "Extended" : "Granted";
      console.log(`[MiningStreak] ${action} ${ELECTRIC_WEEKLY_PLAN} to ${email} for 7-day streak`);
    } catch (err) {
      console.error(`[MiningStreak] Failed to grant streak reward to ${email}:`, err);
    }
  }
}
