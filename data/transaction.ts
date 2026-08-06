import { OrderStatus } from "./order";

export interface Transaction {
    orderId: string;
    extRef: string;
    txId: string;
    from: string;
    to: string;
    amount: number;
    info: string;
    status: OrderStatus;
    currencyRef: string;
    walletType: string;
    transactionType: string;
    exchangeName: string;
    email: string,
    userWalletAddress?: string,
    txDate: Date;
    benificaryAddress: string
    depositedType?: string //Zelle or WireTransfer or Bank Transfer
    paymentReceiptUrl?: string,
    notes?: string
    amountInvested?: number;
    fees?: number;
    profitTaken?: boolean;
    profitLastTakenDate?: Date;
    rate?: number;
}