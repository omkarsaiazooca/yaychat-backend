import { IDocumentModel, IModel } from "./base";

export interface EmailValidation
  extends IModel,
  IDocumentModel<EmailValidation> {
  email: string;
  provider: string;
  status?: string;
  subStatus?: string;
  didYouMean?: string | null;
  account?: string;
  domain?: string;
  checkedAt: Date;
  accountIndex?: number;
  raw?: any;
  createdAt?: Date;
}
