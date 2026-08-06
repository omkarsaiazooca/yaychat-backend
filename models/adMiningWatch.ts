// models/adWatch.schema.ts
import mongoose, { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AdMiningWatch } from "../data/adMiningWatch";

export interface AdMiningWatchModel extends IDocumentModel<AdMiningWatch>, AdMiningWatch { }
const adMiningWatchSchema = new Schema({
    email: { type: String, required: true, index: true },
    timestamp: { type: Date, default: () => new Date(), index: true },
    adType: { type: String, default: "rewarded" },
    placement: { type: String, default: "mining_block" },
    sessionId: { type: String, default: null },
    txId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
});

adMiningWatchSchema.index({ email: 1, timestamp: 1 });
adMiningWatchSchema.index({ timestamp: -1 });
adMiningWatchSchema.index({ email: 1, timestamp: -1 });
adMiningWatchSchema.index({ email: 1, txId: 1 }, { unique: true, sparse: true });

export default adMiningWatchSchema;