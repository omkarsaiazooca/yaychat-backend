// platform/adMiningWatch.operations.ts
import { AdMiningWatchService } from "../services/adMiningWatch.service";
import { MiningService } from "../services/mining.service";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
import { scheduleMiningStop } from "../helpers/miningStopScheduler";
import { isMiningAdTestEmail } from "../helpers/miningAdTestEmails";

const userService = new UserService();
const adMiningWatchService = new AdMiningWatchService();
const miningService = new MiningService();
const AD_WINDOW_BUFFER_MS = 600000; // 10 minutes buffer to account for ad watch time and processing delays
const AD_EXTEND_THRESHOLD = 7;
const SIX_HOURS_AD_THRESHOLD = 2;
const HOUR_MS = 60 * 60 * 1000;
// Keep test-email helper for controlled rollouts, but default to global behavior as requested.
const APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS = true;
export class AdMiningWatchOperations extends BaseAPIOperations {
    constructor(req: Request, res: Response) {
        super(req, res);
    }


    /**
     * Record ad watch.
     * Expects req.user.email (validateAuthHeader should set this).
     * Body: { txId?, sessionId?, adType?, placement?, meta? }
     */
    async recordAd(req: any, res: any) {
        try {
            const email = req.body?.email?.toLowerCase();
            console.log("recordAd called with email:", email, "body:", req.body);
            if (!email) return { status: 401, data: "Not authenticated" };

            const { txId, sessionId, adType, placement, meta } = req.body ?? {};
            console.log("Ad details - txId:", txId, "sessionId:", sessionId, "adType:", adType, "placement:", placement, "meta:", meta);

            const doc = await adMiningWatchService.record(email, { txId, sessionId, adType, placement, meta });

            let sessionHours: number | null = null;
            let sessionEndTime: Date | null = null;
            let timeRemainingMs: number | null = null;
            let adCount: number | null = null;

            const coinSymbol = String(req.body?.coinSymbol || "BTCY").trim() || "BTCY";
            const mining = await miningService.findOne({
                email,
                coinSymbol,
                isMiningActive: true,
            });

            if (
                mining?.lastClaimTime &&
                (APPLY_AD_CYCLE_LOGIC_TO_ALL_EMAILS || isMiningAdTestEmail(email))
            ) {
                console.log("I am here inside test email block for ad recording, email:", email);
                const cycleStart = new Date(mining.lastClaimTime);
                const windowStart = new Date(cycleStart.getTime() - AD_WINDOW_BUFFER_MS);
                console.log("windowStart:", windowStart.toISOString(), "cycleStart:", cycleStart.toISOString());
                adCount = await adMiningWatchService.getAdCount(email, windowStart, new Date(), "rewarded");

                sessionHours =
                    adCount >= AD_EXTEND_THRESHOLD
                        ? 24
                        : (adCount >= SIX_HOURS_AD_THRESHOLD ? 6 : 24);

                sessionEndTime = new Date(cycleStart.getTime() + sessionHours * HOUR_MS);
                timeRemainingMs = Math.max(0, sessionEndTime.getTime() - Date.now());

                if (adCount >= SIX_HOURS_AD_THRESHOLD && adCount < AD_EXTEND_THRESHOLD) {
                    await scheduleMiningStop(email, coinSymbol, cycleStart.toISOString());
                }

                if (adCount >= AD_EXTEND_THRESHOLD && sessionEndTime) {
                    try {
                        await miningService.updatePart(
                            { email, coinSymbol, isMiningActive: true },
                            {
                                $set: {
                                    adsExtendedEndAt: sessionEndTime,
                                    last24HourRunAt: cycleStart,
                                },
                            }
                        );
                    } catch (e) {
                        console.error("recordAd -> adsExtendedEndAt update failed (ignored):", e);
                    }
                }
            }

            try {
                await userService.updatePart(
                    { email },
                    { $set: { tutorialWatched: true } }
                );
            } catch (e) {
                console.error("recordAd -> tutorialWatched update failed (ignored):", e);
            }

            console.log(`Ad recorded for ${email}. Ad count in window: ${adCount}, session extended to: ${sessionHours} hours, session end time: ${sessionEndTime}, time remaining ms: ${timeRemainingMs}`);
            return {
                status: 201,
                data: {
                    message: "Ad recorded",
                    id: doc._id,
                    adCount,
                    sessionHours,
                    sessionEndTime: sessionEndTime ? sessionEndTime.toISOString() : null,
                    timeRemainingMs,
                }
            };
        } catch (err: any) {
            console.error("AdMiningWatchOperations.recordAd error:", err);
            return { status: 500, data: err.message || String(err) };
        }
    }

    /**
     * Get ad count for a given user and time window.
     * Params: :email
     * Query: ?from=<ISO>&to=<ISO>
     */
    async getAdCount(req: any, res: any) {
        try {
            const { email } = req.params;
            if (!email) return { status: 400, data: "Email is required" };

            // basic auth guard: allow admins or same user
            const caller = req.user?.email?.toLowerCase();
            if (!caller) return { status: 401, data: "Not authenticated" };
            if (caller !== String(email).toLowerCase()) {
                // optionally check admin role; here we allow only same user (you can relax)
                const callingUser = await userService.findOne({ email: caller });
                if (!callingUser || callingUser.role !== "Admin") {
                    return { status: 403, data: "Forbidden" };
                }
            }

            const fromStr = req.query.from as string;
            const toStr = req.query.to as string;
            const from = fromStr ? new Date(fromStr) : new Date(0);
            const to = toStr ? new Date(toStr) : new Date();

            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                return { status: 400, data: "Invalid from/to date" };
            }

            const count = await adMiningWatchService.getAdCount(email, from, to);
            return { status: 200, data: { email, from: from.toISOString(), to: to.toISOString(), count } };
        } catch (err: any) {
            console.error("AdMiningWatchOperations.getAdCount error:", err);
            return { status: 500, data: err.message || String(err) };
        }
    }

    /**
     * Get ad records for user in window.
     * Params: :email
     * Query: ?from=&to=&limit=
     */
    async getAds(req: any, res: any) {
        try {
            const { email } = req.params;
            if (!email) return { status: 400, data: "Email is required" };

            const caller = req.user?.email?.toLowerCase();
            if (!caller) return { status: 401, data: "Not authenticated" };
            if (caller !== String(email).toLowerCase()) {
                const callingUser = await userService.findOne({ email: caller });
                if (!callingUser || callingUser.role !== "Admin") {
                    return { status: 403, data: "Forbidden" };
                }
            }

            const fromStr = req.query.from as string;
            const toStr = req.query.to as string;
            const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 1000);

            const from = fromStr ? new Date(fromStr) : new Date(0);
            const to = toStr ? new Date(toStr) : new Date();

            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                return { status: 400, data: "Invalid from/to date" };
            }

            const ads = await adMiningWatchService.getAds(email, from, to);
            return { status: 200, data: { email, from: from.toISOString(), to: to.toISOString(), count: ads.length, ads: ads.slice(0, limit) } };
        } catch (err: any) {
            console.error("AdMiningWatchOperations.getAds error:", err);
            return { status: 500, data: err.message || String(err) };
        }
    }

  
}
