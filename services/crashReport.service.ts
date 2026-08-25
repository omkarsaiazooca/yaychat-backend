import { createHash } from "crypto";
import { ServiceBase } from "./base";
import crashReportSchema, { CrashReportModel } from "../models/crashReport";
import { AnalyticsPlatform, CrashReport } from "../data/yaysTelemetry";
import { utcDay } from "./analytics/eventCatalog";
import { IngestContext } from "./analyticsEvent.service";

const MAX_STACK_CHARS = 8000;
const MAX_BREADCRUMBS = 20;

/**
 * Strip everything release-specific from a stack frame so the same bug from
 * two builds groups together: absolute paths, bundle hashes, line/column
 * numbers, and memory addresses all vary without the defect changing.
 */
const normaliseFrame = (frame: string): string =>
  frame
    .trim()
    .replace(/https?:\/\/[^\s)]+/g, "<bundle>")
    .replace(/\/[^\s():]*\//g, "/")
    .replace(/:\d+:\d+/g, "")
    .replace(/0x[0-9a-f]+/gi, "0x")
    .replace(/\s+/g, " ");

export const fingerprintOf = (name: string, message: string, stack: string): string => {
  const frames = String(stack || "")
    .split("\n")
    .map(normaliseFrame)
    .filter((frame) => frame.length > 0)
    .slice(0, 5);
  // The message is deliberately excluded: interpolated ids ("user 42 not
  // found") would split one defect into thousands of groups.
  const basis = [String(name || "Error"), ...frames].join("|");
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
};

export interface RawCrash {
  crashId?: string;
  level?: string;
  name?: string;
  message?: string;
  stack?: string;
  breadcrumbs?: unknown;
  occurredAt?: string | number | Date;
  osVersion?: string;
}

export class CrashReportService extends ServiceBase<CrashReport, CrashReportModel> {
  constructor() {
    super(crashReportSchema, "YaysCrashReport");
  }

  /** Record one crash. A repeat of the same `crashId` is a no-op. */
  async report(raw: RawCrash, context: IngestContext): Promise<CrashReport | null> {
    const crashId = String(raw?.crashId || "").trim();
    if (!crashId) {
      return null;
    }
    const name = String(raw?.name || "Error").slice(0, 200);
    const message = String(raw?.message || "").slice(0, 1000);
    const stack = String(raw?.stack || "").slice(0, MAX_STACK_CHARS);
    const occurredAt = raw?.occurredAt ? new Date(raw.occurredAt as any) : new Date();
    const when = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

    try {
      return await this.create({
        crashId,
        userLower: context.userLower,
        anonymousId: context.anonymousId,
        platform: (context.platform as AnalyticsPlatform) || "ios",
        appVersion: context.appVersion,
        osVersion: raw?.osVersion ? String(raw.osVersion).slice(0, 60) : undefined,
        level: raw?.level === "handled" ? "handled" : "fatal",
        name,
        message,
        stack,
        fingerprint: fingerprintOf(name, message, stack),
        breadcrumbs: Array.isArray(raw?.breadcrumbs)
          ? raw.breadcrumbs.slice(-MAX_BREADCRUMBS).map((crumb) => String(crumb).slice(0, 120))
          : [],
        occurredAt: when,
        receivedAt: new Date(),
        day: utcDay(when),
      } as CrashReport);
    } catch (error: any) {
      if (error?.code === 11000) {
        return null;
      }
      throw error;
    }
  }

  async countForDay(day: string, level?: "fatal" | "handled"): Promise<number> {
    return this.findCount(level ? { day, level } : { day });
  }

  /**
   * Crashes grouped by fingerprint for the admin dashboard: one row per defect
   * with its occurrence count, affected users, and latest sighting.
   */
  async groups(limit = 25, sinceDays = 7) {
    const since = new Date(Date.now() - sinceDays * 86400000);
    return this.findAggregate<{
      _id: string;
      count: number;
      users: number;
      name: string;
      message: string;
      lastSeen: Date;
      appVersion?: string;
    }>([
      { $match: { occurredAt: { $gte: since } } },
      {
        $group: {
          _id: "$fingerprint",
          count: { $sum: 1 },
          userSet: { $addToSet: "$userLower" },
          name: { $last: "$name" },
          message: { $last: "$message" },
          appVersion: { $last: "$appVersion" },
          lastSeen: { $max: "$occurredAt" },
        },
      },
      { $addFields: { users: { $size: "$userSet" } } },
      { $project: { userSet: 0 } },
      { $sort: { count: -1 } },
      { $limit: Math.min(Math.max(limit, 1), 100) },
    ] as any);
  }

  async byFingerprint(fingerprint: string, limit = 20): Promise<CrashReport[]> {
    return this.findPaginated(
      Math.min(Math.max(limit, 1), 100),
      { occurredAt: -1 },
      { fingerprint },
      {}
    );
  }
}
