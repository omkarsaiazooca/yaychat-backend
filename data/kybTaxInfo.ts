import { IDocumentModel, IModel } from "./base";

export interface KybTaxInfo extends IModel, IDocumentModel<KybTaxInfo> {
  kybApplicationId: string; // ObjectId ref to KybApplication
  userId: string; // ObjectId ref to User
  taxIdentificationNumber: string; // TIN/EIN/VAT number
  taxCountry: string; // Country where tax ID is registered
  taxDocumentS3Key?: string; // S3 key for tax certificate/document
  vatNumber?: string;
  fatcaStatus?: string; // e.g. "us_linked", "non_us", "exempt"
  createdAt: Date;
  updatedAt: Date;
}


