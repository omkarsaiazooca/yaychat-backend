import { IDocumentModel, IModel } from "./base";

export interface KybDirector extends IModel, IDocumentModel<KybDirector> {
  kybApplicationId: string; // ObjectId ref to KybApplication
  userId: string; // ObjectId ref to User (the business owner)
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  nationality?: string;
  countryOfResidence?: string;
  address?: string;
  position: string; // e.g., "CEO", "Director", "Secretary"
  ownershipPercentage?: number; // If applicable
  idDocumentType?: string; // passport | driving_license | national_id
  idDocumentS3Key?: string; // legacy single S3 key
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


