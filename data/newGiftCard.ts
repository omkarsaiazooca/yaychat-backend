export interface NewGiftCard {
    voucher: string;
    amount: number;
    dateOfGeneration: Date;
    isUsed: boolean;
    assignedToUser?: string;
    redeemedOn?: Date;
    redeemedBy?: string;
    type: string,
    subType?: string,
    cardType?: string,
    baseCurrency?: string
    usdAmount?: number;
    createdBy: string;
    createdOn: Date;
    giftCardImgUrl?: string;
    amountPerCurrency?: number;
    currencies? : string[];
    paymentMethodUsed?: string;
    price?: number;
  }