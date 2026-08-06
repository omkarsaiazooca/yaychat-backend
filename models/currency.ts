import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { CurrencyType } from '../data/common';
import { Currency } from '../data/currency';

export interface CurrencyModel extends IDocumentModel<Currency>, Currency {
}

var currencySchema: Schema = new Schema();
currencySchema.add({
    currencyType: {type: String },
    code: String,
    text: String,
    fXMarkUp: { type: Number, default: 0 },
    bitgoSettings:{ type: String, default: null },
    isActive: Boolean,
    buyPrice: Number,
    sellPrice: Number,
    buyPriceUpdatedOn: Date,
    sellPriceUpdatedOn: Date,
    min: Number,
    max: Number,
    type: String,
    fees: Number,
})

export default currencySchema;