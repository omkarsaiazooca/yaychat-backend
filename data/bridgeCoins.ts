export interface BridgeCoins {
    txId: string;
    status: string;
    actionsAvailable: boolean;
    fromCurrency: string;
    fromNetwork: string;
    toCurrency: string;
    toNetwork: string;
    expectedAmountFrom: number;
    expectedAmountTo: number;
    amountFrom: number;
    amountTo: number;
    payinAddress: string;
    payoutAddress: string;
    payinExtraId: any;
    payoutExtraId: any;
    refundAddress: any;
    refundExtraId: any;
    createdAt: string;
    updatedAt: string;
    validUntil: any;
    depositReceivedAt: string;
    payinHash: string;
    payoutHash: string;
    fromLegacyTicker: string;
    toLegacyTicker: string;
    refundHash: any;
    refundAmount: any;
    email: string;
  }
  