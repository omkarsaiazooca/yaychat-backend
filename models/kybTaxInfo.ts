import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybTaxInfo } from "../data/kybTaxInfo";

export interface KybTaxInfoModel extends IDocumentModel<KybTaxInfo>, KybTaxInfo {}

const kybTaxInfoSchema = new Schema({
  kybApplicationId: { type: Schema.Types.ObjectId, ref: "KybApplication", required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  taxIdentificationNumber: { type: String, required: true },
  taxCountry: { type: String, required: true },
  taxDocumentS3Key: { type: String, default: "" },
  vatNumber: { type: String, default: "" },
  fatcaStatus: { type: String, default: "" },
}, {
  timestamps: true,
});

export default kybTaxInfoSchema;


