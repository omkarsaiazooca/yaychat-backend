import { IDocumentModel, IModel } from "./base";

export interface AlchemySession extends IModel, IDocumentModel<AlchemySession> {
    sessionId: string; // Optional, can be used for tracking
    email: string;
    coinName: string;         // Reference to the user
    userType: string;             // 'free' | 'electric' | 'turbo' | 'nuclear' | 'quantum'
    inputAmount: number;          // Amount of BTCY committed
    multiplier: number;           // Final multiplier applied
    resultAmount: number;         // Final BTCY after applying multiplier
    category: string;             // Redundant but useful: 'free', 'electric', etc.
    inputUnit?: string;           // e.g. BTCY, nugget
    version?: string;             // api version that created the session
    status: string;               // 'pending' | 'completed' | 'failed'
    startedAt: Date;              // When the user started alchemy
    completedAt?: Date;           // When result was calculated
    durationMinutes?: number;     // Optional: how long it took (e.g., 60 min)
    notes?: string;               // Optional admin/system notes
    isJackpot?: boolean;          // Flag if the result hit a rare jackpot
    streakCount?: number;         // Optional: how many daily streaks user has
    referralCodeUsed?: string;    // Optional: referral code used in this session
    withdrawalType?: string;
    withdrawalAddress?: string;
    targetNetwork?: string;
    externalClaimFinalizedAt?: Date;
    poolId?: string;
}
