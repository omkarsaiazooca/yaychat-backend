import { CurrencyOperations } from "../platform/currency.operations";
import { OrderOperations } from "../platform/order.operations";
import { StripeOperations } from "../platform/stripe.operations";
import {
  calculateFeeAmount,
  cancelQuantumCryptoOrder as cancelQuantumCryptoOrderFlow,
  getOurWalletAddress,
  verifyQuantumCryptoPayment,
  verifyQuantumCryptoPaymentByTxHash,
} from "../platform/cryptoPayment.operations";
import { OrderService } from "../services/order.service";
import { OrderStatus, Order } from "../data/order";
import { UserService } from "../services/user.service";
import { BTCYBuyHistoryService } from "../services/btcyBuyHistory.service";
import {
  GooglePlayRtdnEnvelope,
  GooglePlaySyncResult,
  GooglePlaySubscriptionSyncService,
} from "../services/googlePlaySubscriptionSync.service";
import { z } from "zod";
import { SendEmail } from "../platform/email.operations";
import {
  calculateQuantumBtcyOutAmountFromFeeData,
  resolveQuantumBtcyUsdRate,
} from "../helpers/quantumBtcyPricing";
import {
  INDEPENDENCE_WEEK_PROMO_CODE,
  applyIndependenceWeekQuantumBtcyBonus,
} from "../helpers/quantumBtcyBonus";
const alreadyPaidSchema = z.object({
  // CRYPTO
  txHash: z.string().trim().optional(),

  // PAYPAL / CARD
  paypalTxnId: z.string().trim().optional(),
  proofUrl: z.string().url().optional(),

  // optional: if user typed exact amount sent
  amount: z.number().positive().optional(),
});

const quantumCryptoCheckSchema = z.object({
  orderId: z.string().trim().min(1),
  paymentType: z.enum(["USDT", "USDC"]),
  amount: z.coerce.number().positive(),
  addressPaidTo: z.string().trim().min(1),
});

const quantumCryptoTxHashCheckSchema = z.object({
  orderId: z.string().trim().min(1),
  txHash: z.string().trim().min(1),
});

const quantumCancelSchema = z.object({
  orderId: z.string().trim().min(1),
});

const quantumStatusParamsSchema = z.object({
  orderId: z.string().trim().min(1),
});

const userService: UserService = new UserService();
const orderService: OrderService = new OrderService();
const btcyBuyHistoryService: BTCYBuyHistoryService = new BTCYBuyHistoryService();
const googlePlaySubscriptionSyncService = new GooglePlaySubscriptionSyncService();
const GOOGLE_PLAY_RTDN_ALERT_EMAIL =
  process.env.GOOGLE_PLAY_RTDN_ALERT_EMAIL || "omkar@azooca.com";


const applyQuantumBtcyBonus = applyIndependenceWeekQuantumBtcyBonus;

function normalizeQuantumStatus(rawStatus: any) {
  const normalized = String(rawStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!normalized || normalized === "quoted") {
    return {
      status: "created",
      paymentReceived: false,
      message: "Order created",
    } as const;
  }

  if (
    normalized === "pending" ||
    normalized === "paymentsubmitted" ||
    normalized === "receiveddeposit" ||
    normalized === "receivedfiat"
  ) {
    return {
      status: "pending",
      paymentReceived: false,
      message: "Payment pending",
    } as const;
  }

  if (normalized === "paid" || normalized === "completed") {
    return {
      status: "paid",
      paymentReceived: true,
      message: "Payment confirmed",
    } as const;
  }

  if (normalized === "ordercancelled" || normalized === "cancelled") {
    return {
      status: "cancelled",
      paymentReceived: false,
      message: "Order cancelled",
    } as const;
  }

  return {
    status: "failed",
    paymentReceived: false,
    message: "Payment failed",
  } as const;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stringifyForEmail(value: unknown, maxLength = 4000): string {
  try {
    const text = JSON.stringify(value, null, 2) || "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch (error) {
    return String(error);
  }
}

function maskPurchaseToken(token?: string | null): string {
  const value = String(token || "").trim();
  if (!value) return "n/a";
  if (value.length <= 8) return value;
  return `...${value.slice(-8)}`;
}

export class OrderController {
  constructor() {
    this.createOrderForQuantum = this.createOrderForQuantum.bind(this);
    this.createCryptoOrder = this.createCryptoOrder.bind(this);
    this.checkQuantumCryptoPayment = this.checkQuantumCryptoPayment.bind(this);
    this.checkQuantumCryptoPaymentByTxHash =
      this.checkQuantumCryptoPaymentByTxHash.bind(this);
    this.cancelQuantumCryptoOrder = this.cancelQuantumCryptoOrder.bind(this);
    this.getQuantumOrderStatus = this.getQuantumOrderStatus.bind(this);
    this.handleGooglePlayRtdn = this.handleGooglePlayRtdn.bind(this);
  }

  private buildGooglePlayRtdnEmailBody({
    req,
    result,
    errorMessage,
  }: {
    req: any;
    result?: GooglePlaySyncResult;
    errorMessage?: string;
  }) {
    const requestBody = req?.body || {};
    const requestMessage = requestBody?.message || {};
    const messageId = result?.messageId || requestMessage?.messageId || "n/a";
    const packageName = result?.packageName || "n/a";
    const purchaseToken = maskPurchaseToken(result?.purchaseToken);
    const publishTime = requestMessage?.publishTime || "n/a";
    const subscription = requestBody?.subscription || "n/a";
    const requestSummary = {
      subscription,
      messageId: requestMessage?.messageId || null,
      publishTime: requestMessage?.publishTime || null,
      attributes: requestMessage?.attributes || null,
    };

    return `
      <p><strong>Google Play RTDN endpoint was hit.</strong></p>
      <p>
        <strong>Time:</strong> ${escapeHtml(new Date().toISOString())}<br/>
        <strong>Method:</strong> ${escapeHtml(req?.method || "POST")}<br/>
        <strong>Endpoint:</strong> ${escapeHtml(req?.originalUrl || req?.url || "/api/v1/inex/order/googlePlayRtdn")}<br/>
        <strong>Message ID:</strong> ${escapeHtml(messageId)}<br/>
        <strong>Publish Time:</strong> ${escapeHtml(publishTime)}<br/>
        <strong>Pub/Sub Subscription:</strong> ${escapeHtml(subscription)}
      </p>
      <p>
        <strong>Action:</strong> ${escapeHtml(result?.action || "error")}<br/>
        <strong>Google State:</strong> ${escapeHtml(result?.googleState || "n/a")}<br/>
        <strong>Notification Type:</strong> ${escapeHtml(result?.notificationType ?? "n/a")}<br/>
        <strong>Order ID:</strong> ${escapeHtml(result?.orderId || "n/a")}<br/>
        <strong>User Email:</strong> ${escapeHtml(result?.email || "n/a")}<br/>
        <strong>Package:</strong> ${escapeHtml(packageName)}<br/>
        <strong>Product ID:</strong> ${escapeHtml(result?.productId || "n/a")}<br/>
        <strong>Purchase Token:</strong> ${escapeHtml(purchaseToken)}<br/>
        <strong>Auto Renew Enabled:</strong> ${escapeHtml(result?.autoRenewEnabled ?? "n/a")}<br/>
        <strong>Has Access:</strong> ${escapeHtml(result?.hasAccess ?? "n/a")}<br/>
        <strong>Start Date:</strong> ${escapeHtml(result?.startDate ? result.startDate.toISOString() : "n/a")}<br/>
        <strong>End Date:</strong> ${escapeHtml(result?.endDate ? result.endDate.toISOString() : "n/a")}
      </p>
      <p>
        <strong>Message:</strong> ${escapeHtml(result?.message || errorMessage || "n/a")}
      </p>
      ${
        errorMessage
          ? `<p><strong>Error:</strong> ${escapeHtml(errorMessage)}</p>`
          : ""
      }
      <p><strong>Request Summary</strong></p>
      <pre>${escapeHtml(stringifyForEmail(requestSummary))}</pre>
    `;
  }

  private sendGooglePlayRtdnAlertEmail({
    req,
    result,
    errorMessage,
  }: {
    req: any;
    result?: GooglePlaySyncResult;
    errorMessage?: string;
  }) {
    const subjectStatus = errorMessage ? "ERROR" : (result?.action || "received").toUpperCase();
    const messageId = result?.messageId || req?.body?.message?.messageId || "n/a";

    new SendEmail()
      .sendGenericEmail({
        toEmail: GOOGLE_PLAY_RTDN_ALERT_EMAIL,
        subject: `[GooglePlayRTDN] ${subjectStatus} messageId=${messageId}`,
        bodyContent: this.buildGooglePlayRtdnEmailBody({
          req,
          result,
          errorMessage,
        }),
      })
      .catch((emailError) => {
        console.error("Failed to send Google Play RTDN alert email:", emailError);
      });
  }

  async createOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let orderType = req.body.orderType;
      if (
        (!email && !currencyIn && !currencyOut && !amount && !orderType) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined ||
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
      // for (let i = 0; i < result.data.links.length; i++) {
      //   if (result.data.links[i].rel.includes("approve")) {
      //     res.redirect(result.data.links[i].href);
      //   }
      // }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createDepositOrder(req: any, res: any) {
    try {
      const { email, coin, amount, paymentType } = req.body;
      if (
        !email ||
        !coin ||
        !amount ||
        !paymentType ||
        email === undefined ||
        coin === undefined ||
        amount === undefined ||
        paymentType === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createDepositOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
      // for (let i = 0; i < result.data.links.length; i++) {
      //   if (result.data.links[i].rel.includes("approve")) {
      //     res.redirect(result.data.links[i].href);
      //   }
      // }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrderForAcademy(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let amount = req.body.amount;
      let orderId = req.body.orderId;
      if (
        (!email && !amount && !orderId) ||
        email == undefined ||
        orderId == undefined ||
        amount == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createOrderForAcademy(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
      // for (let i = 0; i < result.data.links.length; i++) {
      //   if (result.data.links[i].rel.includes("approve")) {
      //     res.redirect(result.data.links[i].href);
      //   }
      // }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async powerPackCreateOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let purchasedProduct = req.body.purchasedProduct;

      if (
        (!email && !purchasedProduct) ||
        email == undefined ||
        purchasedProduct == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.powerPackCreateOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createFreeTrailOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      if (
        (!email && !amount && !planName && !planManagedBy) ||
        email == undefined ||
        amount == undefined ||
        planName == undefined ||
        planManagedBy == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createFreeTrailOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createMiningSubscriptionOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let amount = req.body.amount;
      if (
        (!email && !amount && !planName) ||
        email == undefined ||
        amount == undefined ||
        planName == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createMiningSubscriptionOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async handleAppStoreNotifications(req: any, res: any) {
    try {
      console.log(req.body, "body");
      const receiptData = req.body.receiptData;

      let parsedReceipt;
      parsedReceipt =
        typeof receiptData === "string" ? JSON.parse(receiptData) : receiptData;
      console.log(parsedReceipt, "parsedReceipt");
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.handleAppStoreNotifications(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async handleGooglePlayRtdn(req: any, res: any) {
    try {
      const result = await googlePlaySubscriptionSyncService.handleRtdnEnvelope(
        req.body as GooglePlayRtdnEnvelope
      );

      console.log(
        `[GooglePlayRTDN] response action=${result.action} state=${result.googleState || "n/a"} orderId=${result.orderId || "n/a"} email=${result.email || "n/a"} messageId=${result.messageId || "n/a"}`
      );

      this.sendGooglePlayRtdnAlertEmail({ req, result });

      res.status(200).send({
        status: 200,
        success: true,
        data: result,
      });
      return;
    } catch (err: any) {
      const message = err?.message || String(err);
      console.error("Google Play RTDN handler error:", err);
      this.sendGooglePlayRtdnAlertEmail({
        req,
        errorMessage: message,
      });
      res.status(500).send({
        status: 500,
        success: false,
        data: { message: "Unhandled error: " + message },
      });
      return;
    }
  }

  async createOrderForSmartCrypto(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      if (
        (!email && !amount && !planName && !planManagedBy) ||
        email == undefined ||
        amount == undefined ||
        planName == undefined ||
        planManagedBy == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrderForSmartCrypto(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrderForSmartCryptoFreeTrailUpdation(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let planName = req.body.planName;
      let planManagedBy = req.body.planManagedBy;
      let amount = req.body.amount;
      if (
        (!email && !amount && !planName && !planManagedBy) ||
        email == undefined ||
        amount == undefined ||
        planName == undefined ||
        planManagedBy == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any =
        await orderOps.createOrderForSmartCryptoFreeTrailUpdation(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrderForSmartAPY(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let duration = req.body.duration;
      let percentage = req.body.percentage;
      let amount = req.body.amount;
      let yieldValue = req.body.yieldValue;
      if (
        (!email && !amount && !yieldValue && !percentage && !duration) ||
        email == undefined ||
        amount == undefined ||
        duration == undefined ||
        yieldValue == undefined ||
        percentage == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrderForSmartAPY(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrderForGift(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let giftCardArr = req.body.giftCardArr;
      if (
        (!email && !giftCardArr) ||
        email == undefined ||
        giftCardArr == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrderForGiftCard(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async CreateMonthlyINEXSubscriptionOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let orderType = req.body.orderType;
      if (
        (!email && !currencyIn && !currencyOut && !amount && !orderType) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined ||
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createMonthlyINEXOrderNonPaypal(
        req,
        res
      );
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async monthlyINEXCreateOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let orderType = req.body.orderType;
      if (
        (!email && !currencyIn && !currencyOut && !amount && !orderType) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined ||
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createMonthlyINEXOrder(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async monthlyINEXCreateSubscription(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let orderType = req.body.orderType;
      if (
        (!email && !currencyIn && !currencyOut && !amount && !orderType) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined ||
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createMonthlyINEXSubscription(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async monthlyHoneyBeeINEXCreateSubscription(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let orderType = req.body.orderType;
      if (
        (!email && !currencyIn && !currencyOut && !amount && !orderType) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined ||
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createMonthlyHoneyBeeINEXSubscription(
        req,
        res
      );
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async monthlyINEXCancelSubscription(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let subscriptionId = req.body.subscriptionId;
      let reason = req.body.reason;
      if (
        (!email && !subscriptionId && !reason) ||
        email == undefined ||
        subscriptionId == undefined ||
        reason == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.cancelMonthlyINEXSubscription(req, res);
      console.log(result, "result");
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let orderId = req.body.orderId;
      let orderStatus = req.body.orderStatus;
      if (
        (!email && !orderId && !orderStatus) ||
        email === undefined ||
        orderId === undefined ||
        orderStatus === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.updateUserOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateOrderForFiatDeposit(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let orderId = req.body.orderId;
      let txId = req.body.txId;
      let orderStatus = req.body.orderStatus;
      if (
        (!email && !orderId && !orderStatus) ||
        email === undefined ||
        orderId === undefined ||
        txId === undefined ||
        orderStatus === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.updateUserOrderForFiatDeposit(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async paypalWebhookupdateOrder(req: any, res: any) {
    try {
      console.log(req.body, "body");
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.paypalWebhook(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async stripeWebhookupdateOrder(req: any, res: any) {
    try {
      console.log(req.body, "body");
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.stripeWebhook(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async buyCrypto(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let orderType = req.body.orderType;
      if (
        email == undefined &&
        currencyIn == undefined &&
        currencyOut == undefined &&
        amount == undefined &&
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async buyETF(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let orderType = req.body.orderType;
      if (
        email == undefined &&
        currencyIn == undefined &&
        currencyOut == undefined &&
        amount == undefined &&
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.createUserETFOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sellCrypto(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let orderType = req.body.orderType;
      if (
        email == undefined &&
        currencyIn == undefined &&
        currencyOut == undefined &&
        amount == undefined &&
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sellETF(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let orderType = req.body.orderType;
      if (
        email == undefined &&
        currencyIn == undefined &&
        currencyOut == undefined &&
        amount == undefined &&
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result = await orderOps.createUserETFOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async convertCrypto(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let orderType = req.body.orderType;
      if (
        email == undefined &&
        currencyIn == undefined &&
        currencyOut == undefined &&
        amount == undefined &&
        orderType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps: OrderOperations = new OrderOperations(req, res);
      let result: any = await orderOps.createUserOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getBuyCryptoPrices(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      if (
        (!email && !currencyIn && !currencyOut) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined
      ) {
        res.statusCode = 500;
        res.send({ message: "Missing parameters" });
        return;
      }
      let currencyOperations = new CurrencyOperations(req, res);
      let results = await currencyOperations.getCurrencyPriceByType(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async processConvertOrder(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let orderId = req.body.orderId;
      if (email == undefined && orderId == undefined) {
        res.statusCode = 500;
        res.send({ message: "Missing parameters" });
        return;
      }
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.processConvertOrder(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getOrdersCount(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getOrdersCount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getDiffOrderCount(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getDiffOrdersCount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateDiscountCode(req: any, res: any) {
    try {
      let { discountCode, packName } = req.params;
      if (
        !discountCode ||
        discountCode == undefined ||
        !packName ||
        packName == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.validateDiscountCode(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async switchCryptoPlan(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      const { currentPortfolioName, planName } = req.body;
      if (
        !email == undefined ||
        !currentPortfolioName == undefined ||
        !currentPortfolioName ||
        !planName
      ) {
        res.statusCode = 500;
        res.send({ message: "Missing parameters" });
        return;
      }
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.switchSmartCryptoPlan(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sellSmartCryptoPlan(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      console.log("req.boyd", req.body);
      const { currentPortfolioName } = req.body;
      if (
        !email == undefined ||
        !currentPortfolioName == undefined ||
        !currentPortfolioName
      ) {
        res.statusCode = 500;
        res.send({ message: "Missing parameters" });
        return;
      }
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.sellSmartCryptoPlan(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrderForQuantum(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let currencyIn = req.body.currencyIn;
      let currencyOut = req.body.currencyOut;
      let amount = req.body.amount;
      let outAmount = req.body.outAmount;
      let blockchain = req.body.blockchain; // Required for USDT/USDC payments
      let paymentMethod = req.body.paymentMethod; // "crypto", "paypal", "card", "wire-transfer"

      // Validate required fields
      if (
        (!email && !currencyIn && !currencyOut && !amount) ||
        email == undefined ||
        currencyIn == undefined ||
        currencyOut == undefined ||
        amount == undefined ||
        outAmount == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }

      // Validate quantum-specific requirements
      // In quantum, users can buy BTCY from USDT, USDC, PayPal, and card (credit/debit)
      if (currencyOut !== "BTCY") {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "Quantum orders are only for buying BTCY" },
        });
        return;
      }

      const allowedCurrencies = [
        "USDT",
        "USDC",
        "USD",
        "CreditCard",
        "PayPal",
        "WireTransfer",
        "Stripe",
      ];
      if (!allowedCurrencies.includes(currencyIn)) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: {
            message:
              "Invalid currency for Quantum. Allowed: USDT, USDC, WireTransfer, PayPal, USD, Stripe, CreditCard",
          },
        });
        return;
      }

      if (currencyIn === "WireTransfer") {
        const orderAmount = Number(amount);
        const requestedOutAmount = Number(outAmount);
        if (
          !Number.isFinite(orderAmount) ||
          orderAmount <= 0 ||
          !Number.isFinite(requestedOutAmount) ||
          requestedOutAmount <= 0
        ) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: {
              message: "amount and outAmount must be valid positive numbers",
            },
          });
          return;
        }

        const btcyUsdRate = await resolveQuantumBtcyUsdRate();
        req.body.feeData = calculateFeeAmount(orderAmount);
        req.body.btcyUsdRate = btcyUsdRate;
        req.body.outAmount = calculateQuantumBtcyOutAmountFromFeeData(
          req.body.feeData,
          btcyUsdRate
        );
        const bonusResult = applyQuantumBtcyBonus(orderAmount, req.body.outAmount);
        req.body.outAmount = bonusResult.finalOutAmount;
        req.body.promotionalBonusAmount = bonusResult.bonusAmount;
        req.body.promotionalBonusCode = bonusResult.promoCode;

        const orderOps: OrderOperations = new OrderOperations(req, res);
        let result: any = await orderOps.createUserOrderForQuantumWireTransfer(
          req,
          res
        );
        console.log(result, "quantum Wire-Transfer order result");
        res.statusCode = result.status;
        res.send(result);
        return;
      }

      // Handle different payment methods
      if (currencyIn === "USDT" || currencyIn === "USDC") {
        // Validate blockchain is provided for crypto payments
        if (!blockchain) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: {
              message:
                "Blockchain is required for USDT/USDC payments. Allowed: Ethereum, Solana",
            },
          });
          return;
        }

        if (!["Ethereum", "Solana"].includes(blockchain)) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: { message: "Invalid blockchain. Allowed: Ethereum, Solana" },
          });
          return;
        }
        const orderAmount = Number(amount);

        const feeData = calculateFeeAmount(orderAmount);
        const totalPayable = Number(feeData.total.toFixed(6));
        const requestedOutAmount = Number(outAmount);
        if (
          !Number.isFinite(orderAmount) ||
          orderAmount <= 0 ||
          !Number.isFinite(requestedOutAmount) ||
          requestedOutAmount <= 0
        ) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: {
              message: "amount and outAmount must be valid positive numbers",
            },
          });
          return;
        }

        const btcyUsdRate = await resolveQuantumBtcyUsdRate();
        const feeAdjustedOutAmount = calculateQuantumBtcyOutAmountFromFeeData(
          feeData,
          btcyUsdRate
        );
        const bonusResult = applyQuantumBtcyBonus(
          orderAmount,
          feeAdjustedOutAmount
        );
        console.log(
          `Creating crypto payment order: ${currencyIn} on ${blockchain} (outAmount=${bonusResult.finalOutAmount}, bonus=${bonusResult.bonusAmount})`
        );

        // Create USDT/USDC order in this file, blockchain monitoring in cryptoPayment.operations.ts
        const result = await this.createCryptoOrder(
          email,
          currencyIn,
          currencyOut,
          totalPayable,
          bonusResult.finalOutAmount,
          blockchain,
          bonusResult.bonusAmount,
          feeData,
          btcyUsdRate
        );

        if (result.success) {
          res.statusCode = 200;
          res.send({
            status: 200,
            data: result.data,
          });
        } else {
          res.statusCode = 500;
          res.send({
            status: 500,
            data: {
              message: "Failed to create crypto payment order",
              error: result.error,
            },
          });
        }
        return;
      } else if (currencyIn === "Stripe") {
        const orderAmount = Number(amount);
        const requestedOutAmount = Number(outAmount);
        if (
          !Number.isFinite(orderAmount) ||
          orderAmount <= 0 ||
          !Number.isFinite(requestedOutAmount) ||
          requestedOutAmount <= 0
        ) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: {
              message: "amount and outAmount must be valid positive numbers",
            },
          });
          return;
        }

        const feeData = calculateFeeAmount(orderAmount);
        const btcyUsdRate = await resolveQuantumBtcyUsdRate();
        const feeAdjustedOutAmount = calculateQuantumBtcyOutAmountFromFeeData(
          feeData,
          btcyUsdRate
        );
        const bonusResult = applyQuantumBtcyBonus(
          orderAmount,
          feeAdjustedOutAmount
        );
        console.log(
          `Creating Stripe quantum order for ${email} (outAmount=${bonusResult.finalOutAmount}, bonus=${bonusResult.bonusAmount})`
        );

        const stripeOps = new StripeOperations();
        const result = await stripeOps.createQuantumStripePayment(
          email,
          orderAmount,
          bonusResult.finalOutAmount,
          "USD",
          req.body.source,
          req.body.env,
          feeData,
          btcyUsdRate
        );

        if (result.success) {
          res.statusCode = 200;
          res.send({
            status: 200,
            data: {
              ...result.data,
              outAmount: bonusResult.finalOutAmount,
              bonusAmount: bonusResult.bonusAmount,
              promoCode: bonusResult.promoCode,
            },
          });
        } else {
          res.statusCode = 500;
          res.send({
            status: 500,
            data: {
              message:
                result.error || "Failed to create Stripe quantum payment",
            },
          });
        }
        return;
      } else if (currencyIn === "USD" || currencyIn === "PayPal" || currencyIn === "CreditCard") {
        // 🔹 PAYPAL/USD PAYMENT: Use existing PayPal system (completely separate from crypto)
        const orderAmount = Number(amount);
        const requestedOutAmount = Number(outAmount);
        if (
          !Number.isFinite(orderAmount) ||
          orderAmount <= 0 ||
          !Number.isFinite(requestedOutAmount) ||
          requestedOutAmount <= 0
        ) {
          res.statusCode = 400;
          res.send({
            status: 400,
            data: {
              message: "amount and outAmount must be valid positive numbers",
            },
          });
          return;
        }

        console.log(`Creating PayPal/USD order for quantum mining`);

        // Add paymentType to req.body for order.operations.ts
        req.body.paymentType = currencyIn.toLowerCase();
        const btcyUsdRate = await resolveQuantumBtcyUsdRate();
        req.body.feeData = calculateFeeAmount(orderAmount);
        req.body.btcyUsdRate = btcyUsdRate;
        req.body.outAmount = calculateQuantumBtcyOutAmountFromFeeData(
          req.body.feeData,
          btcyUsdRate
        );
        const bonusResult = applyQuantumBtcyBonus(orderAmount, req.body.outAmount);
        req.body.outAmount = bonusResult.finalOutAmount;
        req.body.promotionalBonusAmount = bonusResult.bonusAmount;
        req.body.promotionalBonusCode = bonusResult.promoCode;

        const orderOps: OrderOperations = new OrderOperations(req, res);
        let result: any = await orderOps.createUserOrderForQuantum(req, res);
        console.log(result, "quantum PayPal/USD order result");
        res.statusCode = result.status;
        res.send(result);
        return;
      }
    } catch (err) {
      console.error("Error in createOrderForQuantum:", err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateQuantumWireTransferConfirmation(req: any, res: any) {
    try {
      const orderId = String(req.body?.orderId || "").trim();
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const customerName = String(
        req.body?.customerName || req.body?.name || ""
      ).trim();
      const bankName = String(req.body?.bankName || "").trim();
      const bankAccountNumber = String(
        req.body?.bankAccountNumber || ""
      ).trim();
      const address = String(req.body?.address || "").trim();
      const phoneNumber = String(req.body?.phoneNumber || "").trim();

      if (
        !orderId ||
        !email ||
        !customerName ||
        !bankName ||
        !bankAccountNumber ||
        !address ||
        !phoneNumber
      ) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: {
            message:
              "orderId, email, customerName, bankName, bankAccountNumber, address, phoneNumber are required",
          },
        });
        return;
      }

      req.body.email = email;
      const orderOps: OrderOperations = new OrderOperations(req, res);
      const result: any = await orderOps.updateQuantumWireTransferConfirmation(
        req,
        res
      );
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  /**
   * Create USDT/USDC crypto order in orderAPI.ts
   * Uses cryptoPayment.operations.ts for blockchain monitoring
   */
  async createCryptoOrder(
    email: string,
    currencyIn: string,
    currencyOut: string,
    amount: number,
    outAmount: number,
    blockchain: string,
    bonusAmount: number = 0,
    feeData?: {
      baseAmount: number;
      feePercent: number;
      fee: number;
      netAmount?: number;
      total: number;
    },
    btcyUsdRate?: number
  ) {
    try {
      const orderService = new OrderService();

      const user = await userService.findOneSelect(
        { email: email.toLowerCase() },
        {}
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Generate unique order ID
      const orderId = `CRYPTO_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Get our wallet address from cryptoPayment.operations.ts
      const receiverAddress = getOurWalletAddress(blockchain);

      const orderBreakdown: any = {
        inCurrenyName: currencyIn,
        inAmount: feeData?.baseAmount || amount,
        feePercent: feeData?.feePercent || 0,
        feeAmount: feeData?.fee || 0,
        netAmount: feeData?.netAmount ?? feeData?.baseAmount ?? amount,
        totalPayable: amount,
        outCurrencyName: currencyOut,
        outAmount: outAmount,
        finalAmountAfterDiscount: amount,
      };

      if (bonusAmount > 0) {
        orderBreakdown.promotionalBonusAmount = bonusAmount;
        orderBreakdown.promotionalBonusCode = INDEPENDENCE_WEEK_PROMO_CODE;
      }

      const orderRateValue =
        Number.isFinite(Number(btcyUsdRate)) && Number(btcyUsdRate) > 0
          ? Number(btcyUsdRate)
          : await resolveQuantumBtcyUsdRate();

      // Create order data with all required fields
      const orderData = {
        orderId: orderId,
        user: {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          isVerified: user.verification.activated,
          language: user.language,
        },
        status: OrderStatus.Pending,
        orderType: "Buy" as any,
        currency: currencyIn.toUpperCase() as any,
        amount: amount,
        breakdown: orderBreakdown,
        exchangeName: "CryptoPaymentProcessor",
        created: new Date(),
        orderCompletedOn: new Date(), // Required field
        transactions: [],
        receiverAccount: {
          userReceiveAddress: receiverAddress,
          userReceiveName: "",
          userId: "",
          userReceivePhone: "",
        },
        paymentType: "Crypto" as any,
        orderRate: { currency: "BTCY", rate: orderRateValue },
        comments: `Quantum ${currencyIn} payment | Blockchain: ${blockchain} | Receiver: ${receiverAddress}`,
        notes: "",
        expirationDate: new Date(Date.now() + 10 * 60 * 1000), // 10-minute expiry
        blockchainName: blockchain,
        exchangeFees: feeData?.feePercent || 0,
        isCaptainPerformingOrder: false,
        captainBeeEmail: "",
        // Required fields with default values
        indexxTokenOrdersCount: 0,
        otherTokenOrdersCount: 0,
        discountCode: "",
        discountPercentage: 0,
        powerPackFees: 0,
      };

      // Create order in database
      const createdOrder = await orderService.create(orderData as any);
      await new SendEmail().sendAccountsOrderCreated({
        userEmail: createdOrder.user?.email || "",
        orderId: createdOrder.orderId,
        orderType: createdOrder.orderType,
        paymentType: String(createdOrder.paymentType || ""),
        inAmount: createdOrder.breakdown?.inAmount,
        inCurrency: createdOrder.breakdown?.inCurrenyName,
        outAmount: createdOrder.breakdown?.outAmount,
        outCurrency: createdOrder.breakdown?.outCurrencyName,
        status: createdOrder.status,
        exchangeName: createdOrder.exchangeName,
        blockchainName: createdOrder.blockchainName,
        createdAt: createdOrder.created,
        notes: createdOrder.comments || createdOrder.notes || "",
      });

      return {
        success: true,
        data: {
          orderId: orderId,
          paymentMethod: currencyIn.toLowerCase(),
          amount: amount,
          outAmount: outAmount,
          bonusAmount: bonusAmount,
          promoCode: bonusAmount > 0 ? INDEPENDENCE_WEEK_PROMO_CODE : "",
          receiverAddress: receiverAddress,
          expiresAt: orderData.expirationDate,
          message: `Send ${amount} ${currencyIn.toUpperCase()} (includes ${
            feeData?.fee || 0
          } fee) to ${receiverAddress}`,
          blockchain: blockchain,
        },
      };
    } catch (err) {
      console.error("Error creating crypto order:", err);
      return { success: false, error: err };
    }
  }

  async alreadyPaidForQuantum(req: any, res: any) {
    try {
      const orderId = String(req.params.orderId || "").trim();
      const parsed = alreadyPaidSchema.safeParse(req.body);
      if (!orderId || !parsed.success) {
        res.status(400).send({
          status: 400,
          data: { message: "badRequest", error: parsed.error?.flatten?.() },
        });
        return;
      }

      const payload = parsed.data;
      const orderOps: OrderOperations = new OrderOperations(req, res);

      const result = await orderOps.alreadyPaidOps(req, res, orderId, payload);

      // Normalize response
      res.status(result.status).send({
        status: result.status,
        data: result.data,
      });
    } catch (err) {
      console.error("[alreadyPaidForQuantum] error:", err);
      res.status(500).send({
        status: 500,
        data: { message: "Unhandled error", error: String(err) },
      });
    }
  }

  async checkQuantumCryptoPayment(req: any, res: any) {
    try {
      const parsed = quantumCryptoCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).send({
          status: 400,
          data: { message: "badRequest", error: parsed.error.flatten() },
        });
        return;
      }

      const result = await verifyQuantumCryptoPayment(
        parsed.data.orderId,
        parsed.data
      );
      res
        .status(result.status)
        .send({ status: result.status, data: result.data });
    } catch (err) {
      console.error("[checkQuantumCryptoPayment] error:", err);
      res.status(500).send({
        status: 500,
        data: { message: "Unhandled error", error: String(err) },
      });
    }
  }

  async checkQuantumCryptoPaymentByTxHash(req: any, res: any) {
    try {
      const parsed = quantumCryptoTxHashCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).send({
          status: 400,
          data: { message: "badRequest", error: parsed.error.flatten() },
        });
        return;
      }

      const result = await verifyQuantumCryptoPaymentByTxHash(
        parsed.data.orderId,
        parsed.data.txHash
      );
      res
        .status(result.status)
        .send({ status: result.status, data: result.data });
    } catch (err) {
      console.error("[checkQuantumCryptoPaymentByTxHash] error:", err);
      res.status(500).send({
        status: 500,
        data: { message: "Unhandled error", error: String(err) },
      });
    }
  }

  async cancelQuantumCryptoOrder(req: any, res: any) {
    try {
      const parsed = quantumCancelSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).send({
          status: 400,
          data: { message: "badRequest", error: parsed.error.flatten() },
        });
        return;
      }

      const result = await cancelQuantumCryptoOrderFlow(parsed.data.orderId);
      res
        .status(result.status)
        .send({ status: result.status, data: result.data });
    } catch (err) {
      console.error("[cancelQuantumCryptoOrder] error:", err);
      res.status(500).send({
        status: 500,
        data: { message: "Unhandled error", error: String(err) },
      });
    }
  }

  async getQuantumOrderStatus(req: any, res: any) {
    try {
      const parsed = quantumStatusParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).send({
          status: 400,
          data: { message: "badRequest", error: parsed.error.flatten() },
        });
        return;
      }

      const { orderId } = parsed.data;
      const order = await orderService.findOne({ orderId });

      if (!order) {
        res.status(404).send({
          status: 404,
          data: {
            orderId,
            message: "Order not found",
          },
        });
        return;
      }

      const mapped = normalizeQuantumStatus(order.status);
      res.status(200).send({
        status: 200,
        data: {
          orderId: order.orderId,
          status: mapped.status,
          paymentReceived: mapped.paymentReceived,
          message: mapped.message,
        },
      });
    } catch (err) {
      console.error("[getQuantumOrderStatus] error:", err);
      res.status(500).send({
        status: 500,
        data: {
          orderId: String(req.params?.orderId || ""),
          status: "failed",
          paymentReceived: false,
          message: "Unhandled error",
          error: String(err),
        },
      });
    }
  }

  async claimWithoutOrderId(req: any, res: any) {
    try {
      const ops = new OrderOperations(req, res);
      const result = await ops.claimProofWithoutOrderId(req.body);
      res.status(result.status).send(result);
    } catch (e: any) {
      res
        .status(500)
        .send({ status: 500, data: { message: e.message || "internal" } });
    }
  }
  async getAllOrders(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getAllOrders(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getSellOrder(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getSellOrder();

      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllMiningSubscriptionOrders(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getAllMiningSubscriptionOrders(
        req,
        res
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllMiningSubscriptionOrderWeb(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getAllMiningSubscriptionOrderWeb(
        req,
        res
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getCompletedBtcyBuyOrders(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getCompletedBtcyBuyOrders(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserBtcyBuySellOrders(req: any, res: any) {
    try {
      let orderOperations = new OrderOperations(req, res);
      let results = await orderOperations.getUserBtcyBuySellOrders(req, res);

      res.statusCode = results.status;
      if (results.status === 200) {
        res.send(results.data);
      } else {
        res.send(results);
      }
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getBtcyBuyHistoryEmails(req: any, res: any) {
    try {
      const emails = await btcyBuyHistoryService.getDistinctEmails();
      res.status(200).send({
        status: 200,
        data: {
          count: emails.length,
          emails,
        },
      });
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
}
