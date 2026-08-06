import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { MiningStreak } from "../data/miningStreak";

export interface MiningStreakModel extends IDocumentModel<MiningStreak>, MiningStreak {}

const miningStreakSchema = new Schema(
  {
    email:                   { type: String, unique: true, index: true, required: true },
    currentStreak:           { type: Number, default: 0 },
    lastCycleStartedAt:      { type: Date,   default: null }, // start of last COMPLETED cycle
    activeCycleStartedAt:    { type: Date,   default: null }, // start of current in-progress cycle
    completedSessionsToday:  { type: Number, default: 0 },
    completedHoursToday:     { type: Number, default: 0 },
    requiredSessionsToday:   { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true }
);

miningStreakSchema.index({ email: 1 }, { unique: true });

export default miningStreakSchema;
