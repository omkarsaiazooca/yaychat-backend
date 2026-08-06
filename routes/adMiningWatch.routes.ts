// routes/adMiningWatch.routes.ts
import { Router } from "express";
import { AdMiningWatchController } from "../controllers/adMiningWatchAPI";
import { validateAuthHeader } from "../helpers/middleware";

const router: Router = Router();

const ctrl = new AdMiningWatchController();


router.post("/complete", (req: any, res: any) => ctrl.recordAd(req, res));


router.get("/count/:email", validateAuthHeader, (req: any, res: any) =>
  ctrl.getAdCountForUser(req, res)
);


router.get("/list/:email", validateAuthHeader, (req: any, res: any) =>
  ctrl.getAdsForUser(req, res)
);

export default router;

export const adMiningWatchRoutes = router;