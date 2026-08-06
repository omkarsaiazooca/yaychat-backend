import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { SmartCrypto } from "../data/smartCrypto";

export interface SmartCryptoModel
  extends IDocumentModel<SmartCrypto>,
    SmartCrypto {}

// Define Cryptocurrency Schema
const CryptocurrencySchema: Schema = new Schema({
  token: { type: String }, // Token symbol (e.g., BTC, ETH)
  name: { type: String }, // Full name of the cryptocurrency (e.g., Bitcoin)
  percentage: { type: Number }, // Percentage of portfolio allocation
  valueInUSD: { type: Number }, // Value in USD
});

// Define the SmartCrypto schema
export const SmartCryptoSchema: Schema = new Schema(
  {
    portfolioName: { type: String }, // Portfolio name
    totalInvestment: { type: Number }, // Total investment amount in USD
    description: { type: String }, // Description of the token
    title: { type: String }, // Section title
    subTitle: { type: String }, // Section sub-title
    cryptocurrencies: { type: [CryptocurrencySchema] }, // List of cryptocurrencies in the portfolio
    createdDate: { type: Date, default: Date.now }, // Creation date of the portfolio
    managedBy: { type: String }, // Entity managing the portfolio
    updatedBy: { type: String }, // Entity or user who last updated the portfolio
    isActive: { type: Boolean, default: true }, // Portfolio status
  },
  { timestamps: true } // Auto-generate createdAt and updatedAt fields
);

export default SmartCryptoSchema;
