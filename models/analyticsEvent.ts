import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AnalyticsEvent } from "../data/yaysTelemetry";

export interface AnalyticsEventModel
  extends IDocumentModel<AnalyticsEvent>,
    AnalyticsEvent {}

const analyticsEventSchema = new Schema(
  {
    eventId: { type: String, required: true },
    name: { type: String, required: true },
    userLower: { type: String, default: "" },
    anonymousId: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    platform: { type: String, default: "ios" },
    appVersion: { type: String, default: null },
    props: { type: Object, default: {} },
    occurredAt: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    day: { type: String, required: true },
  },
  { timestamps: false }
);

// The client retries a batch it never got an ack for; this index is what makes
// that safe. Duplicate key on insert is treated as "already counted".
analyticsEventSchema.index({ eventId: 1 }, { unique: true });
analyticsEventSchema.index({ day: 1, name: 1 });
analyticsEventSchema.index({ userLower: 1, occurredAt: -1 });

export default analyticsEventSchema;
