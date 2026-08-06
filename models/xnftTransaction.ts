import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import {
  Currency,
  CurrencyType,
  PaymentTypes,
  TransactionType,
  WalletType,
} from "../data/common";
import { Order, OrderStatus } from "../data/order";
import { XNFTTransaction } from "../data/xnftTransaction";
import { basicSchema, cryptoAccount } from "./common";

export interface XNFTTransactionModel
  extends IDocumentModel<XNFTTransaction>,
    XNFTTransaction {}
const transactionSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var xnftTransactionSchema: Schema = new Schema({}, transactionSchemaOptions);

xnftTransactionSchema.add({
  txId: String,
  from: String,
  to: String,
  amount: Number,
  info: String,
  status: String,
  currencyRef: String,
  walletType: String,
  transactionType: String,
  exchangeName: String,
  email: String,
  userWalletAddress: String,
  txDate: Date,
  blockchain: String,
  contractAddress: String,
  tokenId: String,
  type: String,
  isINEXConvert: Boolean
});

export default xnftTransactionSchema;
