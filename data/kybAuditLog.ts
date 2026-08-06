import { IDocumentModel, IModel } from "./base";

export enum KybAuditActorType {
  USER = "user",
  ADMIN = "admin",
  SYSTEM = "system",
}

export enum KybAuditAction {
  KYB_CREATED = "kyb_created",
  KYB_UPDATED = "kyb_updated",
  KYB_SELECTION_UPDATED = "kyb_selection_updated",
  DOCUMENT_UPLOADED = "document_uploaded",
  DIRECTOR_ADDED = "director_added",
  DIRECTOR_REMOVED = "director_removed",
  UBO_ADDED = "ubo_added",
  UBO_REMOVED = "ubo_removed",
  UBO_KYC_UPDATED = "ubo_kyc_updated",
  TAX_INFO_ADDED = "tax_info_added",
  TAX_INFO_UPDATED = "tax_info_updated",
  KYB_SUBMITTED = "kyb_submitted",
  COMPLIANCE_SCREENING_RUN = "compliance_screening_run",
  COMPLIANCE_SCREENING_PASSED = "compliance_screening_passed",
  COMPLIANCE_SCREENING_FAILED = "compliance_screening_failed",
  MANUAL_REVIEW_STARTED = "manual_review_started",
  MANUAL_REVIEW_COMPLETED = "manual_review_completed",
  KYB_APPROVED = "kyb_approved",
  KYB_REJECTED = "kyb_rejected",
  KYB_NEED_MORE_INFO = "kyb_need_more_info",
}

export interface KybAuditLog extends IModel, IDocumentModel<KybAuditLog> {
  actorId: string | null;
  actorType: KybAuditActorType;
  kybApplicationId: string | null;
  userId: string | null;
  action: KybAuditAction;
  note?: string | null;
  createdAt: Date;
}


