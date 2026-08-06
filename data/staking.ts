export interface Staking {
    stakingId: string,
    stakedAmount: number,  //How much user is staking
    rewardAmount: number,  //How much user is staking
    finalAmount: number, // Final amount what user get
    coin: string,
    rewardCoin: string,
    email: string,
    percentage: number, //Short - 6 Months 6%(0.06), Long - 12 Months 15%(0.15)
    startDate: Date,
    endDate: Date,
    isActive: boolean,
    type: string, //Short or Long
    duration: string // 6 months or 12 months
}