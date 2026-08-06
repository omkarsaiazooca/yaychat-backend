// services/dailyAdEvent.service.ts
import { v4 as uuidv4 } from "uuid";
import { DailyAdEvent } from "../data/dailyAds";
import dailyAdEventSchema, { DailyAdEventModel } from "../models/dailyAdEvent";
import { ServiceBase } from "./base";
import { ymdInSystemTz } from "../helpers/dayHelper";

export class DailyAdEventService extends ServiceBase<DailyAdEvent, DailyAdEventModel> {
    constructor() {
        super(dailyAdEventSchema, "DailyAdEvent");
    }

    /**
     * Create a deduped analytics event (unique on email+date+watchId).
     */
    async createEvent(args: {
        email: string;
        adId: string;
        watchId: string;
        secondsWatched?: number;
        when?: Date;
    }) {
        const when = args.when ?? new Date();
        const date = ymdInSystemTz(when);

        const doc: DailyAdEvent = {
            eventId: uuidv4(),
            email: String(args.email).toLowerCase(),
            adId: String(args.adId),
            watchId: String(args.watchId),
            secondsWatched: Number(args.secondsWatched ?? 0),
            watchedAt: when,
            date,
        } as DailyAdEvent;

        // insert with uniqueness guard; ignore dup error
        try {
            await this.create(doc);
        } catch (e: any) {
            // E11000 duplicate key error -> ignore
            if (e && String(e.code) === "11000") return { duplicate: true };
            throw e;
        }
        return { ok: true };
    }

    /**
     * Query events by user and optional date range (paginated).
     */
    async listEventsByEmail(
        email: string,
        opts: { from?: string; to?: string; page?: number; limit?: number } = {}
    ) {
        const page = Math.max(Number(opts.page ?? 1), 1);
        const limit = Math.min(Math.max(Number(opts.limit ?? 50), 1), 200);
        const skip = (page - 1) * limit;

        const q: any = { email: String(email).toLowerCase() };
        if (opts.from || opts.to) {
            q.date = {};
            if (opts.from) q.date.$gte = String(opts.from);
            if (opts.to) q.date.$lte = String(opts.to);
        }

        const [rows, total] = await Promise.all([
            this.findPaginatedSkip(limit, skip, { watchedAt: -1 }, q, null),
            this.findCount(q),
        ]);

        return { page, limit, total, data: rows };
    }
}
