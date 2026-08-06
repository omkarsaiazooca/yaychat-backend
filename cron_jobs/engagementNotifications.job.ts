import { minuteSlot, scheduleExactlyOnce } from "../helpers/scheduleExactlyOnce";
import { NotificationService } from "../services/notification.service";
import { MiningService } from "../services/mining.service";
import { SubscriptionService } from "../services/subscription.service";
import { DailyAdDayService } from "../services/dailyAds.service";
import { UserService } from "../services/user.service";

const notificationService = new NotificationService();
const miningService = new MiningService();
const subscriptionService = new SubscriptionService();
const dailyAdsService = new DailyAdDayService();
const userService = new UserService();

const COIN_SYMBOL = "BTCY";
const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOWS = [9, 13, 17, 21]; // morning, mid-day, evening, late evening

type LocalTimeInfo = {
  timeZone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offsetMs: number;
  startOfDayUtc: Date;
  nextMidnightUtc: Date;
};

function resolveTimezone(user: any): string {
  const tz =
    user?.basic?.timezone ||
    user?.basic?.timeZone ||
    user?.timezone ||
    user?.timeZone ||
    user?.preferredTimezone;
  if (typeof tz === "string" && tz.trim()) {
    return tz.trim();
  }
  return "Asia/Kolkata";
}

function getLocalTimeInfo(now: Date, timeZone: string): LocalTimeInfo {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const byType: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    byType[part.type] = Number(part.value);
  }

  const year = byType.year;
  const month = byType.month;
  const day = byType.day;
  const hour = byType.hour;
  const minute = byType.minute;
  const second = byType.second;

  const utcEquivalent = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const offsetMs = utcEquivalent - now.getTime();

  const startOfDayUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMs);
  const nextMidnightUtc = new Date(startOfDayUtc.getTime() + 24 * HOUR_MS);

  return {
    timeZone,
    year,
    month,
    day,
    hour,
    minute,
    offsetMs,
    startOfDayUtc,
    nextMidnightUtc,
  };
}

function planToSessionHours(planName?: string) {
  const plan = String(planName || "").toLowerCase();

  if (!plan || plan.includes("free")) return 6;
  if (plan.includes("electric") || plan.includes("silver")) return 12;
  if (plan.includes("turbo") || plan.includes("gold")) return 18;
  if (plan.includes("nuclear") || plan.includes("platinum")) return 24;
  return 24;
}

async function processMiningNotifications(email: string, now: Date, user: any, mining: any | null) {
  if (!mining) return;
  const isActive = !!mining.isMiningActive;
  const lastClaim = mining.lastClaimTime ? new Date(mining.lastClaimTime) : null;
  const lastStop = mining.lastStopAt ? new Date(mining.lastStopAt) : null;
  const startTime = mining.startTime ? new Date(mining.startTime) : null;

  if (!isActive) {
    const lastEvent = lastStop || lastClaim || startTime || (user?.lastActive ? new Date(user.lastActive) : null);
    if (lastEvent) {
      const idleMs = now.getTime() - lastEvent.getTime();
      if (idleMs >= HOUR_MS) {
        await notificationService.sendMiningStartReminder(email, {
          user,
          idleMinutes: Math.floor(idleMs / (60 * 1000)),
        });
      }
    }
    return;
  }

  if (!lastClaim) return;

  const sessionStart = lastClaim;
  const sub = await subscriptionService.getUserSubscriptionForUi(email, COIN_SYMBOL).catch(() => null);
  const planName =
    sub?.status === 200
      ? sub?.data?.planName || sub?.data?.plan || mining.miningPlan
      : mining.miningPlan;

  const sessionHours = planToSessionHours(planName);
  const sessionEnd = new Date(sessionStart.getTime() + sessionHours * HOUR_MS);
  const msLeft = sessionEnd.getTime() - now.getTime();

  if (msLeft > 0 && msLeft <= 10 * 60 * 1000) {
    await notificationService.sendMiningSessionEndingSoon(email, {
      user,
      sessionStart,
      minutesLeft: Math.ceil(msLeft / (60 * 1000)),
      sessionLengthHours: sessionHours,
    });
  }
}

async function processAdNotifications(email: string, now: Date, user: any, localTime: LocalTimeInfo) {
  const status = await dailyAdsService.getStatus(email);
  const remaining = status.remaining ?? Math.max(25 - (status.count ?? 0), 0);

  if ((status.count ?? 0) >= 25) {
    return;
  }

  // time windows for general reminders
  if (REMINDER_WINDOWS.includes(localTime.hour) && localTime.minute < 10) {
    const windowStartUtc = new Date(localTime.startOfDayUtc.getTime() + localTime.hour * HOUR_MS);
    await notificationService.sendDailyAdsReminder(email, {
      user,
      since: windowStartUtc,
      remaining,
    });
  }

  if ((status.count ?? 0) >= 20 && (status.count ?? 0) < 25) {
    await notificationService.sendDailyAdsCloseReminder(email, {
      user,
      since: localTime.startOfDayUtc,
      remaining,
    });
  }

  const msUntilReset = localTime.nextMidnightUtc.getTime() - now.getTime();
  if (msUntilReset > 0 && msUntilReset <= 60 * 60 * 1000 && localTime.minute < 10) {
    await notificationService.sendDailyAdsResetReminder(email, {
      user,
      since: localTime.startOfDayUtc,
      remaining,
    });
  }
}

async function processMilestones(email: string, user: any, mining: any | null) {
  if (!mining) return;

  const totalMined = Number(mining.totalMined ?? 0);
  if (totalMined >= 10000) {
    await notificationService.sendMilestoneUnlocked(email, 10000, { user });
  }
  if (totalMined >= 100000) {
    await notificationService.sendMilestoneUnlocked(email, 100000, { user });
  }
}

async function processInactivity(email: string, now: Date, user: any) {
  const lastActive = user?.lastActive ? new Date(user.lastActive) : null;
  if (!lastActive) return;

  const inactiveMs = now.getTime() - lastActive.getTime();
  if (inactiveMs >= 48 * HOUR_MS) {
    await notificationService.sendInactiveRecovery(email, {
      user,
      lastActive,
    });
  }
}

async function processUser(user: any, now: Date) {
  const email = String(user?.email || "").toLowerCase().trim();
  if (!email) return;

  const timeZone = resolveTimezone(user);
  const localTime = getLocalTimeInfo(now, timeZone);

  const mining = await miningService.findOne({ email, coinSymbol: COIN_SYMBOL });

  await processMiningNotifications(email, now, user, mining);
  await processAdNotifications(email, now, user, localTime);
  await processMilestones(email, user, mining);
  await processInactivity(email, now, user);
}

export async function runEngagementNotificationSweep(now = new Date()) {
  const projection = {
    email: 1,
    fcmToken: 1,
    deviceType: 1,
    basic: 1,
    lastActive: 1,
    firstName: 1,
    lastName: 1,
  };
  const cond = { email: { $exists: true, $nin: ["", null] } };
  const CHUNK_SIZE = 500;
  let skip = 0;

  while (true) {
    const users = await userService.findPaginatedSkip(CHUNK_SIZE, skip, { email: 1 }, cond, projection as any);
    if (!users.length) break;

    for (const user of users) {
      await processUser(user, now);
    }

    skip += users.length;
  }
}

export const setupEngagementNotificationJob = (redisClient: any, timezone = "Asia/Kolkata") => {
  scheduleExactlyOnce({
    cronExpr: "*/5 * * * *",
    jobName: "engagement_notification_sweep",
    timezone,
    redis: redisClient,
    slotKeyFn: minuteSlot,
    lockTtlMs: 30 * 60 * 1000,
    run: () => runEngagementNotificationSweep().catch((err) =>
      console.error("[engagement_notification_sweep] failed:", err)
    ),
  });
};
