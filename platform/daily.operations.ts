import { ymdInSystemTz } from "../helpers/dayHelper";
import { DailyMiningStatsService } from "../services/dailyMiningStats.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
const dailyStatsService: DailyMiningStatsService = new DailyMiningStatsService();

export class DailyOperations extends BaseAPIOperations {
    constructor(req: Request, res: Response) {
        super(req, res);
    }

    async getBTCYNewUsersToday(req: any, res: any) {
        try {
            const day = ymdInSystemTz();
            const coinSymbol = "BTCY";

            const doc = await dailyStatsService.findOne({ day, coinSymbol });

            return {
                status: 200,
                data: {
                    day,
                    newUsersCount: doc?.newUsersCount ?? 0,
                    totalMined: doc?.totalMined ?? 0,
                    dailyUserCount: doc?.distinctSignupEmails?.length ?? 0,
                },
            };
        } catch (err) {
            console.error("getBTCYNewUsersToday error:", err);
            return { status: 500, message: "Error fetching today's stats" };
        }
    }

    async getBTCYNewUsersRange(req: any, res: any) {
        try {
            const startStr = req.query.start as string;
            const endStr = req.query.end as string;

            if (!startStr || !endStr) {
                return res.status(400).json({ status: 400, message: "start and end are required as YYYY-MM-DD (end exclusive)" });
            }
            const ymd = /^\d{4}-\d{2}-\d{2}$/;
            if (!ymd.test(startStr) || !ymd.test(endStr)) {
                return res.status(400).json({ status: 400, message: "Invalid date format. Use YYYY-MM-DD." });
            }

            const coinSymbol = "BTCY";

            // Fetch all stored daily docs in range from stats collection
            const stats = await dailyStatsService.find({
                coinSymbol,
                day: { $gte: startStr, $lt: endStr },
            });

            // Map for quick lookup
            const map = new Map<string, { newUsersCount: number; totalMined: number; dailyUserCount: number }>();
            for (const s of stats as any[]) {
                map.set(s.day, {
                    newUsersCount: s.newUsersCount ?? 0,
                    totalMined: s.totalMined ?? 0,
                    dailyUserCount: Array.isArray(s.distinctEmails) ? s.distinctEmails.length : 0,
                });
            }

            // Fill missing days with zeros
            const out: Array<{ day: string; newUsersCount: number; totalMined: number; dailyUserCount: number }> = [];
            const start = new Date(`${startStr}T00:00:00Z`);
            const end = new Date(`${endStr}T00:00:00Z`);

            for (let d = new Date(start.getTime()); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
                const day = d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC; matches how we store "day"
                const v = map.get(day);
                out.push({
                    day,
                    newUsersCount: v?.newUsersCount ?? 0,
                    totalMined: v?.totalMined ?? 0,
                    dailyUserCount: v?.dailyUserCount ?? 0,
                });
            }

            return { status: 200, data: out };
        } catch (err) {
            console.error("getBTCYNewUsersRange error:", err);
            return { status: 500, message: "Error fetching range stats" };
        }
    }
}