import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { YaysNotification } from "../data/yaysNotifications";

export interface YaysNotificationModel
  extends IDocumentModel<YaysNotification>,
    YaysNotification {}

const deliveryAttemptSchema = new Schema(
  {
    deviceId: String,
    platform: String,
    ok: Boolean,
    error: { type: String, default: null },
    tokenGone: { type: Boolean, default: false },
  },
  { _id: false }
);

const yaysNotificationSchema = new Schema(
  {
    userLower: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    dedupeKey: { type: String, default: null },
    deepLinkRoute: { type: String, default: null },
    deepLinkParams: { type: Object, default: null },
    deepLinkUrl: { type: String, default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    outcome: { type: String, default: "delivered" },
    attempts: { type: [deliveryAttemptSchema], default: [] },
    broadcastId: { type: String, default: null },
  },
  { timestamps: true }
);

// The inbox is always read newest-first for one user.
yaysNotificationSchema.index({ userLower: 1, createdAt: -1 });
// Idempotency: a retried send with the same dedupeKey cannot create a second
// row. Partial so the (common) undeduped notifications are unconstrained.
yaysNotificationSchema.index(
  { userLower: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  }
);

export default yaysNotificationSchema;
