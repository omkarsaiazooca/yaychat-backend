export interface PaymentLink {
    href: string;
    rel: string;
    method: string;
}

export interface PaypalPayment {
    paypalId: string;
    orderId: string;
    status: string;
    links: PaymentLink[];
    orderAmount: string,
    orderCurrency: string,
    payerEmail?:string,
    payerName?: string,
    payerLastName?: string,
    payerId?: string,
}