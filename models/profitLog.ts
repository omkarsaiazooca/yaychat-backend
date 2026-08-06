import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { ProfitLog } from "../data/profitLog";

// Define the interface for ProfitLogModel, extending the base document model
export interface ProfitLogModel extends IDocumentModel<ProfitLog>, ProfitLog {}

// Define the ProfitLog schema
export var ProfitLogSchema: Schema = new Schema();

// Add fields to the ProfitLog schema
ProfitLogSchema.add({
  userEmail: String,                // Email of the user whose profit was taken
  profitAccountEmail: String,       // Email of the profit account where profit is credited
  currencyRef: String,              // The currency (e.g., BTC) in which the profit is taken
  profitInCrypto: Number,           // Profit taken in cryptocurrency
  profitInUsd: Number,              // Profit equivalent in USD
  txDate: Date,                     // The original transaction date
  originalInvestment: Number,       // The original investment in USD
  currentValue: Number,             // The current value of the investment
  logDate: Date,                    // Date the log entry was created
  note: String,                     // Additional notes (e.g., "Tip for making profit to profit account")
  totalProfit: Number
});

// Export the schema as the default export
export default ProfitLogSchema;
