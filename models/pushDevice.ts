import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PushDevice } from "../data/yaysNotifications";

export interface PushDeviceModel extends IDocumentModel<PushDevice>, PushDevice {}

const pushDeviceSchema = new Schema(
  {
    userLower: { type: String, required: true, index: true },
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ["ios", "android", "web"], required: true },
    token: { type: String, required: true },
    appVersion: { type: String, default: null },
    osVersion: { type: String, default: null },
    model: { type: String, default: null },
    disabledAt: { type: Date, default: null },
    disabledReason: { type: String, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One row per install. Re-registering refreshes the token in place, which is
// what keeps a reinstall from accumulating dead rows.
pushDeviceSchema.index({ userLower: 1, deviceId: 1 }, { unique: true });
// A token can migrate between accounts (shared device); the delivery service
// clears the stale owner so a push never reaches the previous signed-in user.
pushDeviceSchema.index({ token: 1 });

export default pushDeviceSchema;
