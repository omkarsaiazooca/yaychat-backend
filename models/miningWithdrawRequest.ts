import { Schema } from "mongoose";

const WithdrawRequestSchema = new Schema({
  orderId: { type: String },
  email: { type: String },
  requestedAmount: { type: Number },
  approvedAmount: { type: Number },
  requestedAmountUsd: { type: Number },
  approvedAmountUsd: { type: Number },
  payoutAmount: { type: Number },
  payoutCurrency: { type: String, enum: ["USDT", "USDC", "BTCY"] },
  feeAmountUsd: { type: Number },
  feePercentage: { type: Number },
  source: { type: String, enum: ["mining_balance", "ad_revenue"], default: "mining_balance" },
  requestedAmountBtcy: { type: Number },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  withdrawalMethod: { type: String, enum: ["Immediate", "Vested", "USDT", "USDC", "BTCY"] },
  walletAddress: { type: String, default: "" },
  network: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  txHash: { type: String },
});

export default WithdrawRequestSchema;
