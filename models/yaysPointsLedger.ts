import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PointsLedgerEntry } from "../data/yaysWallet";

export interface PointsLedgerEntryModel
  extends IDocumentModel<PointsLedgerEntry>,
    PointsLedgerEntry {}

const pointsLedgerSchema = new Schema(
  {
    userLower: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    activity: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "reversed"],
      default: "completed",
    },
    idempotencyKey: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    reversedByEntryId: { type: String, default: null },
  },
  { timestamps: true }
);

// The guarantee the whole ledger rests on: one entry per (user, key), so a
// retried credit — a flaky network on check-in, a replayed webhook — can never
// pay twice. The service leans on the duplicate-key error rather than a
// read-then-write, which would race under concurrent requests.
pointsLedgerSchema.index({ userLower: 1, idempotencyKey: 1 }, { unique: true });
// History screen: newest first for one user.
pointsLedgerSchema.index({ userLower: 1, createdAt: -1 });

export default pointsLedgerSchema;
