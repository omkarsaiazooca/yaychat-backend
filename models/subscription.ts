import mongoose, { Schema, Document } from "mongoose";
import { Subscription } from "../data/subscription";

export interface SubscriptionModel extends Document, Subscription { }

const RewardGrantSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["electric_minutes", "turbo_minutes", "turbo_days", "nuclear_days"],
      required: true,
    },
    minutes: { type: Number, required: true },
    source: { type: String, default: "" },          // e.g. "streak_day_3"
    grantedAt: { type: Date, default: Date.now },
    consumedAt: { type: Date },                     // set when debited
  },
  { _id: false }
);

const subscriptionSchema: Schema = new Schema({
  email: { type: String },
  plan: { type: String },
  speedBoost: { type: Number },
  miningRate: { type: Number },
  cost: { type: Number },
  paymentMethod: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  coinSymbol: { type: String },
  status: {
    type: String,
    enum: ["Active", "Expired", "Cancelled"],
    default: "Active",
  },
  referralBonusUsed: { type: Number },
  userType: { type: String },
  totalBTCYBalance: { type: Number },
  bonusNote: { type: String, default: "" },
  lastBonusAppliedAt: { type: Date },
  referralNote: { type: String, default: "" },
  referredByEmail: { type: String, default: "" },
  anniversaryPromoSource: { type: String, default: "" },
  anniversaryPromoAppliedAt: { type: Date },
  anniversaryPromoStartAt: { type: Date },
  anniversaryPromoEndAt: { type: Date },
  anniversaryPromoPreviousPlan: { type: String, default: "" },
  anniversaryPromoPreviousSpeedBoost: { type: Number },
  anniversaryPromoPreviousMiningRate: { type: Number },
  anniversaryPromoPreviousCost: { type: Number },
  anniversaryPromoPreviousPaymentMethod: { type: String, default: "" },
  anniversaryPromoPreviousStartDate: { type: Date },
  anniversaryPromoPreviousEndDate: { type: Date },
  anniversaryPromoPreviousIsPendingPurchase: { type: Boolean, default: false },
  anniversaryPromoRestoredAt: { type: Date },
  rewardGrants: { type: [RewardGrantSchema], default: [] },
  pendingRewards: { type: [RewardGrantSchema], default: [] },
});

subscriptionSchema.index({ email: 1, coinSymbol: 1, status: 1 });
subscriptionSchema.index({ endDate: 1 });

export default subscriptionSchema;
