import { Schema } from "mongoose";
import { ChatUserReport } from "../data/chatUserReport";
import { IDocumentModel } from "../data/base";

export interface ChatUserReportModel
  extends IDocumentModel<ChatUserReport>,
    ChatUserReport {}

const chatUserReportSchema = new Schema(
  {
    reporterEmail: { type: String, required: true },
    reporterLower: { type: String, required: true, index: true },
    reportedEmail: { type: String, required: true },
    reportedLower: { type: String, required: true, index: true },
    reason: { type: String, default: null },
    messageId: { type: String, default: null },
    groupId: { type: String, default: null },
  },
  { timestamps: true }
);

chatUserReportSchema.index({ reportedLower: 1, reporterLower: 1, createdAt: -1 });

export default chatUserReportSchema;
