import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybAuditAction, KybAuditActorType, KybAuditLog } from "../data/kybAuditLog";

export interface KybAuditLogModel extends IDocumentModel<KybAuditLog>, KybAuditLog {}

const kybAuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorType: {
      type: String,
      enum: Object.values(KybAuditActorType),
      required: true,
      default: KybAuditActorType.SYSTEM,
    },
    kybApplicationId: { type: Schema.Types.ObjectId, ref: "KybApplication", index: true, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, enum: Object.values(KybAuditAction), required: true },
    note: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

kybAuditLogSchema.index({ kybApplicationId: 1, createdAt: -1 });

export default kybAuditLogSchema;






