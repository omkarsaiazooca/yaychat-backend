import { Request, Response } from "express";
import { AnalyticsEventService, MAX_BATCH } from "../services/analyticsEvent.service";
import { CrashReportService } from "../services/crashReport.service";
import { EVENT_CATALOG } from "../services/analytics/eventCatalog";

const events = new AnalyticsEventService();
const crashes = new CrashReportService();

/**
 * Telemetry ingest.
 *
 * Auth is optional by design: the events that matter most for onboarding
 * (`app_open`, `signup_started`) happen before a session exists. When a bearer
 * token is present the middleware has already attached the user, and the
 * `anonymousId` lets pre-auth and post-auth events stitch into one funnel.
 */
const contextOf = (req: Request) => ({
  userLower: String((req as any).user?.email || "").trim().toLowerCase(),
  anonymousId: String(req.body?.anonymousId || "").trim().slice(0, 64),
  platform: String(req.body?.platform || "ios").trim(),
  appVersion: req.body?.appVersion ? String(req.body.appVersion).slice(0, 40) : undefined,
});

export class YaysTelemetryController {
  constructor() {
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysTelemetryController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /** The event catalogue, so a client can validate before it ships anything. */
  async getCatalog(_req: Request, res: Response) {
    return res.status(200).json({
      data: {
        maxBatch: MAX_BATCH,
        events: Object.entries(EVENT_CATALOG).map(([name, spec]) => ({
          name,
          props: spec.props,
          description: spec.description,
        })),
      },
    });
  }

  async ingestEvents(req: Request, res: Response) {
    try {
      const batch = Array.isArray(req.body?.events) ? req.body.events : [];
      if (!batch.length) {
        return res.status(200).json({
          data: { accepted: 0, duplicates: 0, rejected: 0, rejectedNames: [] },
        });
      }
      const summary = await events.ingest(batch, contextOf(req));
      return res.status(202).json({ data: summary });
    } catch (error) {
      console.error("[m6/telemetry] ingestEvents", error);
      // A failed ingest must never look like success, or the client drops the
      // batch it should have retried.
      return res
        .status(500)
        .json({ message: "Could not record events.", code: "server" });
    }
  }

  async reportCrash(req: Request, res: Response) {
    try {
      const context = contextOf(req);
      const batch = Array.isArray(req.body?.crashes)
        ? req.body.crashes
        : [req.body?.crash].filter(Boolean);
      if (!batch.length) {
        return res.status(400).json({ message: "crash is required.", code: "validation" });
      }
      let recorded = 0;
      for (const raw of batch.slice(0, 20)) {
        if (await crashes.report(raw, context)) {
          recorded += 1;
        }
      }
      return res.status(202).json({ data: { recorded, received: batch.length } });
    } catch (error) {
      console.error("[m6/telemetry] reportCrash", error);
      return res
        .status(500)
        .json({ message: "Could not record the crash report.", code: "server" });
    }
  }
}
