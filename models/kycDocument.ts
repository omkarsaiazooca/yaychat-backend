import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KycDocument, KycDocumentType } from "../data/kycDocument";

export interface KycDocumentModel extends IDocumentModel<KycDocument>, KycDocument {}

const kycDocumentSchema = new Schema({
  kycApplicationId: { type: Schema.Types.ObjectId, ref: "KycApplication", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: Object.values(KycDocumentType),
    required: true,
  },
  s3Key: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
});

// Indexes
kycDocumentSchema.index({ kycApplicationId: 1 });
kycDocumentSchema.index({ userId: 1 });

export default kycDocumentSchema;

