// models/dailyMiningStats.ts
import { Schema, model } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DailyMiningStats } from "../data/dailyMiningStats";

export interface DailyMiningStatsModel extends IDocumentModel<DailyMiningStats>, DailyMiningStats {
}

const dailyMiningStatsSchema = new Schema(
    {
        day: { type: String, index: true, required: true }, // "YYYY-MM-DD" (UTC or your chosen TZ label)
        coinSymbol: { type: String, index: true, required: true }, // e.g. "BTCY"
        // Backfilled metric:
        newUsersCount: { type: Number, default: 0 }, // users whose Mining doc was FIRST created that day

        // Live metrics from now on:
        totalMined: { type: Number, default: 0 }, // sum(rewards credited today via claim/stop)
        distinctSignupEmails: { type: [String], default: [] }, // emails credited today (for exact distinct)
    },
    { versionKey: false, timestamps: true }
);

dailyMiningStatsSchema.index({ day: 1, coinSymbol: 1 }, { unique: true });
export default dailyMiningStatsSchema;