import { IDocumentModel, IModel } from "./base";

export enum KycDocumentType {
  ID_FRONT = "ID_FRONT",
  ID_BACK = "ID_BACK",
  PASSPORT = "PASSPORT",
  SELFIE = "SELFIE",
  PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS",
}

export interface KycDocument extends IModel, IDocumentModel<KycDocument> {
  kycApplicationId: string; // ObjectId ref to KycApplication
  userId: string; // ObjectId ref to User
  type: KycDocumentType;
  s3Key: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

