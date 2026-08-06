// models/dailyAdStreak.ts
import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DailyAdStreak } from "../data/dailyAds";

export interface DailyAdStreakModel extends IDocumentModel<DailyAdStreak>, DailyAdStreak {}

const dailyAdStreakSchema = new Schema(
  {
    email: { type: String, unique: true, index: true, required: true },
    currentDay: { type: Number, default: 0 },          // 0 means no completed day yet, else 1..7
    lastCompletedDate: { type: String, default: null } // "YYYY-MM-DD" of last fully completed 25/25 day
  },
  { versionKey: false, timestamps: true }
);

export default dailyAdStreakSchema;

dailyAdStreakSchema.index({ email: 1 }, { unique: true });