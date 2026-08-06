import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybDocument, KybDocumentType } from "../data/kybDocument";

export interface KybDocumentModel extends IDocumentModel<KybDocument>, KybDocument {}

const kybDocumentSchema = new Schema(
  {
    kybApplicationId: { type: Schema.Types.ObjectId, ref: "KybApplication", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(KybDocumentType), required: true },
    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

kybDocumentSchema.index({ kybApplicationId: 1, type: 1 });

export default kybDocumentSchema;






