import { Schema } from "mongoose";
import { Notification, NotificationTemplate } from "../data/notifications";
import { IDocumentModel } from "../data/base";

export interface NotificationModel extends IDocumentModel<Notification>, Notification { }
export interface NotificationTemplateModel extends IDocumentModel<NotificationTemplateModel>, NotificationTemplate { }

const notificationSchema: Schema = new Schema({
    userId: String,
    notificationId: String,
    email: String,
    type: String,
    title: String,
    body: String,
    dedupeKey: { type: String, default: null },
    read: { type: Boolean, default: false },
    pushed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    pushedLottoAirdropDate: { type: Date, default: Date.now },
    pushedLottoAirdrop: { type: Boolean, default: false },
});

// Unique dedupe per (email,type,dedupeKey) when dedupeKey is set
notificationSchema.index(
    { email: 1, type: 1, dedupeKey: 1 },
    { unique: true, partialFilterExpression: { dedupeKey: { $exists: true, $ne: null } } }
);

const notificationTemplateSchema: Schema = new Schema({
    type: String,
    title: String,
    body: String,
    imageUrl: String,
    createdAt: Date,
});

export { notificationSchema, notificationTemplateSchema };
