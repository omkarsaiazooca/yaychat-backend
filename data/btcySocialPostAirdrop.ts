import { IDocumentModel, IModel } from "./base";

export interface BTCYSocialPostAirdropRegistration
  extends IModel,
    IDocumentModel<BTCYSocialPostAirdropRegistration> {
  _id?: any;
  name: string;
  email: string;
  emailLower: string;
  postLink: string;
  postLinkNormalized: string;
  walletAddress: string;
  walletAddressLower: string;
  userId: any;
  tokenName: string;
  eventType: string;
  network: string;
  walletToken: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
