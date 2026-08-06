import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DiscountCode } from "../data/discountCode";

export interface DiscountCodeModel
  extends IDocumentModel<DiscountCode>,
    DiscountCode {}

const DiscountCodeSchema = new Schema({
  code: String,
  amount: Number,
  dateOfGeneration: Date,
  isUsed: Boolean,
  assignedToUser: String,
  redeemedOn: Date,
  redeemedBy: String,
  type: String,
  subType: String,
  baseCurrency: String,
  usdAmount: Number,
  discountPercentage: Number,
  isActive: Boolean
});

export default DiscountCodeSchema;
