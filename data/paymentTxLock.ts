import { IDocumentModel, IModel } from "./base";

export interface PaymentTxLock extends IModel, IDocumentModel<PaymentTxLock> {
  txHash: string;
  orderId: string;
  email?: string;
  status: string;
  blockchain?: string;
  paymentType?: string;
  amount?: number;
  receiverAddress?: string;
  verifiedAt?: Date;
  created?: Date;
  modified?: Date;
}
