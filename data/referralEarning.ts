import { IDocumentModel, IModel } from "./base";

// Define the structure of the Order
export interface order {
  email: string;
  amount: number;
  currency: string;
  type: string;
  date: Date;
  commissionValue: number;
}

// Define the structure of the ReferralEarning
export interface referralEarning
  extends IModel,
    IDocumentModel<referralEarning> {
  referrerEmail: string;
  referrerCode: string;
  totalEarned: number;
  commissionCurrency: string;
  commissionPercentage: number;
  orders: order[];
  createdDate: Date;
  notes?: string;
}
