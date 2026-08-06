import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { MiningCreditEvent } from "../data/miningCreditEvent";

export interface MiningCreditEventModel
  extends IDocumentModel<MiningCreditEvent>,
    MiningCreditEvent {}

const miningCreditEventSchema = new Schema(
  {
    email: { type: String, index: true },
    coinSymbol: { type: String, required: true, index: true },
    amount: { type: Number, required: true, default: 0 },
    creditedAt: { type: Date, required: true, index: true },
    source: { type: String, required: true },
    miningPlan: { type: String },
    miningRate: { type: Number },
    sessionHours: { type: Number },
    sessionStartedAt: { type: Date },
    dedupeKey: { type: String },
  },
  { versionKey: false, timestamps: true }
);

miningCreditEventSchema.index({ coinSymbol: 1, creditedAt: -1 });
miningCreditEventSchema.index({ email: 1, coinSymbol: 1, creditedAt: -1 });
miningCreditEventSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export default miningCreditEventSchema;
