import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiUsageDaily } from "../data/aiAssistant";

export interface AiUsageDailyModel
  extends IDocumentModel<AiUsageDaily>,
    AiUsageDaily {}

const aiUsageDailySchema = new Schema(
  {
    userLower: { type: String, required: true },
    day: { type: String, required: true },
    plan: { type: String, default: "free" },
    requests: { type: Number, default: 0 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One counter row per user per UTC day — the quota gate reads and writes this.
aiUsageDailySchema.index({ userLower: 1, day: 1 }, { unique: true });

export default aiUsageDailySchema;
