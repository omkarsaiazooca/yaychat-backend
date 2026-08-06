// balance.interface.ts
export interface UserMiningBalance {
    email: string;
    transferableBalance: number;        // mining earnings only
    adRevenueTransferableBalance?: number; // station ad revenue share only (default 0)
    migratedBalance: number;
    unverifiedBalance: number;
    createdAt?: Date;
    coinSymbol?: string;
    coinName?: string;
    coinNetwork?: string;
  }