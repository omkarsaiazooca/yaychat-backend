// services/dailyAdDay.service.ts
import { DailyAdDay } from "../data/dailyAds";
import { ServiceBase } from "./base";
import { ymdInSystemTz } from "../helpers/dayHelper";
import DailyAdDaySchema, { DailyAdDayModel } from "../models/dailyAds";
import { DailyAdEventService } from "./dailyAdEvent.service";
import { DailyAdStreakService } from "./dailyAdStreak.service";
import { SubscriptionService } from "./subscription.service";
import { NotificationService } from "./notification.service";
import { adRevenueCreditingService } from "./adRevenueCrediting.service";

const events = new DailyAdEventService();
const streak = new DailyAdStreakService();
const subscriptionService = new SubscriptionService();
const notificationService = new NotificationService();
function rewardMinutesForDay(day: number): number {
  switch (day) {
    case 1: return 15;
    case 2: return 20;
    case 3: return 25;
    case 4: return 30;
    case 5: return 35;
    case 6: return 40;
    case 7: return 45;
    default: return 0;
  }
}

// ADD this helper near rewardMinutesForDay()
function rewardMinutesForDayV2(day: number): number {
  // New hour-based rewards (converted to minutes)
  switch (day) {
    case 1: return 6 * 60;   // 360
    case 2: return 6 * 60;   // 360
    case 3: return 12 * 60;  // 720
    case 4: return 12 * 60;  // 720
    case 5: return 18 * 60;  // 1080
    case 6: return 18 * 60;  // 1080
    case 7: return 24 * 60;  // 1440
    default: return 0;
  }
}

// helper to map minutes -> {days|minutes} for the notification
function minutesToGrant(minutes: number): { days?: number; minutes?: number } {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440); // e.g., 1440 -> 1 day
    return { days };
  }
  return { minutes };
}


export class DailyAdDayService extends ServiceBase<DailyAdDay, DailyAdDayModel> {
  constructor() {
    super(DailyAdDaySchema, "DailyAdDay");
  }

  async getStatus(email: string, dailyLimit = 25) {
    const date = ymdInSystemTz();
    const row = await this.findOne({ email, date });
    const count = row?.count ?? 0;
    const effectiveDay = await streak.getEffectiveDayForToday(email);
    return {
      email,
      date,
      count,
      watchedToday: count,
      dailyLimit,
      remaining: Math.max(dailyLimit - count, 0),
      canWatch: count < dailyLimit,
      lastWatchedAt: row?.lastWatchedAt ?? null,
      streakDay: effectiveDay,
      lastAdId: row?.lastAdId ?? null,
    };
  }

  /**
   * Atomic increment with idempotency:
   * - Only increment if count < dailyLimit
   * - Only if watchId not already in wIds
   * Also writes an analytics event (best-effort).
   */
  async logWatch(
    email: string,
    adId: string,
    watchId: string,
    secondsWatched = 0,
    dailyLimit = 25,
    when = new Date()
  ) {
    const emailL = String(email).toLowerCase().trim();
    const date = ymdInSystemTz(when);

    // fire-and-forget analytics (deduped by its own unique index)
    events.createEvent({ email: emailL, adId, watchId, secondsWatched, when }).catch(() => { });

    // 0) HARD DUPLICATE GUARD (fast path)
    // If today's doc already contains this watchId, short-circuit as "duplicate".
    const dupDoc = await this.findOne({ email: emailL, date, wIds: watchId });
    if (dupDoc) {
      const count = dupDoc?.count ?? 0;
      return {
        email: emailL,
        date,
        count,
        dailyLimit,
        canWatch: count < dailyLimit,
        alreadyCounted: true,
        status: "duplicate",
      };
    }

    // 1) Atomic upsert + increment if still below limit
    const filter: any = {
      email: emailL,
      date,
      count: { $lt: dailyLimit }, // won't match once limit reached
    };

    const update: any = {
      $setOnInsert: { email: emailL, date, },
      $set: { lastWatchedAt: when, lastAdId: adId },
      $addToSet: { wIds: watchId },
      $inc: { count: 1 },
    };

    let after: any = null;

    try {
      // Returns the updated/new doc when filter matched; null when not matched
      after = await this.upsertOneAndGet(filter, update);
    } catch (err: any) {
      if (err?.code === 11000) {
        // race on unique {email,date} — fall through to read+classify below
      } else {
        throw err;
      }
    }

    // 2) If the atomic write didn't happen (filter didn't match or raced),
    // read current and classify as duplicate / limit-reached / no-change.
    if (!after) {
      const cur = await this.findOne({ email: emailL, date });
      const count = cur?.count ?? 0;
      const alreadyCounted = !!cur?.wIds?.includes(watchId);
      const atLimit = count >= dailyLimit;

      return {
        email: emailL,
        date,
        count,
        dailyLimit,
        canWatch: count < dailyLimit,
        alreadyCounted,
        status: alreadyCounted ? "duplicate" : (atLimit ? "limit-reached" : "no-change"),
      };
    }

    // 3) If we just completed the day, mark completed and award minutes (idempotent)
    const justHitLimit = (after.count ?? 0) >= dailyLimit && after.completed !== true;
    if (justHitLimit) {
      await this.updatePart(
        { email: emailL, date, completed: { $ne: true } },
        { $set: { completed: true } }
      );

      const s = await streak.onDayCompleted(emailL, date);
      const dayNumber = Math.max(1, Math.min(7, Number(s.currentDay || 1)));
      const minutes = rewardMinutesForDay(dayNumber); // Free 1.5, Electric 4.5, Turbo 9, Nuclear 13.5

      if (minutes > 0) {
        await subscriptionService.applyAdReward(emailL, "BTCY", minutes, `ads_day_${dayNumber}`);
      }
    }

    // 4) Normal success (this call counted)
    return {
      email: emailL,
      date,
      count: after.count ?? 0,
      dailyLimit,
      canWatch: (after.count ?? 0) < dailyLimit,
      lastWatchedAt: after.lastWatchedAt ?? null,
      status: "ok",
    };
  }

  async logWatchV2(
    email: string,
    adId: string,
    watchId: string,
    secondsWatched = 0,
    dailyLimit = 25,
    when = new Date()
  ) {
    const emailL = String(email).toLowerCase().trim();
    const date = ymdInSystemTz(when);

    // fire-and-forget analytics (deduped by its own unique index)
    events.createEvent({ email: emailL, adId, watchId, secondsWatched, when }).catch(() => { });

    // Fast-path duplicate guard
    const dupDoc = await this.findOne({ email: emailL, date, wIds: watchId });
    if (dupDoc) {
      const count = dupDoc?.count ?? 0;
      return {
        email: emailL,
        date,
        count,
        dailyLimit,
        canWatch: count < dailyLimit,
        alreadyCounted: true,
        status: "duplicate",
      };
    }

    // Atomic upsert + increment only if still below limit
    const filter: any = {
      email: emailL,
      date,
      count: { $lt: dailyLimit },
    };

    const update: any = {
      $setOnInsert: { email: emailL, date },
      $set: { lastWatchedAt: when, lastAdId: adId },
      $addToSet: { wIds: watchId },
      $inc: { count: 1 },
    };

    let after: any = null;

    try {
      after = await this.upsertOneAndGet(filter, update);
    } catch (err: any) {
      if (err?.code !== 11000) {
        throw err;
      }
      // Unique race: fall through to read-and-classify
    }

    if (!after) {
      const cur = await this.findOne({ email: emailL, date });
      const count = cur?.count ?? 0;
      const alreadyCounted = !!cur?.wIds?.includes(watchId);
      const atLimit = count >= dailyLimit;

      return {
        email: emailL,
        date,
        count,
        dailyLimit,
        canWatch: count < dailyLimit,
        alreadyCounted,
        status: alreadyCounted ? "duplicate" : (atLimit ? "limit-reached" : "no-change"),
      };
    }

    // Award hours (in minutes) the first time we cross/meet the limit today
    const justHitLimit = (after.count ?? 0) >= dailyLimit && after.completed !== true;
    if (justHitLimit) {
      await this.updatePart(
        { email: emailL, date, completed: { $ne: true } },
        { $set: { completed: true } }
      );

      const s = await streak.onDayCompleted(emailL, date);
      const dayNumber = Math.max(1, Math.min(7, Number(s.currentDay || 1)));

      // New hour-based reward schedule
      const minutes = rewardMinutesForDayV2(dayNumber);

      if (minutes > 0) {
        // keep the same token/currency & reason convention
        await subscriptionService.applyAdReward(emailL, "BTCY", minutes, `ads_day_${dayNumber}_v2`);


        // 🔔 Notify once per day on first completion
        // Use an atomic "claim" update so only the first caller sends the push.
        const claim = await this.updatePart(
          { email: emailL, date, completed: true, notifiedDailyAds: { $ne: true } },
          { $set: { notifiedDailyAds: true, notifiedDailyAdsAt: new Date(), awardedMniutes: minutes, rewardVersion: "v2" } }
        );

        const claimed =
          claim && ((claim as any).modifiedCount > 0 || (claim as any).nModified > 0);

        if (claimed) {
          const grant = minutesToGrant(minutes); // {days} for 24h, else {minutes}
          await notificationService.sendDailyAdsCompletedReward(emailL, grant);
        }
      }
    }

    // Every call to this endpoint is a completed rewarded ad — write to credit station owner
    adRevenueCreditingService.creditAdWatch(emailL, 'rewarded').catch(() => {});

    return {
      email: emailL,
      date,
      count: after.count ?? 0,
      dailyLimit,
      canWatch: (after.count ?? 0) < dailyLimit,
      lastWatchedAt: after.lastWatchedAt ?? null,
      status: "ok",
    };
  }

  async getHistory(
    email: string,
    opts: { from?: string; to?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(Number(opts.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(opts.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;

    const q: any = { email };
    if (opts.from || opts.to) {
      q.date = {};
      if (opts.from) q.date.$gte = String(opts.from);
      if (opts.to) q.date.$lte = String(opts.to);
    }

    const [rows, total] = await Promise.all([
      this.findPaginatedSkip(limit, skip, { date: -1 }, q, null),
      this.findCount(q),
    ]);

    return { page, limit, total, data: rows };
  }

  async resetToday(email: string, when = new Date()) {
    const date = ymdInSystemTz(when);
    const res = await this.updatePartWithOptions(
      { email, date },
      { $set: { count: 0, wIds: [], lastAdId: null, lastWatchedAt: null } },
      { upsert: true }
    );
    return { ok: true, modified: (res as any).modifiedCount ?? 0 };
  }
}
