import mongoose, { Document, Schema } from "mongoose";
import { Mining } from "../data/mining";
import { IDocumentModel } from "../data/base";

export interface MiningModel extends IDocumentModel<Mining>, Mining {}

const miningSchema: Schema = new Schema({
  email: { type: String },
  startTime: { type: Date },
  lastClaimTime: { type: Date },
  lastProcessedCycleStart: { type: Date },
  lastStopAt: { type: Date },
  adsExtendedEndAt: { type: Date },
  last24HourRunAt: { type: Date },
  totalMined: { type: Number, default: 0 },
  miningPlan: {
    type: String,
    enum: [
      "free",
      "electric",
      "turbo",
      "nuclear",

      "electric3month",
      "turbo3month",
      "nuclear3month",

      "weeklyElectric",
      "weeklyTurbo",
      "weeklyNuclear",

      "event15x1day",
      "event15x3day",
      "event15x7day",
    ],
    default: "free",
  },
  miningRate: { type: Number, default: 24 }, // Mining rate per day
  isMiningActive: { type: Boolean, default: false },
  coinSymbol: { type: String },
  planSyncedAt: { type: Date },
  sessionDurationHours: { type: Number, default: null },
});

miningSchema.index({ email: 1, coinSymbol: 1 }, { unique: true });
miningSchema.index({ email: 1, coinSymbol: 1, isMiningActive: 1 });
miningSchema.index({ isMiningActive: 1, startTime: 1 });
miningSchema.index({ isMiningActive: 1, lastClaimTime: 1 });

export default miningSchema;
