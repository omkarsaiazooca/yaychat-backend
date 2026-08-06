
export interface Tip {
}

export interface AmountDetails {
    tip: Tip;
}

export interface AutomaticPaymentMethods {
    enabled: boolean;
}

export interface Charges {
    object: string;
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
}

export interface Metadata {
}

export interface Alipay {
}

export interface Card {
    installments?: any;
    mandate_options?: any;
    network?: any;
    request_three_d_secure: string;
}

export interface Link {
    persistent_token?: any;
}

export interface WechatPay {
    app_id?: any;
    client?: any;
}

export interface PaymentMethodOptions {
    alipay: Alipay;
    card: Card;
    link: Link;
    wechat_pay: WechatPay;
}

export interface StripePayment {
    email: string;
    userWalletAddress: string;
    orderId: string;
    object: string;
    amount: number;
    amount_capturable: number;
    amount_details: AmountDetails;
    amount_received: number;
    application?: any;
    application_fee_amount?: any;
    automatic_payment_methods: AutomaticPaymentMethods;
    canceled_at?: any;
    cancellation_reason?: any;
    capture_method: string;
    charges: Charges;
    client_secret: string;
    confirmation_method: string;
    created: number;
    currency: string;
    customer?: any;
    description?: any;
    invoice?: any;
    last_payment_error?: any;
    livemode: boolean;
    metadata: Metadata;
    next_action?: any;
    on_behalf_of?: any;
    payment_intent: string;
    payment_method?: any;
    payment_method_options: PaymentMethodOptions;
    payment_method_types: string[];
    processing?: any;
    receipt_email?: any;
    review?: any;
    setup_future_usage?: any;
    shipping?: any;
    source?: any;
    statement_descriptor?: any;
    statement_descriptor_suffix?: any;
    status: string;
    transfer_data?: any;
    transfer_group?: any;
}
