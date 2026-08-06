import { IDocumentModel, IModel } from "./base";

export interface AirdropCampaign extends IModel, IDocumentModel<AirdropCampaign> {
  name: string;
  title?: string;
  imageUrl?: string;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  body?: string;
  termsUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
