import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import {
  PayPalSubscription,
  SubscriptionStatus,
} from "../data/paypalSubscription";

export interface PaypalSubscriptionModel
  extends IDocumentModel<PayPalSubscription>,
    PayPalSubscription {}

const paypalSubscriptionSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var PaymentLinkSchema: Schema = new Schema({
  href: String,
  rel: String,
  method: String,
});

var paypalSubscriptionSchema: Schema = new Schema(
  {},
  paypalSubscriptionSchemaOptions
);

const AddressSchema = new Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  postal_code: String,
  country_code: String,
});

const ShippingAddressSchema = new Schema({
  address: AddressSchema,
});

const CurrencySchema = new Schema({
  currency_code: String,
  value: String,
});

const NameSchema = new Schema({
  given_name: String,
  surname: String,
});

const SubscriberSchema = new Schema({
  email_address: String,
  payer_id: String,
  name: { type: NameSchema },
  shipping_address: { type: ShippingAddressSchema },
});

const CycleExecutionSchema = new Schema({
  tenure_type: String,
  sequence: Number,
  cycles_completed: Number,
  cycles_remaining: Number,
  total_cycles: Number,
});

const BillingInfoSchema = new Schema({
  outstanding_balance: CurrencySchema,
  cycle_executions: [CycleExecutionSchema],
  next_billing_time: String,
  final_payment_time: String,
  failed_payments_count: Number,
});

const PayPalLinkSchema = new Schema({
  href: String,
  rel: String,
  method: String,
});

paypalSubscriptionSchema.add({
  orderId: Number,
  status: { type: String, enum: Object.keys(SubscriptionStatus) },
  subscriptionId: String,
  plan_id: String,
  quantity: String,
  status_update_time: String,
  start_time: String,
  orderAmount: String,
  orderCurrency: String,
  payerEmail: String,
  payerName: String,
  subscriber: { type: SubscriberSchema },
  billing_info: { type: BillingInfoSchema },
  create_time: String,
  update_time: String,
  plan_overridden: Boolean,
  links: [{ type: PayPalLinkSchema }],
  transactionArray: [{ type: Object }],
});

export default paypalSubscriptionSchema;
