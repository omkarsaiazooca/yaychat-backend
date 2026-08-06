export interface GiftCard {
  voucher: string;
  pin: number;
  amount: number;
  dateOfGeneration: Date;
  isUsed: boolean;
  assignedToUser?: string;
  redeemedOn?: Date;
  redeemedBy?: string;
  type: string,
  subType?: string,
  baseCurrency: string
  usdAmount?: number
}
