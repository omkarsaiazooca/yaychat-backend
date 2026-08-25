import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { NotificationPreference } from "../data/yaysNotifications";

export interface NotificationPreferenceModel
  extends IDocumentModel<NotificationPreference>,
    NotificationPreference {}

const quietHoursSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    startMinute: { type: Number, default: 22 * 60 },
    endMinute: { type: Number, default: 7 * 60 },
    utcOffsetMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const notificationPreferenceSchema = new Schema(
  {
    userLower: { type: String, required: true, unique: true },
    // Categories default on: a messaging app that silently drops message
    // notifications reads as broken. The OS permission prompt is the real gate.
    messages: { type: Boolean, default: true },
    communities: { type: Boolean, default: true },
    rewards: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
    sounds: { type: Boolean, default: true },
    previewText: { type: Boolean, default: true },
    quietHours: { type: quietHoursSchema, default: () => ({}) },
    mutedConversationIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default notificationPreferenceSchema;
