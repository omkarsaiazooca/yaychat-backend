export interface PaymentLink {
  href: string;
  rel: string;
  method: string;
}

export enum SubscriptionStatus {
  APPROVAL_PENDING = "APPROVAL_PENDING",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED"
}

export interface Subscriber {
  email_address: string;
  payer_id: string;
  name: Name;
  shipping_address: ShippingAddress;
}

export interface PayPalSubscription {
  orderId: number;
  status: SubscriptionStatus;
  orderAmount: string;
  subscriptionId: string;
  plan_id: string;
  quantity: string;
  status_update_time: string;
  start_time: string;
  orderCurrency: string;
  payerEmail: string;
  payerName: string;
  subscriber: Subscriber;
  billing_info: BillingInfo;
  create_time: string;
  update_time: string;
  plan_overridden: boolean;
  links: PaymentLink[];
  transactionArray: Object[];
}

export interface BillingInfo {
  outstanding_balance: Currency;
  cycle_executions: CycleExecution[];
  next_billing_time: string;
  final_payment_time: string;
  failed_payments_count: number;
}

export interface Currency {
  currency_code: string;
  value: string;
}

export interface CycleExecution {
  tenure_type: string;
  sequence: number;
  cycles_completed: number;
  cycles_remaining: number;
  total_cycles: number;
  // Add more fields as per the PayPal API documentation
}

export interface ShippingAddress {
  address: Address;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
}

export interface Name {
  given_name: string;
  surname: string;
}
