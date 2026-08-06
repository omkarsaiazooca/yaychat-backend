import { IDocumentModel, IModel } from "./base";

export enum KybStatus {
  DRAFT = "draft",
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  NEED_MORE_INFO = "need_more_info",
}

export interface BusinessInfo {
  legalName: string;
  tradingName?: string;
  registrationNumber: string;
  countryOfIncorporation: string;
  address: string;
  website?: string;
  businessType?: string; // Legal structure (LLC, Pvt Ltd, etc.)
  industryCode?: string; // NACE/NAICS
  yearOfIncorporation?: number;
  numberOfEmployees?: number;
  businessDescription?: string;
}

export interface ComplianceInfo {
  purposeOfUse: string;
  expectedMonthlyVolume: string;
  expectedTransactionCount: string;
  expectedTransactionSize: string;
  sourceOfFunds: string;
  sourceOfWealth: string;
  dealsWithCrypto: boolean;
  dealsWithCashIntensive: boolean;
  dealsWithHighRiskCountries: boolean;
}

export interface KybApplication extends IModel, IDocumentModel<KybApplication> {
  userId: string;
  userEmail: string;
  businessInfo?: BusinessInfo;
  complianceInfo?: ComplianceInfo;
  selectedEntityType?: string | null;
  selectedCountry?: string | null;
  levelRequested: number;
  status: KybStatus;
  riskScore: number;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}


