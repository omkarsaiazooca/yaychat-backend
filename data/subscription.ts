export interface Subscription {
    email: string;
    plan: string; // Free, Silver, Gold, Platinum, Diamond
    speedBoost: number; // 1x, 2x, 3x, 5x
    cost: number; // 0, 50, 100, 250
    paymentMethod: string; // Paypal, Tygapay, WireTransfer, ACH, CreditCard, Zelle
    startDate: Date;
    endDate: Date;
    status: string; // Active, Expired, Cancelled
    miningRate: number; // 0.01, 0.02, 0.03, 0.05
    coinSymbol: string
    referralBonusUsed: number; // 0, 1, 2, 3
    userType?: string;
    totalBTCYBalance?: number;
    bonusNote?: string;
    lastBonusAppliedAt?: Date;
    referralNote?: string;
    referredByEmail?: string;
    anniversaryPromoSource?: string;
    anniversaryPromoAppliedAt?: Date;
    anniversaryPromoStartAt?: Date;
    anniversaryPromoEndAt?: Date;
    anniversaryPromoPreviousPlan?: string;
    anniversaryPromoPreviousSpeedBoost?: number;
    anniversaryPromoPreviousMiningRate?: number;
    anniversaryPromoPreviousCost?: number;
    anniversaryPromoPreviousPaymentMethod?: string;
    anniversaryPromoPreviousStartDate?: Date;
    anniversaryPromoPreviousEndDate?: Date;
    anniversaryPromoPreviousIsPendingPurchase?: boolean;
    anniversaryPromoRestoredAt?: Date;
}
