import { Schema, Document, model } from "mongoose";
import { UserMiningBalance } from "../data/userMiningBalance";

export interface UserBalanceDocument extends Document, UserMiningBalance {}

const UserBalanceSchema = new Schema<UserBalanceDocument>({
  email: { type: String },
  transferableBalance: { type: Number, default: 0 },
  adRevenueTransferableBalance: { type: Number, default: 0 },
  migratedBalance: { type: Number, default: 0 },
  unverifiedBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  coinSymbol: { type: String },
  coinName: { type: String },
  coinNetwork: { type: String },
});

export default UserBalanceSchema;
