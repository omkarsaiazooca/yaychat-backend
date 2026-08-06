export interface Reward {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    referralCode?: string;
    totalRewards: number;
    rewardCurrency: string;
    rewardTokenBalanceInUSD: number;
    rewardCurrencySymbol: string;
    rewardCurrencyDecimals: number;
    rewardUpdatedOn: Date;
    rewardTokenPrice: number;
    rewardTokenAddress: string
}