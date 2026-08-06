import { IDocumentModel, IModel } from "./base";

export interface BTCYBuyHistory
  extends IModel,
  IDocumentModel<BTCYBuyHistory> {
  email: string;
  orderId: string;
  orderMongoId?: string;
  amount: number;
  priceAtBuy: number;
  boughtAt: Date;
  coinSymbol?: string;
  createdDate?: Date;
}
