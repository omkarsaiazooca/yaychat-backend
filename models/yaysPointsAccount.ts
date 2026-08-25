import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PointsAccount } from "../data/yaysWallet";

export interface PointsAccountModel
  extends IDocumentModel<PointsAccount>,
    PointsAccount {}

const pointsAccountSchema = new Schema(
  {
    userLower: { type: String, required: true, unique: true, index: true },
    balance: { type: Number, default: 0 },
    lifetimeEarned: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastCheckInDate: { type: String, default: null },
    earnedToday: { type: Number, default: 0 },
    earnedTodayDate: { type: String, default: null },
    referralCode: { type: String, required: true },
  },
  { timestamps: true }
);

// Codes are handed out in links and typed by hand, so they have to resolve to
// exactly one account. Unique here is what lets `byCode` be a single lookup.
pointsAccountSchema.index({ referralCode: 1 }, { unique: true });

export default pointsAccountSchema;
