import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityReportSchema, {
  YaysCommunityReportModel,
} from "../models/yaysCommunityReport";
import {
  CommunityReport,
  ReportStatus,
  ReportTargetType,
} from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityReportService extends ServiceBase<
  CommunityReport,
  YaysCommunityReportModel
> {
  constructor() {
    super(yaysCommunityReportSchema, "YaysCommunityReport");
  }

  /**
   * File a report. Re-reporting the same target while the first is still open
   * returns that report rather than queueing a duplicate — the unique partial
   * index enforces it, this method just makes the duplicate a no-op instead of
   * a 500.
   */
  async file(input: {
    communityId: string;
    targetType: ReportTargetType;
    targetId?: string | null;
    reporterLower: string;
    reporterName: string;
    subjectLower?: string | null;
    reason: string;
    excerpt?: string;
  }): Promise<CommunityReport> {
    const reporterLower = lower(input.reporterLower);
    const targetId = input.targetId || null;
    const existing = await this.findOne({
      communityId: input.communityId,
      reporterLower,
      targetType: input.targetType,
      targetId,
      status: "open",
    });
    if (existing) {
      return existing;
    }
    try {
      return await this.create({
        reportId: randomUUID(),
        communityId: input.communityId,
        targetType: input.targetType,
        targetId,
        reporterLower,
        reporterName: input.reporterName,
        subjectLower: input.subjectLower ? lower(input.subjectLower) : null,
        reason: String(input.reason || "Reported").slice(0, 200),
        excerpt: String(input.excerpt || "").slice(0, 500),
        status: "open",
      } as CommunityReport);
    } catch (error: any) {
      if (error?.code === 11000) {
        const raced = await this.findOne({
          communityId: input.communityId,
          reporterLower,
          targetType: input.targetType,
          targetId,
          status: "open",
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  async queue(communityId: string, limit = 100): Promise<CommunityReport[]> {
    return this.findPaginated(limit, { status: 1, createdAt: 1 }, { communityId }, {});
  }

  async byReportId(reportId: string): Promise<CommunityReport | null> {
    return this.findOne({ reportId });
  }

  async resolve(
    reportId: string,
    status: Exclude<ReportStatus, "open">,
    byLower: string
  ): Promise<CommunityReport | null> {
    await this.updatePart(
      { reportId },
      {
        $set: {
          status,
          assignedToLower: lower(byLower),
          resolvedAt: new Date(),
        },
      }
    );
    return this.byReportId(reportId);
  }

  async openCount(communityId: string): Promise<number> {
    return this.findCount({ communityId, status: "open" });
  }

  async removeAllFor(communityId: string): Promise<void> {
    await this.deleteMany({ communityId });
  }
}
