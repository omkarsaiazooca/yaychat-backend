import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { KybCompliance, ComplianceStatus } from "../data/kybCompliance";

export interface KybComplianceModel extends IDocumentModel<KybCompliance>, KybCompliance {}

const complianceScreeningResultSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(ComplianceStatus),
    required: true,
  },
  screeningDate: { type: Date, required: true },
  screeningProvider: { type: String, default: "" },
  riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
  matches: [{
    type: { type: String, default: "" },
    description: { type: String, default: "" },
    source: { type: String, default: "" },
  }],
  notes: { type: String, default: "" },
  screenedBy: { type: String, default: "" },
}, { _id: false });

const kybComplianceSchema = new Schema({
  kybApplicationId: { type: Schema.Types.ObjectId, ref: "KybApplication", required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  businessScreening: { type: complianceScreeningResultSchema, default: null },
  directorsScreening: [{ type: complianceScreeningResultSchema, default: [] }],
  ubosScreening: [{ type: complianceScreeningResultSchema, default: [] }],
  overallStatus: {
    type: String,
    enum: Object.values(ComplianceStatus),
    default: ComplianceStatus.PENDING,
    required: true,
    index: true,
  },
  requiresManualReview: { type: Boolean, default: false, index: true },
  reviewNotes: { type: String, default: "" },
  reviewedBy: { type: String, default: "" },
  reviewedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

export default kybComplianceSchema;






