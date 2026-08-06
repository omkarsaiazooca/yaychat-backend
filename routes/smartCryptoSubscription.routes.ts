import { Router } from "express";
import {
  createSmartCryptoSubscription,
  handleSmartCryptoPaypalWebhook,
  getSmartCryptoSubscription,
  getSmartCryptoSubscriptionPlans,
  confirmSmartCryptoManualPayment,
} from "../controllers/smartCryptoSubscription";
import { validateAuthHeader } from "../helpers/middleware";

const router = Router();

router.get("/subscription-plans", getSmartCryptoSubscriptionPlans);
router.get("/subscription", validateAuthHeader, getSmartCryptoSubscription);
router.post("/subscription", validateAuthHeader, createSmartCryptoSubscription);
router.post(
  "/subscription/manual-confirm",
  validateAuthHeader,
  confirmSmartCryptoManualPayment
);
router.post("/webhooks/paypal", handleSmartCryptoPaypalWebhook);

export const smartCryptoSubscriptionRoute = router;
