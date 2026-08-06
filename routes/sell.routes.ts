import { Router } from "express";
import { SellBtcyController } from "../controllers/sellApi";
import { validateAuthHeader } from "../helpers/middleware";

const sellBtcyRouter: Router = Router();
const controller = new SellBtcyController();

sellBtcyRouter.get("/config", controller.getConfig);
sellBtcyRouter.get("/eligibility", controller.getEligibility);
sellBtcyRouter.get("/eligibility/:email", controller.getEligibility);

sellBtcyRouter.get("/emmm/eligibility", controller.getEmmmEligibility);
sellBtcyRouter.get("/emmm/eligibility/:email", controller.getEmmmEligibility);

// Nugget routes must come BEFORE /emmm/:token/eligibility — otherwise Express matches
// /emmm/nuggets/eligibility as token="nuggets" and routes it to getEmmmEligibility
sellBtcyRouter.get("/emmm/nuggets/eligibility", controller.getNuggetEligibility);
sellBtcyRouter.get("/emmm/nuggets/eligibility/:email", controller.getNuggetEligibility);
sellBtcyRouter.post("/emmm/nuggets/debit", controller.debitNuggets);

sellBtcyRouter.get("/emmm/:token/eligibility", controller.getEmmmEligibility);
sellBtcyRouter.get("/emmm/:token/eligibility/:email", controller.getEmmmEligibility);
sellBtcyRouter.post("/emmm/debit", controller.debitEmmmToken);
sellBtcyRouter.post("/emmm/credit", controller.creditEmmmToken);

sellBtcyRouter.post("/createSellOrder", controller.createSellOrder);

sellBtcyRouter.get("/status/:orderId", controller.getOrderStatus);

sellBtcyRouter.post("/cancel", controller.cancelOrder);

sellBtcyRouter.post("/approve", validateAuthHeader, controller.approveOrder);

sellBtcyRouter.post("/complete", validateAuthHeader, controller.completeOrder);

export const sellRoute = sellBtcyRouter;
