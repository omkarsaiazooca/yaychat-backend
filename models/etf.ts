import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { ETF } from '../data/etf';

export interface ETFModel extends IDocumentModel<ETF>, ETF {
}

var ETFDataSchema: Schema = new Schema({
    name: String,
    percentage: Number,
    code: String
  });

  
var etfSchema: Schema = new Schema();
etfSchema.add({
    etfType: {type: String },
    etfName: {type: String },
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
    etfWeightAge: { type: ETFDataSchema },
})

export default etfSchema;