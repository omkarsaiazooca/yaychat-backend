import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { ShoperPalBtcyCredit } from "../data/shoperpalBtcyCredit";

export interface ShoperPalBtcyCreditModel
  extends IDocumentModel<ShoperPalBtcyCredit>,
    ShoperPalBtcyCredit {}

const shoperpalBtcyCreditSchemaOptions = {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
};

const shoperpalBtcyCreditSchema: Schema = new Schema(
  {
    email: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    assetSymbol: { type: String, default: "BTCY", index: true },
    assetName: { type: String, default: "Bitcoin-Yay Nuggets" },
    network: { type: String, default: "Ying Yang Chain", index: true },
    walletType: { type: String, default: "ASSET_WALLET" },
    source: { type: String, required: true, index: true },
    sourceOrderId: { type: String, index: true },
    sourceRewardId: { type: String, required: true, index: true },
    rewardType: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    walletTransactionId: { type: String },
    status: { type: String, default: "CREDITED", index: true },
    balanceAfter: { type: Number },
    metadata: { type: Schema.Types.Mixed, default: {} },
    error: { type: String },
  },
  shoperpalBtcyCreditSchemaOptions
);

export default shoperpalBtcyCreditSchema;
