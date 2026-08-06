export interface SmartApy {
    smartApyId: string,
    stakedAmount: number,  //How much user is staking
    rewardAmount: number,  //How much user is staking
    finalAmount: number, // Final amount what user get
    coin: string,
    rewardCoin: string,
    email: string,
    percentage: number, //6 Months 20%(0.20),12 Months 30%(0.30), 18 Months 40%(0.40)
    startDate: Date,
    endDate: Date,
    isActive: boolean,
    type: string, //Short or Long
    duration: string // 6 months or 12 months or 18 months
}