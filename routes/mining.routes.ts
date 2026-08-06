import { Router } from "express";

import { UserController } from "../controllers/userAPI";
import { MiningController } from "../controllers/miningAPI";
import { validateAuthHeader } from "../helpers/middleware";

const miningRouter: Router = Router();
const userController: UserController = new UserController();
const miningController: MiningController = new MiningController();
miningRouter.post("/startMining", miningController.startMining);
miningRouter.post("/extendMiningCycle", miningController.extendMiningCycle);
miningRouter.post("/stopMining", miningController.stopMining);
miningRouter.post("/claimMiningRewards", miningController.claimMiningRewards);
miningRouter.get("/getMiningStatus/:coinSymbol/:email", miningController.getMiningStatus);
miningRouter.get("/getUserBalance/:coinSymbol/:email", miningController.getUserBalance);
miningRouter.get("/getCurrentMiningRewards/:coinSymbol/:email",miningController.getCurrentMiningRewards);
miningRouter.get("/getMiningWindowTotals/:coinSymbol", miningController.getMiningWindowTotals);
miningRouter.get("/getMiningRewardSummary/:coinSymbol", miningController.getMiningRewardSummary);
miningRouter.get("/getUserMiningBalance/:coinSymbol/:email", userController.getUserMiningReward);
miningRouter.get("/getUserSubscriptionPlan/:coinSymbol/:email", userController.getUserMiningSubscriptionPlan);
miningRouter.get("/getUserMiningPlanWithPaymentMethod/:coinSymbol/:email", userController.getUserMiningPlanWithPaymentMethod);
miningRouter.get("/getAllMiningSubscriptionPlans", userController.getAllMiningSubscriptionPlans);
miningRouter.get("/getAllMiningUsers/:coinSymbol", userController.getAllMiningUsers);
miningRouter.post("/power-mining/plans/sync", validateAuthHeader, miningController.syncPowerPlans);
miningRouter.post("/nuggets/transfer/ad-watch", validateAuthHeader, miningController.logNuggetTransferAdWatch);
miningRouter.get("/nuggets/transfer/ad-status", validateAuthHeader, miningController.getNuggetTransferAdStatus);
miningRouter.post("/nuggets/transfer", validateAuthHeader, miningController.submitNuggetTransfer);
miningRouter.get("/nuggets/transfer/history", validateAuthHeader, miningController.getNuggetTransferHistory);

miningRouter.get("/getMiningDetails/:email", validateAuthHeader, miningController.getMiningDetails);
miningRouter.get("/getMiningHistory/:email", validateAuthHeader, miningController.getMiningHistory);
miningRouter.get("/miningStreak/:email", miningController.getMiningStreak);

export const miningRoute = miningRouter;
