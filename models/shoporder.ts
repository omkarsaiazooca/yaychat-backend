import { Schema } from "mongoose";
import { Order } from "../data/shoporder";
import { IDocumentModel } from "../data/base";
export interface OrderModel extends IDocumentModel<Order>, Order {}

const orderSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

export var OrderSchema: Schema = new Schema({}, orderSchemaOptions);
// Define the OrderModel interface that extends IDocumentModel and Order
// Schema definition
OrderSchema.add({
  tracking_number: { type: String },
  products: [
    {
      product_id: { type: String },
      order_quantity: { type: Number },
      unit_price: { type: Number },
      subtotal: { type: Number },
      image: { type: String },
      name: { type: String },
      slug: { type: String },
      receiver_email: { type: String },
      personal_message: { type: String },
    },
  ],
  amount: { type: Number },
  coupon_id: { type: Number, default: null },
  discount: { type: Number },
  paid_total: { type: Number },
  sales_tax: { type: Number },
  delivery_fee: { type: Number },
  total: { type: Number },
  customer_contact: { type: String },
  customer_name: { type: String, default: "" },
  note: { type: String, default: "" },
  payment_gateway: { type: String },
  payment_sub_gateway: { type: String, default: "" },
  use_wallet_points: { type: Boolean },
  isFullWalletPayment: { type: Boolean },
  billing_address: { type: Object },
  shipping_address: { type: Object },
  language: { type: String },
  invoice_translated_text: {
    subtotal: { type: String },
    discount: { type: String },
    tax: { type: String },
    delivery_fee: { type: String },
    total: { type: String },
    products: { type: String },
    quantity: { type: String },
    invoice_no: { type: String },
    date: { type: String },
  },
  payment_intent: {
    id: { type: Number },
    tracking_number: { type: String },
    payment_gateway: { type: String },
    payment_intent_info: {
      client_secret: { type: String },
      payment_id: { type: String },
      redirect_url: { type: String, default: null },
      is_redirect: { type: Boolean },
    },
  },
  order_status: { type: String },
  payment_status: { type: String },
  payment_details: {
    company_details: {
      accountName: { type: String },
      accountNumber: { type: String },
      routingNumber: { type: String },
      domesticRoutingNumber: { type: String },
      internationalSwiftCode: { type: String },
      recipientName: { type: String },
      recipientAddress: { type: String },
      bankName: { type: String },
      bankAccountNumber: { type: String },
      bankAddress: { type: String },
      qrCodeUrl: { type: String },
      recipientEmail: { type: String },
    },
    customer_details: {
      name: { type: String },
      bankName: { type: String },
      bankAccountNumber: { type: String },
      address: { type: String },
      phone: { type: String },
    },
    currency_details: {
      currency: { type: String },
      amount: { type: Number },
    },
  },
});

export default OrderSchema;
