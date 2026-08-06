import Stripe from "stripe";
import { keys } from "../config/keys";
import { StripeOperations } from "../platform/stripe.operations";
import { OrderService } from "../services/order.service";
import { UserService } from "../services/user.service";
import { TransactionService } from "../services/transaction.service";
import { OrderStatus, OrderTransaction } from "../data/order";
import { ChatSocketService } from "../services/chatWebsocket.service";
import { calculateFeeAmount } from "../platform/cryptoPayment.operations";
import {
  calculateQuantumBtcyOutAmountFromFeeData,
  resolveQuantumBtcyUsdRate,
} from "../helpers/quantumBtcyPricing";
import { applyIndependenceWeekQuantumBtcyBonus } from "../helpers/quantumBtcyBonus";

const orderService = new OrderService();
const userService = new UserService();
const txService = new TransactionService();
const BTCY_NETWORK = "Ying Yang Chain";
const getConfiguredValue = (...values: Array<string | undefined>) =>
  values.find((value) => value && value !== "undefined" && value !== "null") || "";
const getConfiguredValues = (...values: Array<string | undefined>) =>
  values.filter(
    (value): value is string =>
      Boolean(value) && value !== "undefined" && value !== "null"
  );
const splitSecrets = (value: string | undefined) =>
  (value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const env = getConfiguredValue(keys.env.key).toLowerCase();
const isDevelopmentEnv = env === "development";
const stripeWebhookSecrets = Array.from(
  new Set(
    getConfiguredValues(
      isDevelopmentEnv ? undefined : keys.stripe_webhook_main?.key,
      keys.stripe_webhook.key,
      keys.stripe.SECRETKEY,
      process.env.SECRETKEY,
      ...splitSecrets(process.env.STRIPE_WEBHOOKS)
    ).filter((value) => value.startsWith("whsec_"))
  )
);

let stripe_keys =
  env == "development" ? keys.stripe_test.key : keys.stripe_live.key;

const stripe = new Stripe(stripe_keys, {
  apiVersion: "2020-08-27" as any,
  appInfo: {
    // For sample support and debugging, not required for production:
    name: "stripe-samples/accept-a-payment",
    url: "https://github.com/stripe-samples",
    version: "0.0.2",
  },
  typescript: true,
});

async function settleQuantumStripeOrder(
  metadata: Stripe.Metadata | undefined,
  paymentReference: string,
  sourceEvent: string
) {
  if (metadata?.order_type !== "quantum") {
    return;
  }

  const orderId = String(metadata.orderId || "").trim();
  const email = String(metadata.email || "").toLowerCase().trim();
  const outCurrency = String(metadata.out_currency || "BTCY").trim();
  const outAmount = parseFloat(String(metadata.out_amount || "0"));

  if (!orderId || !email || !outCurrency || !Number.isFinite(outAmount) || outAmount <= 0) {
    console.error("[StripeWebhook] invalid quantum metadata", {
      orderId,
      email,
      outCurrency,
      outAmount,
      sourceEvent,
    });
    return;
  }

  console.log(`🔄 Settling quantum order ${orderId} for ${email} from ${sourceEvent}`);

  try {
    const order = await orderService.findOne({ orderId, "user.email": email });
    if (!order) {
      console.error(`❌ Quantum order ${orderId} not found`);
      return;
    }

    if (order.status === OrderStatus.Completed) {
      console.warn(`⚠️  Quantum order ${orderId} already completed, skipping`);
      return;
    }

    const orderTx: OrderTransaction = {
      currency: order.breakdown.inCurrenyName as any,
      amount: order.breakdown.inAmount,
      trnReference: paymentReference,
      trnHash: "",
      walletAddress: "",
      created: new Date(),
      status: "Completed",
    };

    await orderService.updatePart(
      { orderId, "user.email": email },
      {
        $set: {
          status: OrderStatus.Completed,
          orderCompletedOn: new Date(),
          transactions: (order.transactions ?? []).concat(orderTx),
        },
      }
    );

    await orderService.checkAndCreateUserWallet(email, outCurrency, false, BTCY_NETWORK);
    await userService.updatePartWithOptions(
      { email },
      {
        $inc: { "userWallets.$[w].coinBalance": outAmount },
        $set: { "userWallets.$[w].coinLastUsedOn": new Date() },
      },
      { arrayFilters: [{ "w.coinSymbol": outCurrency, "w.coinNetwork": BTCY_NETWORK }] }
    );

    await txService.create({
      email,
      orderId,
      extRef: paymentReference,
      txId: "",
      from: "",
      to: email,
      amount: outAmount,
      exchangeName: "CEX",
      info: "Quantum BTCY purchase via Stripe",
      status: OrderStatus.Completed,
      currencyRef: outCurrency,
      walletType: "ASSET_WALLET",
      transactionType: "BUY",
      txDate: new Date(),
      benificaryAddress: "",
    });

    try {
      ChatSocketService.emitToUser(email, "order:confirmed", {
        orderId,
        status: OrderStatus.Completed,
        amount: outAmount,
        currency: outCurrency,
        paymentType: "Stripe",
        orderType: "Quantum",
      });
      ChatSocketService.emitToUser(email, "orders:update", {
        orderId,
        status: OrderStatus.Completed,
      });
    } catch (socketErr) {
      console.error("[StripeWebhook] quantum socket emit failed:", socketErr);
    }

    console.log(`✅ Quantum order ${orderId} settled — credited ${outAmount} ${outCurrency}`);
  } catch (quantumErr: any) {
    console.error(`❌ Error settling quantum order ${orderId}:`, quantumErr.message);
  }
}

const applyQuantumBtcyBonus = applyIndependenceWeekQuantumBtcyBonus;

export class PaymentsController {
  constructor() { }

  private async processSuccessfulPaymentMetadata(
    metadata: Record<string, any>,
    paymentReference: string,
    req: any,
    res: any
  ) {
    if (metadata.order_type === "quantum") {
      const orderId = String(metadata.orderId || "");
      const email = String(metadata.email || "").toLowerCase();
      const outCurrency = String(metadata.out_currency || "BTCY");
      const outAmount = parseFloat(String(metadata.out_amount || "0"));
      console.log(`Settling quantum order ${orderId} for ${email}`);
      try {
        const order = await orderService.findOne({ orderId, "user.email": email });
        if (!order) {
          console.error(`Quantum order ${orderId} not found`);
        } else if (order.status === OrderStatus.Completed) {
          console.warn(`Quantum order ${orderId} already completed, skipping`);
        } else {
          const orderTx: OrderTransaction = {
            currency: order.breakdown.inCurrenyName as any,
            amount: order.breakdown.inAmount,
            trnReference: paymentReference,
            trnHash: "",
            walletAddress: "",
            created: new Date(),
            status: "Completed",
          };
          await orderService.updatePart(
            { orderId, "user.email": email },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
                transactions: (order.transactions ?? []).concat(orderTx),
              },
            }
          );

          await orderService.checkAndCreateUserWallet(email, outCurrency, false, BTCY_NETWORK);
          await userService.updatePartWithOptions(
            { email },
            {
              $inc: { "userWallets.$[w].coinBalance": outAmount },
              $set: { "userWallets.$[w].coinLastUsedOn": new Date() },
            },
            { arrayFilters: [{ "w.coinSymbol": outCurrency, "w.coinNetwork": BTCY_NETWORK }] }
          );

          await txService.create({
            email,
            orderId,
            extRef: paymentReference,
            txId: "",
            from: "",
            to: email,
            amount: outAmount,
            exchangeName: "CEX",
            info: "Quantum BTCY purchase via Stripe",
            status: OrderStatus.Completed,
            currencyRef: outCurrency,
            walletType: "ASSET_WALLET",
            transactionType: "BUY",
            txDate: new Date(),
            benificaryAddress: "",
          });

          try {
            ChatSocketService.emitToUser(email, "order:confirmed", {
              orderId,
              status: OrderStatus.Completed,
              amount: outAmount,
              currency: outCurrency,
              paymentType: "Stripe",
              orderType: "Quantum",
            });
            ChatSocketService.emitToUser(email, "orders:update", {
              orderId,
              status: OrderStatus.Completed,
            });
          } catch (socketErr) {
            console.error("[StripeWebhook] quantum socket emit failed:", socketErr);
          }

          console.log(`Quantum order ${orderId} settled - credited ${outAmount} ${outCurrency}`);
        }
      } catch (quantumErr: any) {
        console.error(`Error settling quantum order ${orderId}:`, quantumErr.message);
      }
    }

    if (metadata.trade_id) {
      console.log(`Settling P2P trade ${metadata.trade_id} from payment webhook`);
      try {
        const { P2POperations } = require("../platform/p2p.operations");
        const p2pOps = new P2POperations(req, res);
        const result = await p2pOps.settleTradeFromWebhook(metadata.trade_id, paymentReference);
        if (result.success) {
          console.log(`P2P trade ${metadata.trade_id} settled successfully`);
        } else {
          console.error(`Failed to settle P2P trade ${metadata.trade_id}: ${result.error}`);
        }
      } catch (p2pError: any) {
        console.error(`Error in P2P trade settlement: ${p2pError.message}`);
      }
    }
  }

  private async processFailedPaymentMetadata(
    metadata: Record<string, any>,
    req: any,
    res: any
  ) {
    if (metadata.trade_id) {
      console.log(`Canceling P2P trade ${metadata.trade_id} due to payment failure`);
      try {
        const { P2POperations } = require("../platform/p2p.operations");
        const p2pOps = new P2POperations(req, res);
        const result = await p2pOps.cancelTradeFromWebhook(metadata.trade_id);
        if (result.success) {
          console.log(`P2P trade ${metadata.trade_id} cancelled successfully`);
        } else {
          console.error(`Failed to cancel P2P trade ${metadata.trade_id}: ${result.error}`);
        }
      } catch (p2pError: any) {
        console.error(`Error in P2P trade cancellation: ${p2pError.message}`);
      }
    }
  }

  async StripeWebhooks(req: any, res: any) {
    try {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let event: Stripe.Event | null = null;

      try {
        const signature = req.headers["stripe-signature"];
        const rawBody = Buffer.isBuffer(req.body) ? req.body : (req as any).rawBody;

        if (!signature || Array.isArray(signature)) {
          res.status(400).json({ status: 400, data: { message: "Missing Stripe-Signature header" } });
          return;
        }

        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          res.status(400).json({ status: 400, data: { message: "Raw request body is required for Stripe webhook verification" } });
          return;
        }

        if (!stripeWebhookSecrets.length) {
          res.status(500).json({ status: 500, data: { message: "Stripe webhook secret is not configured" } });
          return;
        }

        let verificationError: any;
        for (const webhookSecret of stripeWebhookSecrets) {
          try {
            event = stripe.webhooks.constructEvent(
              rawBody,
              signature,
              webhookSecret
            );
            break;
          } catch (err: any) {
            verificationError = err;
          }
        }

        if (!event) {
          throw verificationError || new Error("Webhook signature verification failed");
        }
      } catch (err: any) {
        console.log(`⚠️  Webhook signature verification failed.`, err?.message || err);
        res.status(400).json({
          status: 400,
          data: { message: err?.message || "Webhook signature verification failed" },
        });
        return;
      }

      // Extract the data from the event.
      const data: Stripe.Event.Data = event.data;
      const eventType: string = event.type;

      if (eventType === "checkout.session.completed") {
        const session = data.object as Stripe.Checkout.Session;
        console.log(`🔔  Webhook received: checkout session ${session.id}!`);
        const mode = String(session.mode || "").toLowerCase();
        if (mode === "payment" && session.payment_status !== "paid") {
          console.warn(
            `⚠️  Checkout session ${session.id} completed with payment_status=${session.payment_status}, skipping settlement`
          );
        } else if (mode === "payment") {
          const paymentIntentRef = session.payment_intent;
          let paymentReference = session.id;
          let metadata = (session.metadata || {}) as Record<string, any>;

          if (typeof paymentIntentRef === "string" && paymentIntentRef) {
            try {
              const pi = await stripe.paymentIntents.retrieve(paymentIntentRef);
              paymentReference = pi.id || paymentReference;
              metadata = {
                ...metadata,
                ...(pi.metadata || {}),
              } as Record<string, any>;
            } catch (piError: any) {
              console.warn(
                `[StripeWebhook] Unable to retrieve payment intent ${paymentIntentRef}:`,
                piError?.message || piError
              );
            }
          }

          await this.processSuccessfulPaymentMetadata(
            metadata,
            paymentReference,
            req,
            res
          );
        }
      } else if (eventType === "payment_intent.succeeded") {
        const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
        console.log(`Webhook received: ${pi.object} ${pi.status}`);
        const metadata = (pi.metadata || {}) as Record<string, any>;
        await this.processSuccessfulPaymentMetadata(metadata, pi.id, req, res);
      } else if (eventType === "payment_intent.payment_failed") {
        const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
        console.log(`Webhook received: ${pi.object} ${pi.status}`);
        const metadata = (pi.metadata || {}) as Record<string, any>;
        await this.processFailedPaymentMetadata(metadata, req, res);
      }
      res.sendStatus(200);
    } catch (err: any) {
      console.error("Stripe webhook handler failed:", err);
      res.status(500).json({ status: 500, data: { message: err?.message || "Unhandled Stripe webhook error" } });
    }
  }

  async getStripePayment(req: any, res: any) { }

  async createStripePaymentIntent(req: any, res: any) {
    try {
      let orderAmount = req.body.amount * 100;
      let orderId = req.body.orderId;
      let email = String(req.body.email).toLowerCase();
      if (orderAmount == undefined || !orderAmount || orderId == undefined || !orderId || email == undefined || !email) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const stripeOps = new StripeOperations();
      let paymentIntent = await stripeOps.createStripePayment(req, res);
      if (paymentIntent !== null) {
        res.status(200);
        res.send(paymentIntent);
        return;
      } else {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: { message: "Error in creating stripe payment" },
        });
        return;
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getStripePaymentIntent(req: any, res: any) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(req.body.id);
      console.log("paymentIntent", paymentIntent);
      res.status(200);
      res.send(paymentIntent);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getStripePaymentIntentConfirm(req: any, res: any) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(req.body.id);
      console.log("paymentIntent", paymentIntent);
      res.status(200);
      res.send(paymentIntent);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getStripePaymentIntentCancel(req: any, res: any) { }

  async getStripePaymentIntentCapture(req: any, res: any) { }

  async getStripePaymentIntentList(req: any, res: any) { }

  async getStripePaymentIntentRetrieve(req: any, res: any) { }

  async getStripePaymentIntentUpdate(req: any, res: any) { }

  async createStripePaymentLink(req: any, res: any) {
    try {
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: req.body.amount, quantity: 1 }],
        after_completion: {
          type: "redirect",
          redirect: { url: "https://indexx.ai" },
        },
      });
      res.status(200);
      res.send(paymentLink);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async retriveSession(req: any, res: any) {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.body.id);
      res.status(200);
      res.send(session);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async calculateOrderAmount(amount: number) {
    // Replace this constant with a calculation of the order's amount
    // Calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    // Multipled by 100 because of stripe system
    return amount * 100;
  }

  async createQuantumStripePaymentIntent(req: any, res: any) {
    try {
      const { email, amount, currencyIn } = req.body;
      if (!email || !amount) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "email and amount are required" } });
        return;
      }

      const orderAmount = Number(amount);
      if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "amount must be a valid positive number" } });
        return;
      }

      const feeData = calculateFeeAmount(orderAmount);
      const btcyUsdRate = await resolveQuantumBtcyUsdRate();
      const feeAdjustedOutAmount = calculateQuantumBtcyOutAmountFromFeeData(
        feeData,
        btcyUsdRate
      );
      const bonusResult = applyQuantumBtcyBonus(orderAmount, feeAdjustedOutAmount);

      const stripeOps = new StripeOperations();
      const result = await stripeOps.createQuantumStripePayment(
        String(email).toLowerCase(),
        orderAmount,
        bonusResult.finalOutAmount,
        currencyIn || "USD",
        req.body.source,
        req.body.env,
        feeData,
        btcyUsdRate
      );
      if (result.success) {
        res.status(200).send({
          status: 200,
          data: {
            ...result.data,
            outAmount: bonusResult.finalOutAmount,
            bonusAmount: bonusResult.bonusAmount,
            promoCode: bonusResult.promoCode,
            feeAmount: feeData.fee,
          },
        });
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: result.error || "Failed to create quantum payment" } });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async confirmPayment(req: any, res: any) {
    try {
      const stripeOps = new StripeOperations();
      const dataResults = await stripeOps.updateStripePayment(req, res);
      res.statusCode = 200;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
}
