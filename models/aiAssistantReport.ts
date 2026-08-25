import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiReport } from "../data/aiAssistant";

export interface AiReportModel extends IDocumentModel<AiReport>, AiReport {}

const aiReportSchema = new Schema(
  {
    userLower: { type: String, required: true, index: true },
    conversationId: { type: String, default: null },
    messageId: { type: String, default: null },
    reason: { type: String, required: true },
    excerpt: { type: String, default: "" },
    status: {
      type: String,
      enum: ["open", "reviewing", "actioned", "dismissed"],
      default: "open",
    },
  },
  { timestamps: true }
);

aiReportSchema.index({ status: 1, createdAt: -1 });

export default aiReportSchema;
