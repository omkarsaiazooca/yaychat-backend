import { Router } from "express";
import express from "express";
import { BitcoinyaySubscriptionController } from "../controllers/bitcoinyaySubscription.controller";

const router = Router();
const controller = new BitcoinyaySubscriptionController();

const emptyBuyResponse = (res: any) => res.status(200).json({ data: false, status: 200 });

router.post("/purchase", (req, res) =>
  controller.purchaseSubscription(req, res)
);
router.post("/purchase-test", (req, res) =>
  controller.purchaseTestSubscription(req, res)
);
router.post("/coupons/validate", (req, res) =>
  controller.validateCoupon(req, res)
);
router.get("/", (req, res) => controller.getHistory(req, res));
router.get("/plans", (req, res) => controller.getPlanCatalog(req, res));
router.post("/changeplan", (req, res) => controller.changePlan(req, res));

// CRITICAL: Use express.raw() for Stripe webhooks
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => controller.handleStripeWebhook(req, res)
);
router.post(
  "/webhooks/stripe/main",
  express.raw({ type: "application/json" }),
  (req, res) => controller.handleStripeWebhookMain(req, res)
);

router.post("/webhooks/paypal", (req, res) =>
  controller.handlePaypalWebhook(req, res)
);
router.post("/webhooks/paypal/main", (req, res) =>
  controller.handlePaypalWebhookMain(req, res)
);
router.get("/home-buy", (_, res) => emptyBuyResponse(res));
router.get("/main-buy", (_, res) => emptyBuyResponse(res));
router.get("/main-sell", (_, res) => emptyBuyResponse(res));
router.get("/order-history", (_, res) => emptyBuyResponse(res));

router.post("/test/force-success", async (req, res) => {
  try {
    await controller.forceActivateSubscription(req.body.recordId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const bitcoinyaySubscriptionRoute = router;
