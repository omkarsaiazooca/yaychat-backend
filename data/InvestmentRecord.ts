export interface InvestmentRecord {
  investmentId: number; // Unique identifier for the investment record
  name: string; // Name of the investor
  email: string; // Email of the investor
  category: string; // Category of the investor
  directLeader?: string; // Direct Leader (L1)
  leaderL2?: string; // Leader L2
  colonyLeader?: string; // Colony Leader
  investmentPackage?: string; // Investment Package/Plan
  investmentAmount?: number; // Investment Amount (USD)
  investmentMethod?: string; // Investment Methods (Payment Method)
  discountAmount?: number; // Discount Amount
  bonusAmount?: string; // Bonus Amount (INEX)
  dateOfSignIn?: Date; // Date of Sign In
  withdrawalRequests?: string; // Withdrawal Requests
  indexxFee?: string; // Indexx Fee
  feeAmount?: number; // Fee Amount
  monthlyInvestment?: string; // Monthly investment
  stakingInterestAPY?: string; // Staking Interest (APY)
  inexValueForStaking?: string; // INEX Value for staking
  hiveRank?: string; // Hive Rank
  hiveRankingIncomePercent?: string; // Hive Ranking Income %
  level1LeaderPercentCommission?: string; // Level 1 Leader Percentage Commission
  level0GrandColonyLeaderPercentCommission?: string; // Level 0 Grand Colony Leader Percentage Commission
  referralCode?: string; // Referral Code
}