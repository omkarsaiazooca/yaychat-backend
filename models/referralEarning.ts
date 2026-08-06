import { Schema } from "mongoose";
import { referralEarning } from "../data/referralEarning";
import { IDocumentModel } from "../data/base";

export interface ReferralEarningModel
  extends IDocumentModel<referralEarning>,
    referralEarning {}

// Define the schema for the Order subdocument
const orderSchema: Schema = new Schema({
  email: { type: String },
  amount: { type: Number },
  type: { type: String },
  date: { type: Date },
  currency: { type: String },
  commissionValue: { type: Number },
});

// Define the schema for ReferralEarning
const referralEarningSchema: Schema = new Schema({
  referrerEmail: { type: String },
  referrerCode: { type: String },
  totalEarned: { type: Number, default: 0 },
  commissionPercentage: { type: Number, default: 0 },
  commissionCurrency: { type: String, default: "INEX" },
  orders: [{ type: orderSchema, default: [] }],
  createdDate: { type: Date },
  notes: { type: String },
});

export default referralEarningSchema;
