import { Router } from "express";
import { OrderController } from "../controllers/orderAPI";
import { auditLogMiddleware } from "../services/adminAuditLog.servcie";

const orderRouter: Router = Router();
const orderController: OrderController = new OrderController();

orderRouter.post("/createOrder", orderController.createOrder);
orderRouter.post("/createDepositOrder", orderController.createDepositOrder);
orderRouter.post(
  "/createOrderForQuantum",
  orderController.createOrderForQuantum
);
orderRouter.get(
  "/quantum/status/:orderId",
  orderController.getQuantumOrderStatus
);
orderRouter.post(
  "/quantum/crypto/check-payment",
  orderController.checkQuantumCryptoPayment
);
orderRouter.post(
  "/quantum/crypto/check-payment-by-tx",
  orderController.checkQuantumCryptoPaymentByTxHash
);
orderRouter.post("/quantum/cancel", orderController.cancelQuantumCryptoOrder);
orderRouter.post(
  "/quantum/wire-transfer/confirmation",
  orderController.updateQuantumWireTransferConfirmation
);
orderRouter.post(
  "/already-paid/:orderId",
  orderController.alreadyPaidForQuantum
);
orderRouter.post("/orders/claim", orderController.claimWithoutOrderId);
orderRouter.post(
  "/createOrderForSmartCrypto",
  orderController.createOrderForSmartCrypto
);
orderRouter.post(
  "/createOrderForSmartCryptoFreeTrailUpdation",
  orderController.createOrderForSmartCryptoFreeTrailUpdation
);
orderRouter.post(
  "/createOrderForSmartAPY",
  orderController.createOrderForSmartAPY
);
orderRouter.post("/createOrderForGift", orderController.createOrderForGift);
orderRouter.post(
  "/createOrderForAcademy",
  orderController.createOrderForAcademy
);
orderRouter.post("/createPowerPackOrder", orderController.powerPackCreateOrder);
orderRouter.post("/createFreeTrailOrder", orderController.createFreeTrailOrder);
orderRouter.post(
  "/createMiningSubscriptionOrder",
  orderController.createMiningSubscriptionOrder
);
orderRouter.post(
  "/createMonthlyINEXOrder",
  orderController.monthlyINEXCreateOrder
);
orderRouter.post(
  "/createMonthlyINEXsubscription",
  orderController.monthlyINEXCreateSubscription
);
orderRouter.post(
  "/createMonthlyINEXsubscriptionnonpaypal",
  orderController.CreateMonthlyINEXSubscriptionOrder
);
orderRouter.post(
  "/cancelMonthlyINEXsubscription",
  orderController.monthlyINEXCancelSubscription
);
orderRouter.post(
  "/createMonthlyHoneyBeeINEXsubscription",
  orderController.monthlyHoneyBeeINEXCreateSubscription
);
orderRouter.post("/buy", orderController.buyCrypto);
orderRouter.post("/buyetf", orderController.buyETF);
orderRouter.post("/updateOrder", orderController.updateOrder);
orderRouter.post(
  "/updateOrderForFiatDeposit",
  auditLogMiddleware,
  orderController.updateOrderForFiatDeposit
);
orderRouter.post("/paypalWebhook", orderController.paypalWebhookupdateOrder);
orderRouter.post("/stripeWebhook", orderController.stripeWebhookupdateOrder);
orderRouter.post(
  "/appleNotificationHandler",
  orderController.handleAppStoreNotifications
);
orderRouter.post("/googlePlayRtdn", orderController.handleGooglePlayRtdn);
orderRouter.post("/buy", orderController.getBuyCryptoPrices);
orderRouter.post("/sell", orderController.sellCrypto);
orderRouter.post("/selletf", orderController.sellETF);
orderRouter.post("/convert", orderController.convertCrypto);
orderRouter.post("/processCovert", orderController.processConvertOrder);
orderRouter.get("/allOrders", orderController.getAllOrders);
orderRouter.get("/sellOrders", orderController.getSellOrder);
orderRouter.get(
  "/btcy/buy/completed",
  orderController.getCompletedBtcyBuyOrders
);
orderRouter.get(
  "/btcy/orders/:email",
  orderController.getUserBtcyBuySellOrders
);
orderRouter.get("/btcy/buy/emails", orderController.getBtcyBuyHistoryEmails);
orderRouter.get("/OrderCount", orderController.getOrdersCount);
orderRouter.get("/DiffOrderCount", orderController.getDiffOrderCount);
orderRouter.get(
  "/validateDiscountCode/:discountCode/:packName",
  orderController.validateDiscountCode
);
orderRouter.post("/switchsmartcryptoPlan", orderController.switchCryptoPlan);
orderRouter.post("/sellSmartCrypoPlan", orderController.sellSmartCryptoPlan);

export const orderRoutes = orderRouter;
