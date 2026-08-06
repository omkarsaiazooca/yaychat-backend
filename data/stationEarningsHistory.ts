export interface StationEarningsHistory {
  ownerEmail: string;
  minerEmail: string;
  adType: string;        // "rewarded" | "interstitial"
  cpmUsd: number;        // CPM rate at time of credit
  revenueSharePct: number;
  grossUsdPerAd: number; // cpmUsd / 1000
  earningsUsd: number;   // grossUsdPerAd * revenueSharePct/100
  earningsBtcy: number;  // earningsUsd / usdPerBtcy
  usdPerBtcy: number;    // BTCY price at time of credit
  createdAt: Date;
}
