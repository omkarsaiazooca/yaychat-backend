import { Schema, Document } from "mongoose";
import { StationEarningsHistory } from "../data/stationEarningsHistory";

export interface StationEarningsHistoryModel extends Document, StationEarningsHistory {}

const StationEarningsHistorySchema = new Schema<StationEarningsHistoryModel>(
  {
    ownerEmail:      { type: String, required: true, lowercase: true, trim: true },
    minerEmail:      { type: String, required: true, lowercase: true, trim: true },
    adType:          { type: String, required: true },
    cpmUsd:          { type: Number, required: true },
    revenueSharePct: { type: Number, required: true },
    grossUsdPerAd:   { type: Number, required: true },
    earningsUsd:     { type: Number, required: true },
    earningsBtcy:    { type: Number, required: true },
    usdPerBtcy:      { type: Number, required: true },
    createdAt:       { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Primary query pattern: owner earnings over a time range
StationEarningsHistorySchema.index({ ownerEmail: 1, createdAt: -1 });
// Monthly aggregation buckets
StationEarningsHistorySchema.index({ ownerEmail: 1, createdAt: 1 });
// Per-miner breakdown for a given owner
StationEarningsHistorySchema.index({ ownerEmail: 1, minerEmail: 1, createdAt: -1 });

export default StationEarningsHistorySchema;
