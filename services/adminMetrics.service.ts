import { AnalyticsRollupService } from "./analyticsRollup.service";
import { AnalyticsEventService } from "./analyticsEvent.service";
import { CrashReportService } from "./crashReport.service";
import { ModerationCaseService } from "./moderationCase.service";
import { PushDeviceService } from "./pushDevice.service";
import { YaysNotificationService } from "./yaysNotification.service";
import { pushTransportStatus } from "./notifications/transports";
import { utcDay } from "./analytics/eventCatalog";

/**
 * Module 6 (deferred slice) — the read model behind the admin portal.
 *
 * One call assembles the operational picture: adoption, reliability, the push
 * pipeline's health, and the moderation backlog. Everything here is read-only;
 * the admin portal's write actions live on their owning services.
 */
export class AdminMetricsService {
  private rollups = new AnalyticsRollupService();
  private events = new AnalyticsEventService();
  private crashes = new CrashReportService();
  private moderation = new ModerationCaseService();
  private devices = new PushDeviceService();
  private notifications = new YaysNotificationService();

  async overview(days = 14) {
    const today = utcDay();
    const [series, moderationCounts, activeDevices, crashGroups, todayRollup] =
      await Promise.all([
        this.rollups.range(days),
        this.moderation.counts(),
        this.devices.countActive(),
        this.crashes.groups(5, days),
        this.rollups.computeDay(today),
      ]);

    const pushOutcomes = await this.pushOutcomeBreakdown(days);

    return {
      generatedAt: new Date().toISOString(),
      today: {
        day: today,
        activeUsers: todayRollup.activeUsers,
        sessions: todayRollup.sessions,
        events: todayRollup.eventCount,
        crashes: todayRollup.crashCount,
        crashFreeSessionRate: todayRollup.crashFreeSessionRate,
        pushSent: todayRollup.pushSent,
        pushDelivered: todayRollup.pushDelivered,
      },
      series: series.map((row) => ({
        day: row.day,
        activeUsers: row.activeUsers,
        sessions: row.sessions,
        events: row.eventCount,
        crashes: row.crashCount,
        crashFreeSessionRate: row.crashFreeSessionRate,
        pushSent: row.pushSent,
        pushDelivered: row.pushDelivered,
      })),
      push: {
        transport: pushTransportStatus(),
        activeDevices,
        outcomes: pushOutcomes,
      },
      crashes: {
        topGroups: crashGroups.map((group) => ({
          fingerprint: group._id,
          name: group.name,
          message: group.message,
          count: group.count,
          users: group.users,
          appVersion: group.appVersion || null,
          lastSeen: group.lastSeen,
        })),
      },
      moderation: moderationCounts,
    };
  }

  /**
   * Why notifications did not land. A dashboard that only reports "sent" hides
   * the failure this module exists to prevent: pushes suppressed by a
   * preference nobody knew was off, or dropped against dead tokens.
   */
  private async pushOutcomeBreakdown(days: number) {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 86400000);
    const rows = await this.notifications.findAggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$outcome", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id || "unknown", row.count]));
  }

  async eventExplorer(filter: { name?: string; userLower?: string }, limit: number) {
    const rows = await this.events.recent(filter, limit);
    return rows.map((row) => ({
      eventId: row.eventId,
      name: row.name,
      user: row.userLower || null,
      platform: row.platform,
      appVersion: row.appVersion || null,
      props: row.props,
      occurredAt: row.occurredAt,
    }));
  }
}
