import { Schema } from "mongoose";
import { ChatUserBlock } from "../data/chatUserBlock";
import { IDocumentModel } from "../data/base";

export interface ChatUserBlockModel
  extends IDocumentModel<ChatUserBlock>,
    ChatUserBlock {}

const chatUserBlockSchema = new Schema(
  {
    blockerEmail: { type: String, required: true },
    blockerLower: { type: String, required: true, index: true },
    blockedEmail: { type: String, required: true },
    blockedLower: { type: String, required: true, index: true },
    groupId: { type: String, default: null, index: true },
    reason: { type: String, default: null },
    preventSending: { type: Boolean, default: false, index: true },
    blockedByAdmin: { type: Boolean, default: false, index: true },
    blockScope: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

chatUserBlockSchema.index(
  { blockerLower: 1, blockedLower: 1, groupId: 1 },
  { unique: true }
);
chatUserBlockSchema.index({ blockedLower: 1, groupId: 1 });
chatUserBlockSchema.index({ blockerLower: 1, groupId: 1 });
chatUserBlockSchema.index({ blockedLower: 1, groupId: 1, preventSending: 1, blockedByAdmin: 1 });

export default chatUserBlockSchema;
