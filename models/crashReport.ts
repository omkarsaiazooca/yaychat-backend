import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CrashReport } from "../data/yaysTelemetry";

export interface CrashReportModel extends IDocumentModel<CrashReport>, CrashReport {}

const crashReportSchema = new Schema(
  {
    crashId: { type: String, required: true },
    userLower: { type: String, default: "" },
    anonymousId: { type: String, default: "" },
    platform: { type: String, default: "ios" },
    appVersion: { type: String, default: null },
    osVersion: { type: String, default: null },
    level: { type: String, enum: ["fatal", "handled"], default: "fatal" },
    name: { type: String, default: "Error" },
    message: { type: String, default: "" },
    stack: { type: String, default: "" },
    fingerprint: { type: String, required: true },
    breadcrumbs: { type: [String], default: [] },
    occurredAt: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    day: { type: String, required: true },
  },
  { timestamps: false }
);

crashReportSchema.index({ crashId: 1 }, { unique: true });
// The admin crash list groups by fingerprint and sorts by recency.
crashReportSchema.index({ fingerprint: 1, occurredAt: -1 });
crashReportSchema.index({ day: 1 });

export default crashReportSchema;
