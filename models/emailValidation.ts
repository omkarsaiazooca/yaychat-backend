import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { EmailValidation } from "../data/emailValidation";

export interface EmailValidationModel
  extends IDocumentModel<EmailValidation>,
    EmailValidation {}

export const EmailValidationSchema: Schema = new Schema();

EmailValidationSchema.add({
  email: { type: String, index: true, required: true },
  provider: { type: String, default: "ZeroBounce", index: true },
  status: { type: String },
  subStatus: { type: String },
  didYouMean: { type: String },
  account: { type: String },
  domain: { type: String },
  checkedAt: { type: Date, default: Date.now },
  accountIndex: { type: Number },
  raw: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

EmailValidationSchema.index({ email: 1, provider: 1 }, { unique: true });

export default EmailValidationSchema;
