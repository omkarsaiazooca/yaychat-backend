import { ServiceBase } from "./base";
import analyticsEventSchema, { AnalyticsEventModel } from "../models/analyticsEvent";
import { AnalyticsEvent, AnalyticsPlatform } from "../data/yaysTelemetry";
import { isKnownEvent, sanitizeProps, utcDay } from "./analytics/eventCatalog";

const PLATFORMS: AnalyticsPlatform[] = ["ios", "android", "web", "server"];

/** Cap on one batch so a looping client cannot flood a single request. */
export const MAX_BATCH = 100;

export interface RawEvent {
  eventId?: string;
  name?: string;
  props?: Record<string, unknown>;
  occurredAt?: string | number | Date;
  sessionId?: string;
}

export interface IngestContext {
  userLower: string;
  anonymousId: string;
  platform: string;
  appVersion?: string;
}

export interface IngestSummary {
  accepted: number;
  /** Already stored — a retried batch. Not an error. */
  duplicates: number;
  /** Unknown name, missing id, or unparseable timestamp. */
  rejected: number;
  rejectedNames: string[];
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export class AnalyticsEventService extends ServiceBase<
  AnalyticsEvent,
  AnalyticsEventModel
> {
  constructor() {
    super(analyticsEventSchema, "YaysAnalyticsEvent");
  }

  /**
   * Ingest a client batch.
   *
   * Insert is unordered so one bad row never discards the rest, and the unique
   * index on `eventId` makes a re-sent batch idempotent — the client can retry
   * freely without inflating counts.
   */
  async ingest(events: RawEvent[], context: IngestContext): Promise<IngestSummary> {
    const summary: IngestSummary = {
      accepted: 0,
      duplicates: 0,
      rejected: 0,
      rejectedNames: [],
    };
    const platform: AnalyticsPlatform = PLATFORMS.includes(context.platform as AnalyticsPlatform)
      ? (context.platform as AnalyticsPlatform)
      : "ios";
    const receivedAt = new Date();
    const rows: AnalyticsEvent[] = [];

    for (const raw of (events || []).slice(0, MAX_BATCH)) {
      const name = String(raw?.name || "").trim();
      const eventId = String(raw?.eventId || "").trim();
      const occurredAt = toDate(raw?.occurredAt) || receivedAt;
      if (!eventId || !isKnownEvent(name)) {
        summary.rejected += 1;
        if (name && !summary.rejectedNames.includes(name)) {
          summary.rejectedNames.push(name);
        }
        continue;
      }
      rows.push({
        eventId,
        name,
        userLower: context.userLower,
        anonymousId: context.anonymousId,
        sessionId: String(raw?.sessionId || ""),
        platform,
        appVersion: context.appVersion,
        props: sanitizeProps(name, raw?.props),
        occurredAt,
        receivedAt,
        day: utcDay(occurredAt),
      } as AnalyticsEvent);
    }

    if (!rows.length) {
      return summary;
    }

    try {
      const inserted = await (this.repo as any)._model.insertMany(rows, {
        ordered: false,
      });
      summary.accepted = inserted.length;
    } catch (error: any) {
      // `insertMany({ordered:false})` throws after inserting what it could;
      // `insertedDocs`/`result.nInserted` tell us how many landed.
      const insertedCount =
        error?.insertedDocs?.length ??
        error?.result?.result?.nInserted ??
        error?.result?.nInserted ??
        0;
      summary.accepted = insertedCount;
      const writeErrors: any[] = error?.writeErrors || error?.result?.result?.writeErrors || [];
      for (const writeError of writeErrors) {
        if ((writeError?.code ?? writeError?.err?.code) === 11000) {
          summary.duplicates += 1;
        } else {
          summary.rejected += 1;
        }
      }
      if (!writeErrors.length && !insertedCount) {
        throw error;
      }
    }

    return summary;
  }

  async countForDay(day: string): Promise<number> {
    return this.findCount({ day });
  }

  /** Event-name histogram for one UTC day. */
  async countsByName(day: string): Promise<Record<string, number>> {
    const rows = await this.findAggregate<{ _id: string; count: number }>([
      { $match: { day } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  async distinctUserCount(day: string): Promise<number> {
    const rows = await this.findAggregate<{ _id: null; count: number }>([
      { $match: { day, userLower: { $ne: "" } } },
      { $group: { _id: "$userLower" } },
      { $count: "count" },
    ] as any);
    return Number((rows as any)?.[0]?.count || 0);
  }

  async sessionCount(day: string): Promise<number> {
    const rows = await this.findAggregate<{ count: number }>([
      { $match: { day, sessionId: { $ne: "" } } },
      { $group: { _id: "$sessionId" } },
      { $count: "count" },
    ] as any);
    return Number((rows as any)?.[0]?.count || 0);
  }

  /** Recent events for the admin explorer, newest first. */
  async recent(filter: { name?: string; userLower?: string }, limit = 50): Promise<AnalyticsEvent[]> {
    const cond: Record<string, unknown> = {};
    if (filter.name) {
      cond.name = filter.name;
    }
    if (filter.userLower) {
      cond.userLower = filter.userLower;
    }
    return this.findPaginated(Math.min(Math.max(limit, 1), 200), { occurredAt: -1 }, cond, {});
  }
}
