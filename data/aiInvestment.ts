export interface Investment {
  userId: string;
  email: string;
  type: "smart-mix" | "crypto" | "stock";
  amount: number;
  riskLevel: number;
  timeframe: string; // e.g., "1d", "7d", "30d"
  asset?: string;    // e.g., BTCUSDT
  status?: "pending" | "executed" | "failed";
  createdAt?: Date;
  simulatedPrice: number;
  usdAmount?: number;  // amount in USD to invest
  priceAtExecution?: number; // price of asset at execution
  basket?: Array<{ symbol: string; weight: number }>; // for smart-mix
  investmentId?: string; // unique identifier for the investment
  side?: "buy" | "sell"; // buy or sell
  feesUsd?: number;
  currentPrice?: number,        // live
  remainingQty?: number,        // buy rows after FIFO; 0 for sells
  currentValueUsd?: number,     // remainingQty * currentPrice
  realizedPnlUsd?: number,      // from matched sells (or piece realized when this buy was consumed)
  unrealizedPnlUsd?: number,    // on remainingQty
  totalPnlUsd?: number,         // realized + unrealized
  pnlPct?: number
  __normSym: string;
  __timestamp: number;
  __remainingQty: number;
  __realizedPnlUsd: number;
  __unrealizedPnlUsd: number;
  __totalPnlUsd: number;
  __pnlPct: number;
  __currentValueUsd: number;
  __currentPrice: number;
}
