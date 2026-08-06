import mongoose, { Document, Schema } from "mongoose";
import { AdminAuditLog } from "../data/adminAuditLog";
import { IDocumentModel } from "../data/base";
export interface AdminAuditLogModel
  extends IDocumentModel<AdminAuditLog>,
    AdminAuditLog {}

const adminAuditLogSchema: Schema = new Schema({
  adminEmail: { type: String, required: true },
  action: { type: String, required: true },
  method: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

export default adminAuditLogSchema;
