import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { LinkedAccount } from "../data/linkedAccount";

export interface LinkedAccountModel extends IDocumentModel<LinkedAccount>, LinkedAccount {}

const LinkedAccountSchema = new Schema<LinkedAccount>(
  {
    mainEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
    secondaryEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "active", "removed"], required: true, default: "pending" },
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
    linkedAt: { type: Date },
    removedAt: { type: Date },
    totalBonusEarned: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

LinkedAccountSchema.index({ mainEmail: 1, secondaryEmail: 1 }, { unique: true, partialFilterExpression: { status: { $ne: "removed" } } });
LinkedAccountSchema.index({ secondaryEmail: 1, status: 1 });

export default LinkedAccountSchema;
