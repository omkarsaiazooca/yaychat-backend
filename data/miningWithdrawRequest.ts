export interface WithdrawRequest {
  orderId: string;
    email: string;
    requestedAmount: number;
    approvedAmount: number;
    requestedAmountUsd?: number;
    approvedAmountUsd?: number;
    payoutAmount?: number;
    payoutCurrency?: "USDT" | "USDC" | "BTCY";
    feeAmountUsd?: number;
    feePercentage?: number;
    source?: "mining_balance" | "ad_revenue";
  requestedAmountBtcy?: number;  // BTCY amount deducted from adRevenueTransferableBalance on submit — used to restore on reject
    status: "Pending" | "Approved" | "Rejected";
    withdrawalMethod: "Immediate" | "Vested" | "USDT" | "USDC" | "BTCY";
    walletAddress?: string;
    network?: string;
    createdAt: Date;
    processedAt?: Date;
    txHash?: string; // Transaction hash for blockchain transfer
  }
