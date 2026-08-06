import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { GiftCard } from "../data/giftCard";

export interface GiftCardModel extends IDocumentModel<GiftCard>, GiftCard {}

const GiftCardSchema = new Schema({
  voucher: String,
  pin: Number,
  amount: Number,
  dateOfGeneration: Date,
  isUsed: Boolean,
  assignedToUser: String,
  redeemedOn: Date,
  redeemedBy: String,
  type: String, //BTC or ETH or XUSD
  subType: String,
  baseCurrency: String
});

export default GiftCardSchema;
