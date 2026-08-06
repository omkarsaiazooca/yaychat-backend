import { Document, Schema } from "mongoose";
import { NuggetTransfer } from "../data/nuggetTransfer";

export interface NuggetTransferDocument extends Document, NuggetTransfer {}

const NuggetTransferSchema = new Schema<NuggetTransferDocument>({
  transactionId: { type: String, required: true, unique: true, index: true },
  senderEmail: { type: String, required: true, index: true },
  recipientEmail: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  asset: { type: String, default: "BTCY_NUGGET", enum: ["BTCY_NUGGET"] },
  source: { type: String, enum: ["mined", "withdrawn"], default: "mined", index: true },
  client: { type: String, enum: ["mobile", "web"], default: "mobile", index: true },
  status: {
    type: String,
    enum: ["completed", "pending", "failed"],
    default: "completed",
    index: true,
  },
  idempotencyKey: { type: String, sparse: true, index: true },
  senderSourceBalanceBefore: { type: Number, default: 0 },
  senderSourceBalanceAfter: { type: Number, default: 0 },
  senderBalanceBefore: { type: Number, required: true },
  senderBalanceAfter: { type: Number, required: true },
  recipientBalanceBefore: { type: Number, required: true },
  recipientBalanceAfter: { type: Number, required: true },
  senderTotalMinedBefore: { type: Number, required: true },
  senderTotalMinedAfter: { type: Number, required: true },
  recipientTotalMinedBefore: { type: Number, required: true },
  recipientTotalMinedAfter: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
  failureReason: { type: String },
});

NuggetTransferSchema.index(
  { senderEmail: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);
NuggetTransferSchema.index({ senderEmail: 1, createdAt: -1 });
NuggetTransferSchema.index({ recipientEmail: 1, createdAt: -1 });

export default NuggetTransferSchema;
