import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KycApplication, KycStatus } from "../data/kycApplication";

export interface KycApplicationModel extends IDocumentModel<KycApplication>, KycApplication {}

const personalInfoSchema = new Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  dob: { type: String, default: "" }, // YYYY-MM-DD
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  country: { type: String, default: "" },
  postalCode: { type: String, default: "" },
  nationality: { type: String, default: "" },
}, { _id: false });

const kycApplicationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  userEmailLower: { type: String, required: true, index: true },
  levelRequested: { type: Number, default: 1 },
  personalInfo: { type: personalInfoSchema, default: {} },
  selectedDocumentType: { type: String, default: null },
  selectedCountry: { type: String, default: null },
  status: {
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.DRAFT,
    required: true,
    index: true,
  },
  riskScore: { type: Number, default: 0 },
  rejectionReason: { type: String, default: null },
}, {
  timestamps: true,
});

// Indexes
kycApplicationSchema.index({ userId: 1, createdAt: -1 });
kycApplicationSchema.index({ status: 1 });
kycApplicationSchema.index({ userEmailLower: 1 });

export default kycApplicationSchema;

