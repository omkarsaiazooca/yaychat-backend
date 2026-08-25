import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiSupportTicket } from "../data/aiAssistant";

export interface AiSupportTicketModel
  extends IDocumentModel<AiSupportTicket>,
    AiSupportTicket {}

const supportTicketMessageSchema = new Schema(
  {
    messageId: { type: String, required: true },
    author: { type: String, enum: ["user", "ai", "agent"], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const aiSupportTicketSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    userLower: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    product: { type: String, default: "YaysApp" },
    status: {
      type: String,
      enum: ["ai_handling", "awaiting_user", "escalated", "resolved"],
      default: "ai_handling",
    },
    messages: { type: [supportTicketMessageSchema], default: [] },
    escalatedAt: { type: Date, default: null },
    escalationReason: { type: String, default: null },
  },
  { timestamps: true }
);

// The human queue reads escalated tickets oldest-first.
aiSupportTicketSchema.index({ status: 1, escalatedAt: 1 });

export default aiSupportTicketSchema;
