export interface VestingConfig {
    option: string;
    vestingDuration: number; // in months
    monthlyWithdrawalPercentages: number[]; // percentage per month
    description: string;
    createdOn: Date;
    updatedOn: Date;
    coinSymbol: string;
}