// controllers/adMiningWatchAPI.ts

import { AdMiningWatchOperations } from "../platform/adMiningWatch.operations";


export class AdMiningWatchController {
    constructor() { }

    async recordAd(req: any, res: any) {
        try {
            // ops handles validation and returns {status, data}
            const ops = new AdMiningWatchOperations(req, res);
            const result = await ops.recordAd(req, res);
            return res.status(result.status).send(result);
        } catch (err) {
            console.error("AdMiningWatchController.recordAd error:", err);
            return res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
        }
    }

    async getAdCountForUser(req: any, res: any) {
        try {
            const ops = new AdMiningWatchOperations(req, res);
            const result = await ops.getAdCount(req, res);
            return res.status(result.status).send(result);
        } catch (err) {
            console.error("AdMiningWatchController.getAdCountForUser error:", err);
            return res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
        }
    }

    async getAdsForUser(req: any, res: any) {
        try {
            const ops = new AdMiningWatchOperations(req, res);
            const result = await ops.getAds(req, res);
            return res.status(result.status).send(result);
        } catch (err) {
            console.error("AdMiningWatchController.getAdsForUser error:", err);
            return res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
        }
    }
}
