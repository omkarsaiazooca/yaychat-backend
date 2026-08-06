import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BitcoinyayAdAuditLog } from "../data/bitcoinyayAdAuditLog";

export interface BitcoinyayAdAuditLogModel
  extends IDocumentModel<BitcoinyayAdAuditLog>,
    BitcoinyayAdAuditLog {}

const bitcoinyayAdAuditLogSchema: Schema = new Schema({
  adUnitId: { type: String, required: true, index: true },
  adFormat: { type: String, required: true },
  errorCode: { type: String, required: true, index: true },
  errorMessage: { type: String, required: true },
  locale: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
  requestId: { type: String },
  vpnDetected: { type: Boolean },
  networkStatus: { type: String },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  userCountry: { type: String },
  deviceInfo: { type: String },
  appVersion: { type: String },
  networkCarrier: { type: String },
  userAgent: { type: String },
  userIp: { type: String },
  extraInfo: { type: Schema.Types.Mixed },
  source: { type: String, default: "bitcoinyay-app" },
  createdAt: { type: Date, default: Date.now },
});

export default bitcoinyayAdAuditLogSchema;
