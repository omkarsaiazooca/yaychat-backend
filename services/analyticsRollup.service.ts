import { ServiceBase } from "./base";
import analyticsDailyRollupSchema, {
  AnalyticsDailyRollupModel,
} from "../models/analyticsDailyRollup";
import { AnalyticsDailyRollup } from "../data/yaysTelemetry";
import { AnalyticsEventService } from "./analyticsEvent.service";
import { CrashReportService } from "./crashReport.service";
import { YaysNotificationService } from "./yaysNotification.service";
import { safeCountKey, utcDay } from "./analytics/eventCatalog";

/**
 * The deferred half of M6's analytics: a one-row-per-day warehouse.
 *
 * The admin dashboard reads rollups, never the raw event collection. Raw
 * events are for the explorer and for recomputation; a dashboard that
 * aggregates millions of rows on every page load stops working exactly when
 * the product starts succeeding.
 */
export class AnalyticsRollupService extends ServiceBase<
  AnalyticsDailyRollup,
  AnalyticsDailyRollupModel
> {
  private events = new AnalyticsEventService();
  private crashes = new CrashReportService();
  private notifications = new YaysNotificationService();

  constructor() {
    super(analyticsDailyRollupSchema, "YaysAnalyticsDailyRollup");
  }

  /** Recompute one UTC day from raw events. Idempotent — safe to re-run. */
  async computeDay(day: string = utcDay()): Promise<AnalyticsDailyRollup> {
    const [counts, activeUsers, sessions, crashCount, fatalCrashCount, pushSent, pushDelivered] =
      await Promise.all([
        this.events.countsByName(day),
        this.events.distinctUserCount(day),
        this.events.sessionCount(day),
        this.crashes.countForDay(day),
        this.crashes.countForDay(day, "fatal"),
        this.countNotifications(day),
        this.countNotifications(day, "delivered"),
      ]);

    const eventCounts: Record<string, number> = {};
    let eventCount = 0;
    for (const [name, count] of Object.entries(counts)) {
      eventCounts[safeCountKey(name)] = count;
      eventCount += count;
    }

    const crashFreeSessionRate =
      sessions > 0
        ? Math.max(0, Math.round(((sessions - fatalCrashCount) / sessions) * 10000) / 100)
        : 100;

    return this.upsertOneAndGet(
      { day },
      {
        $set: {
          activeUsers,
          newUsers: eventCounts[safeCountKey("signup_completed")] || 0,
          sessions,
          eventCount,
          eventCounts,
          crashCount,
          fatalCrashCount,
          crashFreeSessionRate,
          pushSent,
          pushDelivered,
          computedAt: new Date(),
        },
        $setOnInsert: { day },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  /** Rollups for the last `days` days, oldest first, gaps computed on demand. */
  async range(days = 14): Promise<AnalyticsDailyRollup[]> {
    const span = Math.min(Math.max(days, 1), 90);
    const wanted: string[] = [];
    for (let offset = span - 1; offset >= 0; offset -= 1) {
      wanted.push(utcDay(new Date(Date.now() - offset * 86400000)));
    }
    const existing = await this.find({ day: { $in: wanted } });
    const byDay = new Map(existing.map((row) => [row.day, row]));
    const today = utcDay();

    const out: AnalyticsDailyRollup[] = [];
    for (const day of wanted) {
      // Today is always recomputed — it is still accumulating.
      if (day === today || !byDay.has(day)) {
        out.push(await this.computeDay(day));
      } else {
        out.push(byDay.get(day) as AnalyticsDailyRollup);
      }
    }
    return out;
  }

  private async countNotifications(day: string, outcome?: string): Promise<number> {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86400000);
    return this.notifications.findCount({
      createdAt: { $gte: start, $lt: end },
      ...(outcome ? { outcome } : {}),
    });
  }
}
