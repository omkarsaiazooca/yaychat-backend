import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { InvestmentRecord } from "../data/InvestmentRecord"; // Assuming the interface is stored in investmentRecord.ts

export interface InvestmentRecordModel
  extends IDocumentModel<InvestmentRecord>,
    InvestmentRecord {}

const investmentRecordSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var InvestmentRecordSchema: Schema = new Schema(
  {},
  investmentRecordSchemaOptions
);

InvestmentRecordSchema.add({
  investmentId: { type: Number, unique: true },
  name: { type: String },
  email: { type: String },
  category: { type: String },
  directLeader: { type: String },
  leaderL2: { type: String },
  colonyLeader: { type: String },
  investmentPackage: { type: String },
  investmentAmount: { type: Number },
  investmentMethod: { type: String },
  discountAmount: { type: Number },
  bonusAmount: { type: String },
  dateOfSignIn: { type: Date },
  withdrawalRequests: { type: String },
  indexxFee: { type: String },
  feeAmount: { type: Number },
  monthlyInvestment: { type: String },
  stakingInterestAPY: { type: String },
  inexValueForStaking: { type: String },
  hiveRank: { type: String },
  hiveRankingIncomePercent: { type: String },
  level1LeaderPercentCommission: { type: String },
  level0GrandColonyLeaderPercentCommission: { type: String },
  referralCode: { type: String },
});

export default InvestmentRecordSchema;
