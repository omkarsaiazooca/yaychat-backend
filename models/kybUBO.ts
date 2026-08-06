import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybUBO, UboKycStatus } from "../data/kybUBO";

export interface KybUBOModel extends IDocumentModel<KybUBO>, KybUBO {}

const kybUboSchema = new Schema({
  kybApplicationId: { type: Schema.Types.ObjectId, ref: "KybApplication", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: "" },
  dateOfBirth: { type: String, default: "" },
  nationality: { type: String, default: "" },
  countryOfResidence: { type: String, default: "" },
  address: { type: String, default: "" },
  ownershipPercentage: { type: Number, required: true },
  relationshipToCompany: { type: String, required: true },
  idDocumentType: { type: String, default: "passport" },
  idDocumentS3Key: { type: String, default: "" },
  idDocumentMimeType: { type: String, default: "" },
  idDocumentFrontS3Key: { type: String, default: "" },
  idDocumentFrontMimeType: { type: String, default: "" },
  idDocumentBackS3Key: { type: String, default: "" },
  idDocumentBackMimeType: { type: String, default: "" },
  selfieS3Key: { type: String, default: "" },
  selfieMimeType: { type: String, default: "" },
  isPep: { type: Boolean, default: false },
  isSanctioned: { type: Boolean, default: false },
  sanctionsScreeningStatus: { type: String, default: "pending" },
  kycStatus: {
    type: String,
    enum: Object.values(UboKycStatus),
    default: UboKycStatus.PENDING,
    required: true,
    index: true,
  },
  kycApplicationId: { type: Schema.Types.ObjectId, ref: "KycApplication", default: null },
}, {
  timestamps: true,
});

kybUboSchema.index({ kybApplicationId: 1, createdAt: -1 });
kybUboSchema.index({ kycStatus: 1 });

export default kybUboSchema;


