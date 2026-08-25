import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { AdminMetricsService } from "../services/adminMetrics.service";
import { AnalyticsRollupService } from "../services/analyticsRollup.service";
import { CrashReportService } from "../services/crashReport.service";
import { ModerationCaseService } from "../services/moderationCase.service";
import { notificationDelivery } from "../services/notificationDelivery.service";
import { buildDeepLink } from "../services/notifications/deepLinks";
import { recordAuditLog } from "../services/adminAuditLog.servcie";
import { NotificationCategory } from "../data/yaysNotifications";

const metrics = new AdminMetricsService();
const rollups = new AnalyticsRollupService();
const crashes = new CrashReportService();
const moderation = new ModerationCaseService();

const CATEGORIES: NotificationCategory[] = ["messages", "communities", "rewards", "system"];

const adminEmailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim().toLowerCase();

const asInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

const failed = (res: Response, error: any, context: string) => {
  console.error(`[m6/admin] ${context}`, error);
  return res.status(500).json({ message: "The admin service failed.", code: "server" });
};

/**
 * Module 6 (deferred slice) — the admin portal's API.
 *
 * Every route here is behind `validateAdminRole`, and every write records an
 * audit entry. Read routes are not audited: they would drown the log and the
 * portal's own dashboard polls them.
 */
export class YaysAdminController {
  constructor() {
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysAdminController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  async overview(req: Request, res: Response) {
    try {
      return res
        .status(200)
        .json({ data: await metrics.overview(asInt(req.query.days, 14)) });
    } catch (error) {
      return failed(res, error, "overview");
    }
  }

  async events(req: Request, res: Response) {
    try {
      const rows = await metrics.eventExplorer(
        {
          name: req.query.name ? String(req.query.name) : undefined,
          userLower: req.query.user ? String(req.query.user).toLowerCase() : undefined,
        },
        asInt(req.query.limit, 50)
      );
      return res.status(200).json({ data: rows });
    } catch (error) {
      return failed(res, error, "events");
    }
  }

  /** Force a rollup recompute — used after a backfill or a schema fix. */
  async recomputeRollup(req: Request, res: Response) {
    try {
      const day = String(req.body?.day || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return res
          .status(400)
          .json({ message: "day must be YYYY-MM-DD.", code: "validation" });
      }
      const rollup = await rollups.computeDay(day);
      await recordAuditLog(adminEmailOf(req), "m6.rollup.recompute", "POST", { day });
      return res.status(200).json({ data: rollup });
    } catch (error) {
      return failed(res, error, "recomputeRollup");
    }
  }

  async crashGroups(req: Request, res: Response) {
    try {
      const groups = await crashes.groups(asInt(req.query.limit, 25), asInt(req.query.days, 7));
      return res.status(200).json({
        data: groups.map((group) => ({
          fingerprint: group._id,
          name: group.name,
          message: group.message,
          count: group.count,
          users: group.users,
          appVersion: group.appVersion || null,
          lastSeen: group.lastSeen,
        })),
      });
    } catch (error) {
      return failed(res, error, "crashGroups");
    }
  }

  async crashDetail(req: Request, res: Response) {
    try {
      const rows = await crashes.byFingerprint(
        String(req.params.fingerprint || ""),
        asInt(req.query.limit, 20)
      );
      return res.status(200).json({ data: rows });
    } catch (error) {
      return failed(res, error, "crashDetail");
    }
  }

  async moderationQueue(req: Request, res: Response) {
    try {
      const [items, counts] = await Promise.all([
        moderation.queue(
          {
            status: req.query.status ? String(req.query.status) : undefined,
            source: req.query.source ? String(req.query.source) : undefined,
          },
          asInt(req.query.limit, 50),
          asInt(req.query.skip, 0)
        ),
        moderation.counts(),
      ]);
      return res.status(200).json({ data: { counts, items } });
    } catch (error) {
      return failed(res, error, "moderationQueue");
    }
  }

  /** Pull new reports from chat/AI into the unified queue. */
  async syncModeration(req: Request, res: Response) {
    try {
      const result = await moderation.sync(asInt(req.body?.limit, 200));
      await recordAuditLog(adminEmailOf(req), "m6.moderation.sync", "POST", result);
      return res.status(200).json({ data: result });
    } catch (error) {
      return failed(res, error, "syncModeration");
    }
  }

  async assignCase(req: Request, res: Response) {
    try {
      const admin = adminEmailOf(req);
      const updated = await moderation.assign(String(req.params.caseId || ""), admin);
      if (!updated) {
        return res.status(404).json({ message: "Case not found.", code: "not_found" });
      }
      await recordAuditLog(admin, "m6.moderation.assign", "POST", {
        caseId: req.params.caseId,
      });
      return res.status(200).json({ data: updated });
    } catch (error) {
      return failed(res, error, "assignCase");
    }
  }

  async resolveCase(req: Request, res: Response) {
    try {
      const status = String(req.body?.status || "");
      if (status !== "actioned" && status !== "dismissed") {
        return res
          .status(400)
          .json({ message: "status must be actioned or dismissed.", code: "validation" });
      }
      const admin = adminEmailOf(req);
      const updated = await moderation.resolve(
        String(req.params.caseId || ""),
        status,
        String(req.body?.resolution || ""),
        admin
      );
      if (!updated) {
        return res.status(404).json({ message: "Case not found.", code: "not_found" });
      }
      await recordAuditLog(admin, "m6.moderation.resolve", "POST", {
        caseId: req.params.caseId,
        status,
      });
      return res.status(200).json({ data: updated });
    } catch (error) {
      return failed(res, error, "resolveCase");
    }
  }

  /**
   * Broadcast to an explicit recipient list.
   *
   * There is no "everyone" target on purpose: an operational broadcast tool
   * that can wake the entire user base from one unreviewed request is an
   * incident waiting to happen. Audience selection belongs to M7's campaign
   * builder, with its own approval step.
   */
  async broadcast(req: Request, res: Response) {
    try {
      const recipients: string[] = Array.isArray(req.body?.recipients)
        ? req.body.recipients.map((email: unknown) => String(email))
        : [];
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const category = String(req.body?.category || "system") as NotificationCategory;

      if (!recipients.length) {
        return res
          .status(400)
          .json({ message: "recipients is required.", code: "validation" });
      }
      if (recipients.length > 500) {
        return res
          .status(400)
          .json({ message: "A broadcast is limited to 500 recipients.", code: "validation" });
      }
      if (!title || !body) {
        return res
          .status(400)
          .json({ message: "title and body are required.", code: "validation" });
      }
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Unknown category.", code: "validation" });
      }

      const broadcastId = randomUUID();
      const deepLink = req.body?.route
        ? buildDeepLink(String(req.body.route), req.body?.params || {})
        : null;

      const result = await notificationDelivery.deliverMany(recipients, {
        category,
        title,
        body,
        broadcastId,
        deepLink: deepLink ?? undefined,
        // Per-user dedupe so a retried broadcast cannot notify anyone twice.
        dedupeKey: `broadcast:${broadcastId}`,
        data: { type: "broadcast" },
      });

      const admin = adminEmailOf(req);
      await recordAuditLog(admin, "m6.notifications.broadcast", "POST", {
        broadcastId,
        category,
        recipients: recipients.length,
        delivered: result.delivered,
      });

      return res.status(200).json({
        data: {
          broadcastId,
          recipients: recipients.length,
          delivered: result.delivered,
          outcomes: result.results.reduce((acc: Record<string, number>, one) => {
            acc[one.outcome] = (acc[one.outcome] || 0) + 1;
            return acc;
          }, {}),
        },
      });
    } catch (error) {
      return failed(res, error, "broadcast");
    }
  }
}
