import { OrderStatus } from "./order";

export interface PowerPack {
  amount: string;
  email?: string;
  orderId: string;
  purchaseDate: Date;
  type: string;
  paymentMethodUsed: string;
  paymentStatus: OrderStatus;
  notes?: string
}
