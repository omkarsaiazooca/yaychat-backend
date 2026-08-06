import { Schema } from "mongoose";
import { BitcoinyaySubscription } from "../data/bitcoinyaySubscription";
import { IDocumentModel } from "../data/base";

export interface BitcoinyaySubscriptionModel
  extends IDocumentModel<BitcoinyaySubscription>,
    BitcoinyaySubscription {}

const bitcoinyaySubscriptionSchema: Schema = new Schema(
  {
    email: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    planKey: { type: String, required: true, index: true },
    planName: { type: String, required: true },
    provider: { type: String, enum: ["stripe", "paypal"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    miningSpeed: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "failed", "upgrading", "downgrading"],
      default: "pending",
      index: true,
    },
    couponCode: { type: String },
    couponDiscountPercent: { type: Number },
    miningInterval: { type: String, default: "month" },
    metadata: { type: Schema.Types.Mixed },
    stripeCheckoutSessionId: { type: String, index: true },
    stripeSubscriptionId: { type: String, index: true },
    stripeSubscriptionItemId: { type: String },
    stripePriceId: { type: String },
    stripeProductId: { type: String },
    miningSubscriptionOrderId: { type: String, index: true },
    paypalPlanId: { type: String },
    paypalProductId: { type: String },
    paypalSubscriptionId: { type: String, index: true },
    paypalApprovalUrl: { type: String },
    events: { type: [Schema.Types.Mixed], default: [] },
    lastPaymentStatus: { type: String },
    pendingPlanKey: { type: String },
    pendingPlanName: { type: String },
    updatedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

bitcoinyaySubscriptionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default bitcoinyaySubscriptionSchema;
