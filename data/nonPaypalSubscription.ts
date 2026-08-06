export interface NonPaypalSubscription {
  orderId: string,
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string;
  createdDate: Date;
  paymentDate: Date;
  nextPaymentDate: string;
  notes?: string; // Optional field for any additional notes
  email: string;
  address: string;
}