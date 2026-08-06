export interface DiscountCode {
  code: string;
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
  discountPercentage: number;
  isActive: boolean;
}
