import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { ErrorLog } from "../data/errorLog";

export interface ErrorLogModel extends IDocumentModel<ErrorLog>, ErrorLog {}

const errorLogSchema: Schema = new Schema(
  {
    email: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, required: true },
    apiCalled: { type: String, required: true },
    detailedLog: { type: String, required: true },
    statusCode: { type: Number },
    errorCode: { type: String },
    method: { type: String },
    url: { type: String },
    requestBody: { type: Schema.Types.Mixed },
    requestQuery: { type: Schema.Types.Mixed },
    requestParams: { type: Schema.Types.Mixed },
    stackTrace: { type: String },
  },
  {
    timestamps: { createdAt: "timestamp", updatedAt: false },
  }
);

// Index for faster queries
errorLogSchema.index({ email: 1, timestamp: -1 });
errorLogSchema.index({ apiCalled: 1, timestamp: -1 });
errorLogSchema.index({ timestamp: -1 });

export default errorLogSchema;

