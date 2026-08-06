import { Schema } from "mongoose";
import { AdminNotificationJob } from "../data/adminNotificationJob";
import { IDocumentModel } from "../data/base";

export interface AdminNotificationJobModel extends IDocumentModel<AdminNotificationJob>, AdminNotificationJob { }

const adminNotificationJobSchema: Schema = new Schema({
  jobId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  imageUrl: { type: String },
  emails: [String],
  sendToAll: { type: Boolean, required: true },
  type: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  totalRecipients: { type: Number, default: 0 },
  processedCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
  errorMessages: [String],
  adminEmail: { type: String, required: true },
});

export { adminNotificationJobSchema };
