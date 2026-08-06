export interface ProfitLog {
    userEmail: string;                // Email of the user whose profit was taken
    profitAccountEmail: string;       // Email of the profit account where profit is credited
    currencyRef: string;              // The currency (e.g., BTC) in which the profit is taken
    profitInCrypto: number;           // Profit taken in cryptocurrency
    profitInUsd: number;              // Profit equivalent in USD
    txDate: Date;                     // The original transaction date
    originalInvestment: number;       // The original investment in USD
    currentValue: number;             // The current value of the investment
    logDate: Date;                    // Date the log entry was created
    note: string;                     // Additional notes (e.g., "Tip for making profit to profit account")
    totalProfit?: number;
    type: string; // Buy or Sell Or Profit or Convert
  }
  