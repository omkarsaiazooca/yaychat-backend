import mongoose, { Schema, Document } from "mongoose";
import { SubscriptionPlan } from "../data/miningSubcriptionPlans";
import { IDocumentModel } from "../data/base";
const miningSubscriptionPlanSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

export interface SubscriptionPlanModel
  extends IDocumentModel<SubscriptionPlan>,
  SubscriptionPlan { }

export var SubscriptionPlanSchema: Schema = new Schema(
  {},
  miningSubscriptionPlanSchemaOptions
);
SubscriptionPlanSchema.add({
  name: { type: String },
  speedBoost: { type: Number },
  cost: { type: Number },
  miningRate: { type: Number },
  coinSymbol: { type: String },
  productId: { type: String },
  displayName: { type: String },
  displaySpeed: { type: String },
  benefits: { type: String },
  tier: { type: String },
});

export default SubscriptionPlanSchema;
