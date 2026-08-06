import { Schema } from "mongoose";
import { IDocumentModel, IModel } from "../data/base";

export interface SellConfig extends IModel {
  status: "OPEN" | "CLOSED";
  minTokenRequired: number;
  userDailyLimit: number;
  totalDailyLimit: number;
  liquidityBalance: number;
  dailyFeePercent: number;
  unavailableMessage: string;
  updatedAt?: Date;
}

export interface SellConfigModel
  extends IDocumentModel<SellConfig>,
    SellConfig {}

const sellConfigSchemaOptions = {
  timestamps: { createdAt: false, updatedAt: "updatedAt" },
};

export const SellConfigSchema: Schema = new Schema(
  {},
  sellConfigSchemaOptions
);

SellConfigSchema.add({
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "CLOSED" },
  minTokenRequired: { type: Number, default: 10 },
  userDailyLimit: { type: Number, default: 1000 },
  totalDailyLimit: { type: Number, default: 10000 },
  liquidityBalance: { type: Number, default: 0 },
  dailyFeePercent: { type: Number, default: 3 },
  unavailableMessage: {
    type: String,
    default: "The sell service is temporarily unavailable.",
  },
});

export default SellConfigSchema;
