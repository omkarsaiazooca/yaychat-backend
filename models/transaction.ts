import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Transaction } from "../data/transaction";

export interface TransactionModel
  extends IDocumentModel<Transaction>,
    Transaction {}
const transactionSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var transactionSchema: Schema = new Schema({}, transactionSchemaOptions);

transactionSchema.add({
  orderId: String,
  extRef: String,
  txId: { type: String, default: "" },
  from: String,
  to: String,
  amount: Number,
  info: String,
  status: String,
  currencyRef: String,
  walletType: String,
  transactionType: String,
  email: String,
  exchangeName: String,
  userWalletAddress: String,
  txDate: Date,
  benificaryAddress: String,
  depositedType: String,
  paymentReceiptUrl: String,
  notes: { type: String, default: "" },
  amountInvested: { type: Number, default: 0 },
  fees: { type: Number, default: 0 },
  profitTaken: Boolean,
  profitLastTakenDate: Date,
  rate: { type: Number, default: 0 },
});

export default transactionSchema;
