import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { NewGiftCard } from "../data/newGiftCard";

export interface NewGiftCardModel
  extends IDocumentModel<NewGiftCard>,
    NewGiftCard {}

const NewGiftCardSchema = new Schema({
  voucher: String,
  amount: Number,
  dateOfGeneration: Date,
  isUsed: Boolean,
  assignedToUser: String,
  redeemedOn: Date,
  redeemedBy: String,
  type: String, //BTC or ETH or XUSD
  subType: String,
  baseCurrency: String,
  cardType: String,
  usdAmount: Number,
  createdBy: String,
  createdOn: Date,
  giftCardImgUrl: String,
  amountPerCurrency: Number,
  currencies: [String],
  paymentMethodUsed: { type: String, default: "Asset Wallet" },
  price: { type: Number, default: 0 },
});

export default NewGiftCardSchema;
