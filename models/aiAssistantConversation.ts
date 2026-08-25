import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiConversation } from "../data/aiAssistant";

export interface AiConversationModel
  extends IDocumentModel<AiConversation>,
    AiConversation {}

const aiMessageSchema = new Schema(
  {
    messageId: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    degraded: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const aiConversationSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    userLower: { type: String, required: true, index: true },
    tool: { type: String, required: true, default: "ask" },
    title: { type: String, required: true, default: "New session" },
    saved: { type: Boolean, default: false },
    messages: { type: [aiMessageSchema], default: [] },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

aiConversationSchema.index({ userLower: 1, deletedAt: 1, updatedAt: -1 });

export default aiConversationSchema;
