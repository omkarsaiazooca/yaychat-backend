import { Schema } from "mongoose";
import { SmartCryptoSubscription } from "../data/smartCryptoSubscription";
import { IDocumentModel } from "../data/base";

export interface SmartCryptoSubscriptionModel
  extends IDocumentModel<SmartCryptoSubscription>,
    SmartCryptoSubscription {}

const smartCryptoSubscriptionSchema: Schema = new Schema(
  {
    email: { type: String, required: true, index: true },
    planId: { type: String, required: true, index: true },
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    paymentMethod: { type: String, required: true },
    paymentReference: { type: String },
    status: {
      type: String,
      enum: ["pending", "active", "manual_pending", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    paypalPlanId: { type: String },
    paypalProductId: { type: String },
    paypalSubscriptionId: { type: String, index: true },
    paypalApprovalUrl: { type: String },
    nextBillingDate: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

smartCryptoSubscriptionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default smartCryptoSubscriptionSchema;
