import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BridgeCoins } from "../data/bridgeCoins";
export interface BridgeCoinsModel
  extends IDocumentModel<BridgeCoins>,
    BridgeCoins {}
export var bridgeSchema: Schema = new Schema();

bridgeSchema.add({
  id: String,
  status: String,
  actionsAvailable: Boolean,
  fromCurrency: String,
  fromNetwork: String,
  toCurrency: String,
  toNetwork: String,
  expectedAmountFrom: Number,
  expectedAmountTo: Number,
  amountFrom: Number,
  amountTo: Number,
  payinAddress: String,
  payoutAddress: String,
  payinExtraId: String,
  payoutExtraId: String,
  refundAddress: String,
  refundExtraId: String,
  createdAt: String,
  updatedAt: String,
  validUntil: String,
  depositReceivedAt: String,
  payinHash: String,
  payoutHash: String,
  fromLegacyTicker: String,
  toLegacyTicker: String,
  refundHash: String,
  refundAmount: String,
  email: String,
  txId: String
});

export default bridgeSchema;
