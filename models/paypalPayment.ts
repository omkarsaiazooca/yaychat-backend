import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PaypalPayment } from "../data/paypalPayments";

export interface PaypalPaymentModel
  extends IDocumentModel<PaypalPayment>,
    PaypalPayment {}

const paypalPaymentSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var PaymentLinkSchema: Schema = new Schema({
  href: String,
  rel: String,
  method: String,
});

var paypalSchemaSchema: Schema = new Schema({}, paypalPaymentSchemaOptions);

paypalSchemaSchema.add({
  paypalId: String,
  orderId: String,
  status: String,
  links: [{ type: PaymentLinkSchema }],
  orderAmount: String,
  orderCurrency: String,
  payerEmail: { type: String, default: "" },
  payerName: { type: String, default: "" },
  payerLastName: { type: String, default: "" },
  payerId: { type: String, default: "" },
});

export default paypalSchemaSchema;
