import { IDocumentModel, IModel } from "./base";

export enum ComplianceStatus {
  PENDING = "pending",
  PASSED = "passed",
  FAILED = "failed",
  MANUAL_REVIEW = "manual_review",
}

export interface ComplianceScreeningResult {
  status: ComplianceStatus;
  screeningDate: Date;
  screeningProvider?: string; // e.g., "WorldCheck", "PEP", "Sanctions"
  riskLevel?: "low" | "medium" | "high";
  matches?: Array<{
    type: string; // "PEP", "Sanctions", "Adverse Media", etc.
    description: string;
    source: string;
  }>;
  notes?: string;
  screenedBy?: string; // Admin email who ran the screening
}

export interface KybCompliance extends IModel, IDocumentModel<KybCompliance> {
  kybApplicationId: string; // ObjectId ref to KybApplication
  userId: string; // ObjectId ref to User
  businessScreening?: ComplianceScreeningResult;
  directorsScreening?: ComplianceScreeningResult[];
  ubosScreening?: ComplianceScreeningResult[];
  overallStatus: ComplianceStatus;
  requiresManualReview: boolean;
  reviewNotes?: string;
  reviewedBy?: string; // Admin email
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}






