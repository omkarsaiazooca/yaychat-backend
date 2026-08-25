import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Referral } from "../data/yaysWallet";

export interface ReferralModel extends IDocumentModel<Referral>, Referral {}

const referralSchema = new Schema(
  {
    referrerLower: { type: String, required: true, index: true },
    refereeLower: { type: String, required: true },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "qualified", "rewarded", "rejected"],
      default: "pending",
    },
    rewardAmount: { type: Number, default: 0 },
    qualifiedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
    source: { type: String, default: null },
  },
  { timestamps: true }
);

// An account can be referred exactly once. Without this, deleting and
// re-creating an account — or two racing signups — would pay a referrer twice
// for the same person.
referralSchema.index({ refereeLower: 1 }, { unique: true });
referralSchema.index({ referrerLower: 1, createdAt: -1 });

export default referralSchema;
