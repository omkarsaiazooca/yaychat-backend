import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KycAuditLog, KycAuditActorType, KycAuditAction } from "../data/kycAuditLog";

export interface KycAuditLogModel extends IDocumentModel<KycAuditLog>, KycAuditLog {}

const kycAuditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorType: {
    type: String,
    enum: Object.values(KycAuditActorType),
    required: true,
  },
  action: {
    type: String,
    enum: Object.values(KycAuditAction),
    required: true,
  },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kycApplicationId: { type: Schema.Types.ObjectId, ref: "KycApplication", default: null, index: true },
  note: { type: String, default: "" },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: false },
});

// Indexes
kycAuditLogSchema.index({ kycApplicationId: 1, createdAt: -1 });
kycAuditLogSchema.index({ userId: 1, createdAt: -1 });

export default kycAuditLogSchema;

