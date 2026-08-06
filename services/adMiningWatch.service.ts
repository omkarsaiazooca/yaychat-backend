import { AdMiningWatch } from "../data/adMiningWatch";
import adMiningWatchSchema, { AdMiningWatchModel } from "../models/adMiningWatch";
import { ServiceBase } from "./base";
import { MiningService } from "./mining.service";
import { UserService } from "./user.service";
import { LinkedAccountService } from "./linkedAccount.service";
import { LinkedAccountBonusLogService } from "./linkedAccountBonusLog.service";
import { creditLinkedAccountBonus } from "../helpers/linkedAccountBonus";
import { MiningStreakService } from "./miningStreak.service";
import { adRevenueCreditingService } from "./adRevenueCrediting.service";
const miningService = new MiningService();
const userService = new UserService();
const linkedAccountService = new LinkedAccountService();
const linkedAccountBonusLogService = new LinkedAccountBonusLogService();
const miningStreakService = new MiningStreakService();
const HOUR_MS = 60 * 60 * 1000;

export class AdMiningWatchService extends ServiceBase<AdMiningWatch, AdMiningWatchModel> {
    constructor() {
        super(adMiningWatchSchema, "AdMiningWatch");
    }

    async ratePerHour(m: any) {
        if (m.miningRate != null) return m.miningRate;
        return 1.5;
    }


    async record(
        email: string,
        payload: { txId?: string; sessionId?: string; adType?: string; placement?: string; meta?: any }
    ) {
        const doc: any = {
            email: String(email).toLowerCase(),
            timestamp: new Date(),
            adType: payload.adType ?? "rewarded",
            placement: payload.placement ?? "mining_block",
            meta: payload.meta ?? {},
        };
        // Only set identifiers when provided so sparse unique index behaves correctly.
        if (payload.txId) doc.txId = payload.txId;
        if (payload.sessionId) doc.sessionId = payload.sessionId;
        const created = await this.create(doc);

        // Credit the station owner's ad revenue balance — fire and forget, never blocks the response
        adRevenueCreditingService.creditAdWatch(doc.email, doc.adType).catch((err) => {
            console.error("[AdRevenueCrediting] failed (ignored):", err);
        });

        if (process.env.ENABLE_AD_TRIGGERED_STOP === "1") {
            try {
                const coinSymbol = process.env.AD_TRIGGER_COIN ?? "BTCY";

                const m = await miningService.findOne({
                    email: doc.email,
                    coinSymbol,
                    isMiningActive: true,
                });

                if (!m) {
                    console.log(`[AD-TRIGGER] no active mining found for ${doc.email}`);
                    return created;
                }

                if (m?.lastClaimTime) {
                    const lastClaim = new Date(m.lastClaimTime);
                    const now = new Date();
                    const elapsedMs = now.getTime() - lastClaim.getTime();
                    const elapsedHours = Math.max(0, elapsedMs / HOUR_MS);

                    console.log(
                        `[AD-TRIGGER] check ${doc.email}, elapsed=${elapsedHours.toFixed(2)}h since last claim`
                    );

                    if (elapsedMs >= 6 * HOUR_MS) {
                        const rewards = await this.ratePerHour(m);
                        const finalRewards = rewards * elapsedHours;
                        const stopAt = now;

                        const op = await miningService.stopAndCreditAtomic(
                            doc.email,
                            coinSymbol,
                            finalRewards,
                            lastClaim,
                            stopAt
                        );

                        const didApply =
                            !!op && (op.modifiedCount > 0 || (op as any).nModified > 0);

                        if (didApply) {
                            await miningService.updateUserBalanceWhenMiningStopped(
                                doc.email,
                                coinSymbol,
                                finalRewards,
                                true
                            );
                            await creditLinkedAccountBonus({
                                miningService,
                                linkedAccountService,
                                linkedAccountBonusLogService,
                                userService,
                                secondaryEmail: doc.email,
                                coinSymbol: String(coinSymbol || "").toUpperCase(),
                                secondaryRewards: finalRewards,
                                source: "ad_stop",
                                earnedAt: stopAt,
                            });
                            miningStreakService.recordCompletedSession(doc.email, stopAt, elapsedHours).catch((err) => {
                                console.error("[MiningStreak] recordCompletedSession failed (ad_stop):", err);
                            });
                            console.log(
                                `[AD-TRIGGER] STOPPED ${doc.email} ${coinSymbol}, credited=${finalRewards}, hours=${elapsedHours.toFixed(
                                    2
                                )}`
                            );
                        } else {
                            console.log(
                                `[AD-TRIGGER] stopAndCreditAtomic no-op for ${doc.email} ${coinSymbol}`
                            );
                        }
                    } else {
                        console.log(
                            `[AD-TRIGGER] SKIP ${doc.email}, only ${elapsedHours.toFixed(
                                2
                            )}h (<6h)`
                        );
                    }
                }
            } catch (e) {
                console.error("[AD-TRIGGER] stop attempt failed (ignored):", e);
            }
        } else {
            console.log("[AD-TRIGGER] disabled via env");
        }

        return created;
    }


    // count ads between from (inclusive) and to (inclusive)
    async getAdCount(email: string, from: Date, to: Date, type: string = ""): Promise<number> {
        const normalizedType = String(type || "").trim();
        const cond = {
            email: String(email).toLowerCase(),
            timestamp: { $gte: from, $lte: to },
            ...(normalizedType ? { adType: normalizedType } : {}),
        };
        return await this.findCount(cond);
    }

    // optional helper: get ad records for a cycle
    async getAds(email: string, from: Date, to: Date) {
        const match = {
            $match: {
                email: String(email).toLowerCase(),
                timestamp: { $gte: from, $lt: to },
            },
        };
        const sort = { $sort: { timestamp: 1 } };
        const pipeline = [match, sort];
        return await this.findAggregate(pipeline);
    }

    /**
    * Return distinct emails that recorded *any* ad between [from, to].
    * Paginated via $skip/$limit to avoid loading everything at once.
    *
    * NOTE: requires your ads collection name/model; replace `this.model`
    * with whatever you use internally (e.g. this.repo, this.collection, etc).
    */
    async getEmailsWithAdsBetween(from: Date, to: Date, page = 0, pageSize = 1000): Promise<string[]> {
        const pipeline = [
            { $match: { timestamp: { $gte: from, $lte: to } } },
            { $group: { _id: { $toLower: "$email" } } },
            { $sort: { _id: 1 } },
            { $skip: page * pageSize },
            { $limit: pageSize },
            { $project: { _id: 0, email: "$_id" } },
        ];
        const rows = await this.findAggregate(pipeline);
        return rows.map((r: any) => r.email);
    }

}


