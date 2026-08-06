import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Currency, CurrencyAcceptance } from "../data/common";
import { Country } from "../data/country";

export interface CountryModel extends IDocumentModel<Country>, Country {}

export var countrySchema: Schema = new Schema();

countrySchema.add({
  code: String,
  text: String,
  phoneCode: Number,
  currencyId: Number,
  phoneNumberStyle: String,
  cultureCode: String,
  trustValue: Number,
  alphaSupport: { type: Boolean, default: false },
  note: String,
  cardFee: Number,
  addTx: String,
  currency: { type: String, enum: Object.keys(Currency) },
  paymentGateWaysAccepted: {
    type: Number,
    enum: Object.keys(CurrencyAcceptance),
  },
});

export default countrySchema;
