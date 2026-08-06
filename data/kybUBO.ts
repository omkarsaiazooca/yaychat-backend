import { IDocumentModel, IModel } from "./base";

export enum UboKycStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface KybUBO extends IModel, IDocumentModel<KybUBO> {
  kybApplicationId: string; // ObjectId ref to KybApplication
  userId: string; // ObjectId ref to User (the business owner who added this UBO)
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  nationality?: string;
  countryOfResidence?: string;
  address?: string;
  ownershipPercentage: number; // Required for UBOs
  relationshipToCompany: string; // e.g., "Shareholder", "Beneficial Owner", "Trust Beneficiary"
  kycStatus: UboKycStatus; // Track if UBO has completed their KYC
  kycApplicationId?: string; // Link to their KYC application if they complete it
  idDocumentType?: string;
  idDocumentS3Key?: string;
  idDocumentMimeType?: string;
  idDocumentFrontS3Key?: string;
  idDocumentFrontMimeType?: string;
  idDocumentBackS3Key?: string;
  idDocumentBackMimeType?: string;
  selfieS3Key?: string;
  selfieMimeType?: string;
  isPep?: boolean;
  isSanctioned?: boolean;
  sanctionsScreeningStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}


