export interface Mining {
    email: string;
    startTime?: Date;
    lastClaimTime?: Date;
    totalMined: number;
    miningPlan: string;
    isMiningActive: boolean;
    miningRate: number;
    coinSymbol: string;
    totalMinedBTCY?: number;
    newUsersCount?: number;
    day? : Date
    planSyncedAt?: Date;
    adsExtendedEndAt?: Date | null;
    last24HourRunAt?: Date | null;
    sessionDurationHours?: number | null;
}
