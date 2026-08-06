import { Router } from "express";

import { MiningStationController } from "../controllers/miningStationAPI";
import { validateAuthHeader } from "../helpers/middleware";

const miningStationRouter: Router = Router();
const miningStationController: MiningStationController = new MiningStationController();

miningStationRouter.get("/overview", validateAuthHeader, (req, res) =>
  miningStationController.getOverview(req, res)
);
miningStationRouter.get("/miners", validateAuthHeader, (req, res) =>
  miningStationController.getMiners(req, res)
);
miningStationRouter.get("/analytics", validateAuthHeader, (req, res) =>
  miningStationController.getAnalytics(req, res)
);
miningStationRouter.get("/referrals", validateAuthHeader, (req, res) =>
  miningStationController.getReferrals(req, res)
);
miningStationRouter.get("/earnings", validateAuthHeader, (req, res) =>
  miningStationController.getEarnings(req, res)
);
miningStationRouter.get("/withdrawals", validateAuthHeader, (req, res) =>
  miningStationController.getWithdrawals(req, res)
);
miningStationRouter.post("/withdrawals", validateAuthHeader, (req, res) =>
  miningStationController.submitWithdrawal(req, res)
);

export const miningStationRoute = miningStationRouter;
