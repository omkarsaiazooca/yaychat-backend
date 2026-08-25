import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiConsent } from "../data/aiAssistant";

export interface AiConsentModel
  extends IDocumentModel<AiConsent>,
    AiConsent {}

const aiConsentSchema = new Schema(
  {
    userLower: { type: String, required: true, unique: true },
    // Both content-sharing switches default to false: private chat and
    // community content never reaches a model without an explicit opt-in.
    shareChatContent: { type: Boolean, default: false },
    shareCommunityContent: { type: Boolean, default: false },
    saveHistory: { type: Boolean, default: true },
    personalization: { type: Boolean, default: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default aiConsentSchema;
