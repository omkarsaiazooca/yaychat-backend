import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BtcyChatGroupBonus } from "../data/btcyChatGroupBonus";

export interface BtcyChatGroupBonusModel
  extends IDocumentModel<BtcyChatGroupBonus>,
    BtcyChatGroupBonus {}

const BtcyChatGroupBonusSchema = new Schema(
  {
    ownerEmail: { type: String, required: true, index: true },
    groupId: { type: String, required: true, index: true },
    groupName: { type: String, default: "" },
    rewardType: { type: String, required: true, index: true },
    plan: { type: String, required: true },
    durationDays: { type: Number, required: true },
    source: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "failed", "cancelled"],
      default: "active",
      index: true,
    },
    effectiveFrom: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    grantedAt: { type: Date, default: Date.now, index: true },
    groupCreatedAt: { type: Date },
    memberCountAtGrant: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

BtcyChatGroupBonusSchema.index(
  { groupId: 1, rewardType: 1 },
  { unique: true }
);
BtcyChatGroupBonusSchema.index({ ownerEmail: 1, rewardType: 1, grantedAt: -1 });
BtcyChatGroupBonusSchema.index({ ownerEmail: 1, rewardType: 1, status: 1, expiresAt: 1 });

export default BtcyChatGroupBonusSchema;
