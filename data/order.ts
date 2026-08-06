import { IDocumentModel, IModel } from './base';
import { Currency, PaymentTypes, TransactionAccount } from './common';
import { UserLite } from './user';


export interface OrderLite {
    orderId: string;
    currency: Currency;
    amount: number;
    status: OrderStatus;
}

export enum OrderType {
    Buy = 'Buy',
    Sell = 'Sell',
    Convert = 'Convert',
    PowerPack = 'PowerPack',
    BuyETF = 'BuyETF',
    SellETF = 'SellETF',
    Subscription = 'Subscription',
    MonthlyINEXBuy = "MonthlyINEXBuy",
    LotteryBuy = "LotteryBuy",
    SmartCryptoBuy = "SmartCryptoBuy",
    SmartAPY = "SmartAPY",
    GiftCardBuy = "GiftCardBuy",
    FreeTrailOrder = "FreeTrailOrder",
    SmartCryptoFreeTrialConvert = "SmartCryptoFreeTrialConvert",
    MiningSubscriptionOrder = "MiningSubscriptionOrder",
    AIBuy = "AIBuy",
    AISell = "AISell",
    Deposit = "Deposit"
}

export enum OrderStatus {
    //Cancel = "Cancel",
    Quoted = "Quoted",
    //Paying = "Paying",
    Paid = "Paid",
    Pending = "Pending",
    LotteryBuy = "LotteryBuy",
    Payment_Submitted = "Payment Submitted",
    // KYCApprovalPending = "KYCApprovalPending",
    // KYCApproved = "KYCApproved",
    // KYCDeclined = "KYCDeclined",
    // AMLApprovalPending = "AMLApprovalPending",
    // AMLApproved = "AMLApproved",
    // AMLDeclined = "AMLDeclined",
    // Sending = "Sending",
    // PayoutAwaitsapproval = "PayoutAwaitsapproval",
    // SendingAborted = "SendingAborted",
    //Sent = "Sent",
    // Releasingpayment = "Releasingpayment",
    // ReleasingpaymentAborted = "ReleasingpaymentAborted",
    // Releasedpayment = "Releasedpayment",
    Completed = "Completed",
    // PayoutApproved = "PayoutApproved",
    // PaymentAborted = "PaymentAborted",
    // CaptureErrored = "CaptureErrored",
    // ComplianceOfficerApproval = "ComplianceOfficerApproval",
    // CustomerResponsePending = "CustomerResponsePending",
    OrderCancelled = "OrderCancelled",
    // KYCDecline = "KYCDecline",
    ReleaseErrored = "ReleaseErrored",
    ReceivedDeposit = "ReceivedDeposit",
    ReceivedFiat = "ReceivedFiat"
}

export interface Rates {
    rate: number;
    currency: string;
}

export interface OrderTransaction {
    currency: Currency;
    amount: number;
    trnReference: string;
    trnHash: string;
    walletAddress: string;
    created: Date;
    status: string;
}

export interface OrderBreakdown {
    inCurrenyName: string;
    inAmount: number;
    feePercent?: number;
    feeAmount?: number;
    netAmount?: number;
    totalPayable?: number;
    outCurrencyName: string;
    outAmount: number;
    finalAmountAfterDiscount: number;
}

export interface WireTransferConfirmation {
    customerName: string;
    bankName: string;
    bankAccountNumber: string;
    address: string;
    phoneNumber: string;
    confirmedAt: Date;
    updatedAt: Date;
}

export interface Order extends OrderLite, IModel, IDocumentModel<Order> {
    orderId: string;
    status: OrderStatus;
    orderType: OrderType;
    usdValue?: number;
    merchantStatus?: string; // Order status provided by merchant and merchant name "{MerchantName} {OrderStatus updated by Merchant}"
    merchantReferenceId?: string; //OrderId of merchant for example stripe orderId
    merchantName?: string;
    orderRate: Rates; //Latest rate at which the order is received 
    merchantRateStr?: string; // Merchant rate with currency
    merchantRate?: number;
    receiverAccount: TransactionAccount;
    paymentType: PaymentTypes,
    breakdown: OrderBreakdown,
    user: UserLite,
    transactions?: OrderTransaction[],
    created: Date,
    comments: string, // new variable to save comments while donating
    modified?: Date,
    isLocked?: boolean,
    LockedUntil?: Date,
    LockedBy?: string,
    merchantMinersFees?: number,
    exchangeFees?: number,
    orderCompletedOn: Date,
    indexxTokenOrdersCount: number,
    otherTokenOrdersCount: number,
    exchangeName: string,
    blockchainName: string,
    isCaptainPerformingOrder: boolean,
    captainBeeEmail: string,
    discountCode: string,
    discountPercentage: number,
    powerPackFees: number,
    notes: string,
    smartAPYPercentage?: number,
    smartAPYduration?: string,
    giftCardDetails?: string[],
    appleTransactionId?: string,
    productId?: string,
    expirationDate?: Date,
    appleReceipt?: String,
    subscriptionStartDate?: Date,
    subscriptionEndDate?: Date,
    lastUpdated?: Date
    subscriptionCancelledAt?: Date,
    googlePurchaseToken?: string,
    googlePackageName?: string,
    referralCode?: string, // Referral code used during checkout
    wireTransferConfirmation?: WireTransferConfirmation,
}
export interface TransactionData extends IModel, IDocumentModel<TransactionData> {
    caseId: string;
    // trnReference: string;
    order: any;
    trnInfo: any;
}
