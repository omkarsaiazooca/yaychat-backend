import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { LinkedAccountBonusLog } from "../data/linkedAccountBonusLog";

export interface LinkedAccountBonusLogModel
  extends IDocumentModel<LinkedAccountBonusLog>,
    LinkedAccountBonusLog {}

const LinkedAccountBonusLogSchema = new Schema<LinkedAccountBonusLog>(
  {
    mainEmail: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    secondaryEmail: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    coinSymbol: { type: String, required: true, trim: true, uppercase: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, default: "mining" },
    metadata: { type: Schema.Types.Mixed },
    earnedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

LinkedAccountBonusLogSchema.index(
  { mainEmail: 1, secondaryEmail: 1, earnedAt: -1 },
  { name: "bonus_log_lookup" }
);

export default LinkedAccountBonusLogSchema;
