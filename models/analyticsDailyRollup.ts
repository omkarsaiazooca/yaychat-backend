import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AnalyticsDailyRollup } from "../data/yaysTelemetry";

export interface AnalyticsDailyRollupModel
  extends IDocumentModel<AnalyticsDailyRollup>,
    AnalyticsDailyRollup {}

const analyticsDailyRollupSchema = new Schema(
  {
    day: { type: String, required: true, unique: true },
    activeUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    eventCounts: { type: Object, default: {} },
    crashCount: { type: Number, default: 0 },
    fatalCrashCount: { type: Number, default: 0 },
    crashFreeSessionRate: { type: Number, default: 100 },
    pushSent: { type: Number, default: 0 },
    pushDelivered: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default analyticsDailyRollupSchema;
