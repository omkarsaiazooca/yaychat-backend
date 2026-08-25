import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { ModerationCase } from "../data/yaysTelemetry";

export interface ModerationCaseModel
  extends IDocumentModel<ModerationCase>,
    ModerationCase {}

const moderationCaseSchema = new Schema(
  {
    caseId: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    sourceRef: { type: String, required: true },
    reporterLower: { type: String, default: "" },
    subjectLower: { type: String, default: "" },
    reason: { type: String, default: "" },
    excerpt: { type: String, default: "" },
    status: { type: String, default: "open" },
    assignedToLower: { type: String, default: null },
    resolution: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Importing the same report twice must not create a second case.
moderationCaseSchema.index({ source: 1, sourceRef: 1 }, { unique: true });
moderationCaseSchema.index({ status: 1, createdAt: -1 });

export default moderationCaseSchema;
