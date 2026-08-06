import { Schema } from 'mongoose';
import { DailyAdDay, DailyAdEvent } from '../data/dailyAds';
import { IDocumentModel } from '../data/base';

export interface DailyAdDayModel extends IDocumentModel<DailyAdDay>, DailyAdDay {
}

const DailyAdDaySchema = new Schema<DailyAdDayModel>({
    email: { type: String, index: true },
    date: { type: String, index: true }, // YYYY-MM-DD
    count: { type: Number, default: 0 },
    wIds: { type: [String], default: [] }, // watchIds captured to ensure idempotency
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date },
    lastAdId: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    notifiedDailyAds: { type: Boolean, default: false }, // if user has been notified about daily ads for the day
    notifiedDailyAdsAt: { type: Date }, // when user was notified about daily ads for the day
    rewardVersion: { type: String },
    awardedMniutes: { type: Number } // how many minutes were awarded for the completion
}, { versionKey: false });

// Fast find by user+day
DailyAdDaySchema.index({ email: 1, date: 1, wIds: 1 }, { unique: true, sparse: true });

export default DailyAdDaySchema;
