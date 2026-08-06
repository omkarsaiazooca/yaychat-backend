import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PaymentTypes } from "../data/common";
import { Order, OrderStatus } from "../data/order";
import { basicSchema, cryptoAccount } from "./common";

export interface OrderModel extends IDocumentModel<Order>, Order {}

var OrderBreakdownSchema: Schema = new Schema({
  inCurrenyName: String,
  inAmount: Number,
  feePercent: Number,
  feeAmount: Number,
  netAmount: Number,
  totalPayable: Number,
  outCurrencyName: String,
  outAmount: Number,
  finalAmountAfterDiscount: Number,
});

var RatesSchema: Schema = new Schema({
  rate: Number,
  currency: String,
});

const orderSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

const txnSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: false },
};

var OrderTransactionSchema: Schema = new Schema(
  {
    currency: String,
    amount: Number,
    trnReference: String,
    trnHash: String,
    walletAddress: String,
    status: String,
    created: Date,
    orderRate: RatesSchema,
  },
  txnSchemaOptions
);

var orderSchema: Schema = new Schema({}, orderSchemaOptions);

orderSchema.add({
  orderId: String,
  status: { type: String, enum: Object.keys(OrderStatus) },
  merchantStatus: String,
  merchantReferenceId: String,
  merchantName: String,
  usdValue: { type: Number, default: 0 },
  orderRate: { type: RatesSchema },
  paymentType: { type: String, default: PaymentTypes.DirectCrypto },
  breakdown: { type: OrderBreakdownSchema },
  user: { type: basicSchema },
  transactions: [{ type: OrderTransactionSchema, default: [] }],
  comments: String,
  receiverAccount: { type: cryptoAccount },
  isLocked: Boolean,
  LockedUntil: Date,
  LockedBy: String,
  exchangeFees: Number,
  orderType: String,
  orderCompletedOn: Date,
  exchangeName: { type: String, default: "Centralized" },
  blockchainName: String,
  isCaptainPerformingOrder: Boolean,
  captainBeeEmail: String,
  discountCode: String,
  discountPercentage: Number,
  powerPackFees: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  smartAPYPercentage:  { type: Number, default: 0 },
  smartAPYduration: { type: String, default: "" },
  giftCardDetails: [],
  appleTransactionId: String,
  productId: String,
  expirationDate: Date,
  appleReceipt: String,
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  lastUpdated: Date,
  subscriptionCancelledAt: Date,
  googlePurchaseToken: String,
  googlePackageName: String,
  referralCode: String, // Referral code used during checkout
  wireTransferConfirmation: {
    customerName: String,
    bankName: String,
    bankAccountNumber: String,
    address: String,
    phoneNumber: String,
    confirmedAt: Date,
    updatedAt: Date,
  },
});

export default orderSchema;
