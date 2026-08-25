import { IModel } from "./base";

/**
 * Module 6 — Analytics, crash reporting, and the admin/moderation surface.
 *
 * The event pipeline is deliberately narrow: a fixed allowlist of event names
 * and a property whitelist per event. An open schema turns into an unqueryable
 * swamp within a month, and an unbounded property bag is a privacy hazard
 * (message text arriving in analytics because a screen passed the wrong prop).
 */

export type AnalyticsPlatform = "ios" | "android" | "web" | "server";

export interface AnalyticsEvent extends IModel {
  /** Client-generated UUID; the unique index on it makes ingest idempotent. */
  eventId: string;
  name: string;
  /** Empty for events emitted before sign-in. */
  userLower: string;
  /** Rotating per-install id so pre-auth events still form sessions. */
  anonymousId: string;
  sessionId?: string;
  platform: AnalyticsPlatform;
  appVersion?: string;
  props: Record<string, string | number | boolean>;
  /** When the client says it happened (may be older than `receivedAt`). */
  occurredAt: Date;
  receivedAt: Date;
  /** `YYYY-MM-DD` in UTC, denormalised so rollups never scan by date range. */
  day: string;
}

export interface CrashReport extends IModel {
  crashId: string;
  userLower: string;
  anonymousId: string;
  platform: AnalyticsPlatform;
  appVersion?: string;
  osVersion?: string;
  /** `fatal` = the JS thread died; `handled` = caught and reported. */
  level: "fatal" | "handled";
  name: string;
  message: string;
  stack: string;
  /** Stable hash of name + normalised top frames — the grouping key. */
  fingerprint: string;
  /** Last screens the user saw before the crash. */
  breadcrumbs: string[];
  occurredAt: Date;
  receivedAt: Date;
  day: string;
}

/** One row per UTC day; the small warehouse the admin dashboard reads. */
export interface AnalyticsDailyRollup extends IModel {
  day: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  eventCount: number;
  /** `{ [eventName]: count }` — Mongo keys cannot contain dots, so names use `_`. */
  eventCounts: Record<string, number>;
  crashCount: number;
  fatalCrashCount: number;
  /** Fatal crashes per 1,000 sessions. */
  crashFreeSessionRate: number;
  pushSent: number;
  pushDelivered: number;
  computedAt: Date;
}

export type ModerationSource = "chat_report" | "ai_report" | "community_report";
export type ModerationStatus = "open" | "in_review" | "actioned" | "dismissed";

/**
 * The deferred half of M6: reports from every surface land in one queue so a
 * moderator works a single list instead of three collections.
 */
export interface ModerationCase extends IModel {
  caseId: string;
  source: ModerationSource;
  /** `_id` of the originating report row. */
  sourceRef: string;
  reporterLower: string;
  subjectLower: string;
  reason: string;
  excerpt?: string;
  status: ModerationStatus;
  assignedToLower?: string | null;
  resolution?: string | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
