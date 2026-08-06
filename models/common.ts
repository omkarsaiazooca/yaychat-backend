import { Schema } from "mongoose";
import { ContactTypes, Languages, PaymentTypes } from "../data/common";
import { UserRoleTypes } from "../data/user";

export var addressSchema: Schema = new Schema({
  language: { type: String, default: Languages.US },
  country: String,
  state: String,
  city: String,
  place: String,
  addressLine1: String,
  addressLine2: String,
  pincode: String,
});

export var contactSchema: Schema = new Schema({
  contactType: { type: Number, default: ContactTypes.Default },
  firstName: String,
  lastName: String,
  phone: String,
  email: String,
});

export var basicSchema: Schema = new Schema({
  userId: String,
  firstName: String,
  lastName: String,
  profilePhoto: String,
  language: String,
  email: String,
  //role: {type: Number, default: UserRoleTypes.Standard},
  isVerified: Boolean,
});

export var cryptoAccount: Schema = new Schema({
  accountId: String,
  accountType: { type: String, default: PaymentTypes.DirectCrypto },
  accountWalletAddress: String,
  accountPrivateKey: String,
  accountName: String,
  accountSymbol: String,
  exchangeReceiveAddress: String,
  userReceiveAddress: String,
  amount: Number,
  currency: String,
  accountBankName: String,
  accountHolderName: String,
  accountNumber: String,
  accountIBAN: String,
  accountBankAddress: String,
  email: String,
});
