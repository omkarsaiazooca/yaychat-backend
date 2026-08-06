import { IDocumentModel, IModel } from "./base";

export enum KycAuditActorType {
  USER = "USER",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM",
}

export enum KycAuditAction {
  KYC_CREATED = "KYC_CREATED",
  DOC_UPLOADED = "DOC_UPLOADED",
  KYC_SUBMITTED = "KYC_SUBMITTED",
  KYC_APPROVED = "KYC_APPROVED",
  KYC_REJECTED = "KYC_REJECTED",
  KYC_NEED_MORE_INFO = "KYC_NEED_MORE_INFO",
}

export interface KycAuditLog extends IModel, IDocumentModel<KycAuditLog> {
  actorId: string; // ObjectId - user or admin
  actorType: KycAuditActorType;
  action: KycAuditAction;
  userId: string; // ObjectId - owner of the KYC
  kycApplicationId: string | null; // ObjectId ref to KycApplication
  note: string;
  createdAt: Date;
}

