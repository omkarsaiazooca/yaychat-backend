import { Router } from "express";
import { YaysWalletController } from "../controllers/yaysWalletAPI";
import { validateAuthHeader } from "../helpers/middleware";

const yaysWalletRouter: Router = Router();
const controller = new YaysWalletController();

// Public: reward rules, and resolving an invite code carried by a deep link
// before the recipient has an account.
yaysWalletRouter.get("/config", controller.getConfig);
yaysWalletRouter.get("/referrals/code/:code", controller.lookupReferralCode);

// Wallet — IndexxPoints plus read-only Indexx balances.
yaysWalletRouter.get("/assets", validateAuthHeader, controller.getAssets);
yaysWalletRouter.get("/transactions", validateAuthHeader, controller.getTransactions);
yaysWalletRouter.get(
  "/transactions/:transactionId",
  validateAuthHeader,
  controller.getTransaction
);

// Earn — summary, live activity progress, check-in, and claims.
yaysWalletRouter.get("/earn/summary", validateAuthHeader, controller.getEarnSummary);
yaysWalletRouter.get("/earn/activities", validateAuthHeader, controller.getActivities);
yaysWalletRouter.post("/earn/check-in", validateAuthHeader, controller.checkIn);
yaysWalletRouter.post(
  "/earn/activities/:activityId/claim",
  validateAuthHeader,
  controller.claimActivity
);
yaysWalletRouter.get("/earn/rewards", validateAuthHeader, controller.getRewardHistory);
yaysWalletRouter.get("/earn/rewards/:rewardId", validateAuthHeader, controller.getReward);

// Referrals.
yaysWalletRouter.get("/referrals", validateAuthHeader, controller.getReferralSummary);
yaysWalletRouter.post("/referrals/redeem", validateAuthHeader, controller.redeemReferral);

export { yaysWalletRouter };
