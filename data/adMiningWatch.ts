export interface AdMiningWatch {
    _id?: any;
    email: string;
    timestamp: Date;
    adType: string;        // "rewarded" | "interstitial" | ...
    placement: string;     // e.g., "mining_block"
    sessionId?: string | null;
    txId?: string | null;
    meta?: Record<string, any>;
}
