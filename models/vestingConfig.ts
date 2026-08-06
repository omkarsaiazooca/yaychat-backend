import { Schema, Document, model } from "mongoose";
import { VestingConfig } from "../data/vestingConfig";

export interface VestingConfigModel extends Document, VestingConfig {}

const VestingConfigSchema = new Schema<VestingConfigModel>({
  option: { type: String },
  vestingDuration: { type: Number },
  monthlyWithdrawalPercentages: { type: [Number] },
  description: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  coinSymbol: { type: String },
});

export default VestingConfigSchema;
