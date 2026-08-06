import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BTCYBuyHistory } from "../data/btcyBuyHistory";

export interface BTCYBuyHistoryModel
  extends IDocumentModel<BTCYBuyHistory>,
    BTCYBuyHistory {}

export const BTCYBuyHistorySchema: Schema = new Schema();

BTCYBuyHistorySchema.add({
  email: { type: String, index: true, required: true },
  orderId: { type: String, index: true, unique: true, required: true },
  orderMongoId: { type: String },
  amount: { type: Number, required: true },
  priceAtBuy: { type: Number, required: true },
  boughtAt: { type: Date, required: true },
  coinSymbol: { type: String, default: "BTCY" },
  createdDate: { type: Date, default: Date.now },
});

export default BTCYBuyHistorySchema;
