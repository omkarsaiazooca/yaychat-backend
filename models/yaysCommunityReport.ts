import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityReport } from "../data/yaysCommunities";

export interface YaysCommunityReportModel
  extends IDocumentModel<CommunityReport>,
    CommunityReport {}

const yaysCommunityReportSchema = new Schema(
  {
    reportId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: null },
    reporterLower: { type: String, required: true },
    reporterName: { type: String, default: "" },
    subjectLower: { type: String, default: null },
    reason: { type: String, required: true },
    excerpt: { type: String, default: "" },
    status: { type: String, default: "open" },
    assignedToLower: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The community's own moderation queue: open items first, oldest first.
yaysCommunityReportSchema.index({ communityId: 1, status: 1, createdAt: 1 });
// One open report per reporter per target — spamming the queue with the same
// complaint neither hides it nor multiplies it.
yaysCommunityReportSchema.index(
  { communityId: 1, reporterLower: 1, targetType: 1, targetId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);
// M6's unified queue syncs from here.
yaysCommunityReportSchema.index({ createdAt: -1 });

export default yaysCommunityReportSchema;
