// Define the interfaces for nested objects
export interface Product {
  product_id: string;
  order_quantity: number;
  unit_price: number;
  subtotal: number;
  image: string;
  name: string;
  slug: string;
  receiver_email: string;
  personal_message: string;
}

export interface InvoiceTranslatedText {
  subtotal: string;
  discount: string;
  tax: string;
  delivery_fee: string;
  total: string;
  products: string;
  quantity: string;
  invoice_no: string;
  date: string;
}

export interface PaymentIntentInfo {
  client_secret: string;
  payment_id: string;
  redirect_url: string | null;
  is_redirect: boolean;
}

export interface PaymentIntent {
  id: number;
  tracking_number: string;
  payment_gateway: string;
  payment_intent_info: PaymentIntentInfo;
}

export interface CompanyDetails {
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  domesticRoutingNumber: string;
  internationalSwiftCode: string;
  recipientName: string;
  recipientAddress: string;
  bankName: string;
  bankAccountNumber: string;
  bankAddress: string;
  qrCodeUrl: string;
  recipientEmail: string;
}

export interface CustomerDetails {
  name: string;
  bankName: string;
  bankAccountNumber: string;
  address: string;
  phone: string;
}

export interface CurrencyDetails {
  currency: {
    type: string;
  };
  amount: {
    type: number;
  };
}

export interface PaymentDetails {
  company_details: CompanyDetails;
  customer_details: CustomerDetails;
  currency_details: CurrencyDetails;
}

export interface Order {
  _id?: any;
  tracking_number: string;
  products: Product[];
  amount: number;
  coupon_id: number | null;
  discount: number;
  paid_total: number;
  sales_tax: number;
  delivery_fee: number;
  total: number;
  customer_contact: string;
  customer_name: string;
  note: string;
  payment_gateway: string;
  payment_sub_gateway: string;
  use_wallet_points: boolean;
  isFullWalletPayment: boolean;
  billing_address: Record<string, any>;
  shipping_address: Record<string, any>;
  language: string;
  invoice_translated_text: InvoiceTranslatedText;
  payment_intent: PaymentIntent;
  order_status: string;
  payment_status: string;
  payment_details: PaymentDetails;
  created: Date;
  modified: Date;
}
