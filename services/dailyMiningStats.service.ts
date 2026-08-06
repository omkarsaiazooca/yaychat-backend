import { DailyMiningStats } from "../data/dailyMiningStats";
import { ymdInSystemTz } from "../helpers/dayHelper";
import dailyMiningStatsSchema, { DailyMiningStatsModel } from "../models/dailyMiningStats";
import { ServiceBase } from "./base";

export class DailyMiningStatsService extends ServiceBase<DailyMiningStats, DailyMiningStatsModel> {
    constructor() {
        super(dailyMiningStatsSchema, "DailyMiningStatsSchema");
    }

    async incrNewUserForToday(coinSymbol: string, email: string) {
        const day = ymdInSystemTz();
        const emailLower = (email || "").toLowerCase();

        await this.upsertOne(
            { day, coinSymbol },
            {
                $inc: { newUsersCount: 1 },                          // counts signups (not necessarily unique)
                $addToSet: { distinctSignupEmails: emailLower },     // track uniqueness separately
                $setOnInsert: { totalMined: 0},
            }
        );
    }
    
    async addDailyCredit(coinSymbol: string, email: string, amount: number, when = new Date()) {
        const day = ymdInSystemTz(when);

        await this.upsertOne(
            { day, coinSymbol },
            {
                $inc: { totalMined: amount },
                // do NOT touch distinctSignupEmails here—keep it signup-only
                $setOnInsert: { newUsersCount: 0, distinctSignupEmails: [] },
            }
        );
    }
}