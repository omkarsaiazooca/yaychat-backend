import { Schema } from "mongoose";
import { BTCYTronAirdropUser } from "../data/btcyTronAirdrop";
import { IDocumentModel } from "../data/base";

export interface BTCYTronAirdropModel extends IDocumentModel<BTCYTronAirdropUser>, BTCYTronAirdropUser { }

export const BTCYTronAirdropSchema: Schema = new Schema();

BTCYTronAirdropSchema.add({
  email: String,
  walletAddress: String,
  walletProvider: String,
  network: String,
  status: String,
  airdropAmount: Number,
  txHash: String,
  createdDate: Date,
  airdropDate: Date,
  tokenName: String,
  eventType: String,
  referralCode: String,
  totalMined: Number,
  miningPlan: String,
  miningRate: Number,
  isMiningActive: Boolean,
  lastClaimTime: Date,
  source: String,
  isWinner: Boolean,
  isWinnerPopupSeen: Boolean,
  tronRegistered: Boolean,
  turboClaimed: Boolean,
  turboClaimedAt: Date,
  turboExpiresAt: Date,
});

BTCYTronAirdropSchema.index({ email: 1 }, { unique: true });

export default BTCYTronAirdropSchema;
