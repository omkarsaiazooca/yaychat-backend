import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PaymentTxLock } from "../data/paymentTxLock";

export interface PaymentTxLockModel
  extends IDocumentModel<PaymentTxLock>,
    PaymentTxLock {}

const paymentTxLockSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

const PaymentTxLockSchema: Schema = new Schema({}, paymentTxLockSchemaOptions);

PaymentTxLockSchema.add({
  txHash: { type: String, required: true, index: true },
  orderId: { type: String, required: true, index: true },
  email: { type: String, default: "" },
  status: { type: String, default: "reserved" },
  blockchain: { type: String, default: "" },
  paymentType: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  receiverAddress: { type: String, default: "" },
  verifiedAt: { type: Date },
});

PaymentTxLockSchema.index({ txHash: 1 }, { unique: true });

export default PaymentTxLockSchema;
