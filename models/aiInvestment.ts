import { Schema } from "mongoose";
import { Investment } from "../data/aiInvestment";
import { IDocumentModel } from "../data/base";

export interface InvestmentModel extends IDocumentModel<Investment>, Investment { }

var InvestmentSchema: Schema = new Schema();


InvestmentSchema.add({
  userId: { type: String, },
  email: { type: String, },
  type: { type: String, enum: ["smart-mix", "crypto", "stock"], },
  amount: { type: Number, },
  riskLevel: { type: Number, },
  timeframe: { type: String, },
  asset: { type: String },
  status: { type: String, enum: ["pending", "executed", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  simulatedPrice: { type: Number, },
  usdAmount: { type: Number, },
  priceAtExecution: { type: Number, },
  basket: { type: Array },
  investmentId: { type: String},
  side: { type: String, enum: ["buy", "sell"], default: "buy" },
  feesUsd: { type: Number },
});


export default InvestmentSchema;
