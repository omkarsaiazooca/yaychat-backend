import { Schema } from "mongoose";
import { BTCYSocialPostAirdropRegistration } from "../data/btcySocialPostAirdrop";
import { IDocumentModel } from "../data/base";

export interface BTCYSocialPostAirdropRegistrationModel
  extends IDocumentModel<BTCYSocialPostAirdropRegistration>,
  BTCYSocialPostAirdropRegistration { }

const BTCYSocialPostAirdropSchema: Schema = new Schema(
  {
    name: { type: String, },
    email: { type: String, },
    emailLower: { type: String, },
    postLink: { type: String, },
    postLinkNormalized: { type: String, },
    walletAddress: { type: String, },
    walletAddressLower: { type: String, },
    userId: { type: Schema.Types.ObjectId, },
    tokenName: { type: String, default: "BTCY" },
    eventType: { type: String, default: "BTCYSocialPostAirdrop2026" },
    network: { type: String, default: "Ethereum" },
    walletToken: { type: String, default: "USDT" },
    status: { type: String, default: "Registered" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

BTCYSocialPostAirdropSchema.index({ emailLower: 1 });
BTCYSocialPostAirdropSchema.index({ walletAddressLower: 1 });
BTCYSocialPostAirdropSchema.index({ postLinkNormalized: 1 }, { unique: true });
BTCYSocialPostAirdropSchema.index({ createdAt: -1 });

export default BTCYSocialPostAirdropSchema;
