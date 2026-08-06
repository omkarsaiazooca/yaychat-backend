import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybApplication, KybStatus } from "../data/kybApplication";

export interface KybApplicationModel extends IDocumentModel<KybApplication>, KybApplication {}

const businessInfoSchema = new Schema(
  {
    legalName: { type: String, default: "" },
    tradingName: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    countryOfIncorporation: { type: String, default: "" },
    address: { type: String, default: "" },
    website: { type: String, default: "" },
    businessType: { type: String, default: "" },
    industryCode: { type: String, default: "" },
    yearOfIncorporation: { type: Number, default: null },
    numberOfEmployees: { type: Number, default: null },
    businessDescription: { type: String, default: "" },
  },
  { _id: false }
);

const complianceInfoSchema = new Schema(
  {
    purposeOfUse: { type: String, default: "" },
    expectedMonthlyVolume: { type: String, default: "" },
    expectedTransactionCount: { type: String, default: "" },
    expectedTransactionSize: { type: String, default: "" },
    sourceOfFunds: { type: String, default: "" },
    sourceOfWealth: { type: String, default: "" },
    dealsWithCrypto: { type: Boolean, default: false },
    dealsWithCashIntensive: { type: Boolean, default: false },
    dealsWithHighRiskCountries: { type: Boolean, default: false },
  },
  { _id: false }
);

const kybApplicationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, required: true, index: true },
    businessInfo: { type: businessInfoSchema, default: {} },
    complianceInfo: { type: complianceInfoSchema, default: {} },
    selectedEntityType: { type: String, default: null },
    selectedCountry: { type: String, default: null },
    levelRequested: { type: Number, default: 1 },
    status: {
      type: String,
      enum: Object.values(KybStatus),
      default: KybStatus.DRAFT,
      required: true,
      index: true,
    },
    riskScore: { type: Number, default: 0 },
    rejectionReason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

kybApplicationSchema.index({ userId: 1, createdAt: -1 });
kybApplicationSchema.index({ status: 1 });

export default kybApplicationSchema;


