export interface Commission {
  _doc?: any;
  orderId: string;
  mainCaptainBeeEmail: string;
  captainBeeEmail: string;
  honeyBeeEmail: string;
  commissionPercentage: number; //15% or 20% or 25% or 30% or 35% or 40% or 45%
  finalCommissionAmountInUSD: Number; // orderAmount * commissionPercentage / 2(50 % of commission percentage in USD)
  finalCommissionAmountInINEX: Number; // orderAmount * commissionPercentage /2 (50 % of commission percentage in INEX)
  orderAmount: number;
  orderInCurrency: string;
  orderOutCurrency: string;
  orderType: string;
  rank: string;
  name: string;
  beeType? : string
}
