import { Schema } from "mongoose";
import { SpecialMiningEligibility } from "../data/specialMiningEligibility";
import { IDocumentModel } from "../data/base";

export interface SpecialMiningEligibilityModel
  extends IDocumentModel<SpecialMiningEligibility>,
    SpecialMiningEligibility {}

export const specialMiningEligibilitySchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    specialMiningEligible: { type: Boolean, default: true },
    skipMiningAds: { type: Boolean, default: true },
    sessionHours: { type: Number, default: 168 },
    reason: { type: String, default: "eligible_email_whitelist" },
    addedBy: { type: String, default: null },
    addedAt: { type: Date, default: Date.now },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

export default specialMiningEligibilitySchema;
