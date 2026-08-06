import { Schema } from "mongoose";
import { Airdrop } from "../data/airdrop";
import { IDocumentModel } from "../data/base";
export interface AirdropModel extends IDocumentModel<Airdrop>, Airdrop {}

export var AirdropSchema: Schema = new Schema();

AirdropSchema.add({
  userType: String,
  createdDate: Date,
  email: String,
  walletAddress: String,
  walletProvider: String,
  transactionHash: String,
  airdropAmount: Number,
  tokenName: String,
  status: String, //'pending' | 'completed' | 'failed';
  network: String,
  airdropDate: Date,
  notes: String,
  eventType: String,
  coinPrice: String,
  referralCode: String, // this is code of the user who referred this user
});

export default AirdropSchema;
