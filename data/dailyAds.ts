import { IDocumentModel, IModel } from './base';

export interface DailyAdDay extends IModel, IDocumentModel<DailyAdDay> {
    email: string;         // user identity (normalized lowercase)
    date: string;          // YYYY-MM-DD
    count: number;         // how many counted watches today
    wIds: string[];        // unique watchIds recorded today (idempotency)
    completed: boolean;
    lastWatchedAt?: Date | null;
    lastAdId?: string;
    createdAt?: Date;
    updatedAt?: Date;
    notifiedDailyAds: boolean; // if user has been notified about daily ads for the day
    notifiedDailyAdsAt?: Date; // when user was notified about daily ads for the day
    rewardVersion?: string;
    awardedMniutes?: number; // how many minutes were awarded for the completion
}

export interface DailyAdEvent extends IModel, IDocumentModel<DailyAdEvent> {
    eventId: string;       // uuid
    email: string;
    adId: string;
    watchId: string;       // unique per completed view (client-generated)
    secondsWatched?: number;
    watchedAt: Date;
    date: string;          // denormalized for easier range queries
}

export interface DailyAdStreak extends IModel, IDocumentModel<DailyAdStreak> {
    email: string;
    currentDay: number;           // 0..7 (0 = none yet)
    lastCompletedDate?: string | null;
}