import { IDocumentModel, IModel } from "./base";

export enum KycStatus {
  DRAFT = "draft",
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  NEED_MORE_INFO = "need_more_info",
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  address: string;
  city: string;
  country: string;
  postalCode: string;
  nationality: string;
}

export interface KycApplication extends IModel, IDocumentModel<KycApplication> {
  userId: string; // ObjectId ref to User
  userEmail: string;
  userEmailLower: string;
  levelRequested: number; // e.g. 1 = basic, 2 = advanced
  personalInfo?: PersonalInfo;
  selectedDocumentType?: string | null;
  selectedCountry?: string | null;
  status: KycStatus;
  riskScore: number; // default 0
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

