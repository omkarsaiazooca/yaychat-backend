import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import moderationCaseSchema, { ModerationCaseModel } from "../models/moderationCase";
import {
  ModerationCase,
  ModerationSource,
  ModerationStatus,
} from "../data/yaysTelemetry";
import { ChatUserReportService } from "./chatUserReport.service";
import { AiAssistantReportService } from "./aiAssistantReport.service";
import { YaysCommunityReportService } from "./yaysCommunityReport.service";

const STATUSES: ModerationStatus[] = ["open", "in_review", "actioned", "dismissed"];

/**
 * Module 6 (deferred slice) — the unified moderation queue.
 *
 * Reports arrive in three different collections written by three different
 * modules. Rather than migrate them, this service *projects* them into one
 * queue keyed by `(source, sourceRef)`, so importing twice is a no-op and the
 * original rows stay the property of the module that owns them.
 */
export class ModerationCaseService extends ServiceBase<
  ModerationCase,
  ModerationCaseModel
> {
  private chatReports = new ChatUserReportService();
  private aiReports = new AiAssistantReportService();
  private communityReports = new YaysCommunityReportService();

  constructor() {
    super(moderationCaseSchema, "YaysModerationCase");
  }

  /** Pull new reports from every source into the queue. Idempotent. */
  async sync(limit = 200): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    const chat = await this.chatReports
      .findPaginated(limit, { createdAt: -1 }, {}, {})
      .catch(() => [] as any[]);
    for (const report of chat as any[]) {
      const created = await this.importOne({
        source: "chat_report",
        sourceRef: String(report?._id || ""),
        reporterLower: String(report?.reporterLower || "").toLowerCase(),
        subjectLower: String(report?.reportedLower || "").toLowerCase(),
        reason: String(report?.reason || "Reported in chat"),
        excerpt: report?.messageId ? `message ${report.messageId}` : "",
      });
      created ? (imported += 1) : (skipped += 1);
    }

    const ai = await this.aiReports
      .findPaginated(limit, { createdAt: -1 }, {}, {})
      .catch(() => [] as any[]);
    for (const report of ai as any[]) {
      const created = await this.importOne({
        source: "ai_report",
        sourceRef: String(report?._id || ""),
        reporterLower: String(report?.userLower || "").toLowerCase(),
        // The subject of an AI report is the assistant, not a person.
        subjectLower: "ai:assistant",
        reason: String(report?.reason || "Reported AI answer"),
        excerpt: String(report?.excerpt || "").slice(0, 500),
      });
      created ? (imported += 1) : (skipped += 1);
    }

    // M3 community reports — the third source this queue was designed for.
    const community = await this.communityReports
      .findPaginated(limit, { createdAt: -1 }, {}, {})
      .catch(() => [] as any[]);
    for (const report of community as any[]) {
      const created = await this.importOne({
        source: "community_report",
        sourceRef: String(report?._id || ""),
        reporterLower: String(report?.reporterLower || "").toLowerCase(),
        // A community report may name a person or the community itself.
        subjectLower: String(
          report?.subjectLower || `community:${report?.communityId || ""}`
        ).toLowerCase(),
        reason: String(report?.reason || "Reported in a community"),
        excerpt: String(report?.excerpt || "").slice(0, 500),
      });
      created ? (imported += 1) : (skipped += 1);
    }

    return { imported, skipped };
  }

  /** Returns the created case, or `null` when it already existed. */
  private async importOne(input: {
    source: ModerationSource;
    sourceRef: string;
    reporterLower: string;
    subjectLower: string;
    reason: string;
    excerpt?: string;
  }): Promise<ModerationCase | null> {
    if (!input.sourceRef) {
      return null;
    }
    try {
      return await this.create({
        caseId: randomUUID(),
        status: "open",
        assignedToLower: null,
        resolution: null,
        resolvedAt: null,
        excerpt: "",
        ...input,
      } as ModerationCase);
    } catch (error: any) {
      if (error?.code === 11000) {
        return null;
      }
      throw error;
    }
  }

  async queue(
    filter: { status?: string; source?: string } = {},
    limit = 50,
    skip = 0
  ): Promise<ModerationCase[]> {
    const cond: Record<string, unknown> = {};
    if (filter.status && STATUSES.includes(filter.status as ModerationStatus)) {
      cond.status = filter.status;
    }
    if (filter.source) {
      cond.source = filter.source;
    }
    return this.findPaginatedSkip(
      Math.min(Math.max(limit, 1), 200),
      Math.max(skip, 0),
      { createdAt: -1 },
      cond,
      {}
    );
  }

  async counts(): Promise<Record<ModerationStatus, number>> {
    const rows = await this.findAggregate<{ _id: ModerationStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const out = { open: 0, in_review: 0, actioned: 0, dismissed: 0 } as Record<
      ModerationStatus,
      number
    >;
    for (const row of rows) {
      if (STATUSES.includes(row._id)) {
        out[row._id] = row.count;
      }
    }
    return out;
  }

  async assign(caseId: string, moderatorLower: string): Promise<ModerationCase> {
    return this.findOneUpdate(
      { caseId },
      { $set: { assignedToLower: moderatorLower, status: "in_review" } },
      { new: true }
    );
  }

  async resolve(
    caseId: string,
    status: "actioned" | "dismissed",
    resolution: string,
    moderatorLower: string
  ): Promise<ModerationCase> {
    return this.findOneUpdate(
      { caseId },
      {
        $set: {
          status,
          resolution: String(resolution || "").slice(0, 1000),
          assignedToLower: moderatorLower,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );
  }
}
