import { keys } from "../config/keys";
import Stripe from "stripe";
import { Request, Response } from "express";
import { StripePaymentService } from "../services/stripePayment.service";
import {
  AmountDetails,
  AutomaticPaymentMethods,
  Charges,
  PaymentMethodOptions,
} from "../data/stripePayment";
import { UserOperations } from "./user.operations";
import {
  addDEXRewards,
  addRewards,
  OrderOperations,
  updateUserOrderHelper,
} from "./order.operations";
import { UserService } from "../services/user.service";
import { OrderService } from "../services/order.service";
import { Order, OrderBreakdown, OrderStatus, OrderTransaction, OrderType, Rates } from "../data/order";
import { TxOperations } from "./tx.operations";
import { TransactionService } from "../services/transaction.service";
import { UserLite } from "../data/user";
import { PaymentTypes, TransactionAccount } from "../data/common";
import {
  getQuantumRedirectUrls,
  isMobileQuantumSource,
} from "../helpers/quantumPaymentRedirects";
import { resolveQuantumBtcyUsdRate } from "../helpers/quantumBtcyPricing";

const txservice: TransactionService = new TransactionService();
let env = keys.env.key;
let stripe_env = keys.dex_env.key;

let stripe_keys =
  env == "development" ? keys.stripe_test.key : keys.stripe_live.key;

let dex_stripe_keys =
  stripe_env == "development"
    ? keys.dex_stripe_test.key
    : keys.dex_stripe_live.key;

const stripe = new Stripe(stripe_keys, {
  apiVersion: "2022-08-01",
});

const dex_stripe = new Stripe(dex_stripe_keys, {
  apiVersion: "2022-08-01",
});
let uservice: UserService = new UserService();
let orderService: OrderService = new OrderService();
const stripePaymentService: StripePaymentService = new StripePaymentService();

const appendQueryParams = (
  baseUrl: string,
  params: Record<string, string>
) => {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export class StripeOperations {
  constructor() { }

  async checkPaymentIntent(params: any) {
    try {
      // const { paymentIntent } = await Stripe.retrievePaymentIntent(params.clientSecret);
      // if (paymentIntent && paymentIntent.status === 'succeeded') {
      //     // Handle successful payment here
      // } else {
      //     // Handle unsuccessful, processing, or canceled payments and API errors here
      // }
    } catch (err) { }
  }

  async createStripePayment(req: any, res: any) {
    try {
      let orderAmount = req.body.amount * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: orderAmount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      let createStripePayment = {
        email: req.body.email,
        userWalletAddress: "",
        orderId: req.body.orderId,
        payment_intent: paymentIntent.id,
        object: paymentIntent.object,
        amount: paymentIntent.amount,
        amount_capturable: paymentIntent.amount_capturable,
        amount_details: paymentIntent.amount_details as AmountDetails,
        amount_received: paymentIntent.amount_received,
        application: paymentIntent.application,
        application_fee_amount: paymentIntent.application_fee_amount,
        automatic_payment_methods:
          paymentIntent.automatic_payment_methods as AutomaticPaymentMethods,
        canceled_at: paymentIntent.canceled_at,
        cancellation_reason: paymentIntent.cancellation_reason,
        capture_method: paymentIntent.capture_method,
        charges: paymentIntent.charges as Charges,
        client_secret: String(paymentIntent.client_secret),
        confirmation_method: paymentIntent.confirmation_method,
        created: paymentIntent.created,
        currency: paymentIntent.currency,
        customer: paymentIntent.customer,
        description: paymentIntent.description,
        invoice: paymentIntent.invoice,
        last_payment_error: paymentIntent.last_payment_error,
        livemode: paymentIntent.livemode,
        metadata: paymentIntent.metadata,
        next_action: paymentIntent.next_action,
        on_behalf_of: paymentIntent.on_behalf_of,
        payment_method: paymentIntent.payment_method,
        payment_method_options:
          paymentIntent.payment_method_options as PaymentMethodOptions,
        payment_method_types: paymentIntent.payment_method_types,
        processing: paymentIntent.processing,
        receipt_email: paymentIntent.receipt_email,
        review: paymentIntent.review,
        setup_future_usage: paymentIntent.setup_future_usage,
        shipping: paymentIntent.shipping,
        source: paymentIntent.source,
        statement_descriptor: paymentIntent.statement_descriptor,
        statement_descriptor_suffix: paymentIntent.statement_descriptor_suffix,
        status: paymentIntent.status,
        transfer_data: paymentIntent.transfer_data,
        transfer_group: paymentIntent.transfer_data,
      };
      let createNewStripe = await stripePaymentService.create(
        createStripePayment
      );
      if (createNewStripe) {
        return paymentIntent;
      } else {
        console.log("err0", createNewStripe);
        return null;
      }
    } catch (err) {
      console.log("err", err);
      return null;
    }
  }

  async createDEXStripePayment(req: any, res: any) {
    try {
      let orderAmount = req.body.amount * 100;
      const paymentIntent = await dex_stripe.paymentIntents.create({
        amount: orderAmount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      let createStripePayment = {
        email: "",
        userWalletAddress: req.body.userWallerAddress,
        orderId: req.body.orderId,
        payment_intent: paymentIntent.id,
        object: paymentIntent.object,
        amount: paymentIntent.amount,
        amount_capturable: paymentIntent.amount_capturable,
        amount_details: paymentIntent.amount_details as AmountDetails,
        amount_received: paymentIntent.amount_received,
        application: paymentIntent.application,
        application_fee_amount: paymentIntent.application_fee_amount,
        automatic_payment_methods:
          paymentIntent.automatic_payment_methods as AutomaticPaymentMethods,
        canceled_at: paymentIntent.canceled_at,
        cancellation_reason: paymentIntent.cancellation_reason,
        capture_method: paymentIntent.capture_method,
        charges: paymentIntent.charges as Charges,
        client_secret: String(paymentIntent.client_secret),
        confirmation_method: paymentIntent.confirmation_method,
        created: Number(paymentIntent.created),
        currency: paymentIntent.currency,
        customer: paymentIntent.customer,
        description: paymentIntent.description,
        invoice: paymentIntent.invoice,
        last_payment_error: paymentIntent.last_payment_error,
        livemode: paymentIntent.livemode,
        metadata: paymentIntent.metadata,
        next_action: paymentIntent.next_action,
        on_behalf_of: paymentIntent.on_behalf_of,
        payment_method: paymentIntent.payment_method,
        payment_method_options:
          paymentIntent.payment_method_options as PaymentMethodOptions,
        payment_method_types: paymentIntent.payment_method_types,
        processing: paymentIntent.processing,
        receipt_email: paymentIntent.receipt_email,
        review: paymentIntent.review,
        setup_future_usage: paymentIntent.setup_future_usage,
        shipping: paymentIntent.shipping,
        source: paymentIntent.source,
        statement_descriptor: paymentIntent.statement_descriptor,
        statement_descriptor_suffix: paymentIntent.statement_descriptor_suffix,
        status: paymentIntent.status,
        transfer_data: paymentIntent.transfer_data,
        transfer_group: paymentIntent.transfer_data,
      };
      let createNewStripe = await stripePaymentService.create(
        createStripePayment
      );
      if (createNewStripe) {
        return paymentIntent;
      } else {
        console.log("err0", createNewStripe);
        return null;
      }
    } catch (err) {
      console.log("err", err);
      return null;
    }
  }

  async updateStripePayment(req: any, res: any) {
    try {
      const { payment_intent, payment_intent_client_secret, redirect_status } =
        req.query;
      let getDBStripePayment = await stripePaymentService.findOne({
        payment_intent: payment_intent,
      });
      let paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
      console.log("paymentIntent CEX", paymentIntent.created);
      let updateStripePayment = await stripePaymentService.updatePart(
        {
          payment_intent: payment_intent,
          payment_intent_client_secret: payment_intent_client_secret,
        },
        {
          $set: {
            object: paymentIntent.object,
            amount: paymentIntent.amount,
            amount_capturable: paymentIntent.amount_capturable,
            amount_details: paymentIntent.amount_details as AmountDetails,
            amount_received: paymentIntent.amount_received,
            application: paymentIntent.application,
            application_fee_amount: paymentIntent.application_fee_amount,
            automatic_payment_methods:
              paymentIntent.automatic_payment_methods as AutomaticPaymentMethods,
            canceled_at: paymentIntent.canceled_at,
            cancellation_reason: paymentIntent.cancellation_reason,
            capture_method: paymentIntent.capture_method,
            charges: paymentIntent.charges as Charges,
            client_secret: String(paymentIntent.client_secret),
            confirmation_method: paymentIntent.confirmation_method,
            created: Number(paymentIntent.created),
            currency: paymentIntent.currency,
            customer: paymentIntent.customer,
            description: paymentIntent.description,
            invoice: paymentIntent.invoice,
            last_payment_error: paymentIntent.last_payment_error,
            livemode: paymentIntent.livemode,
            metadata: paymentIntent.metadata,
            next_action: paymentIntent.next_action,
            on_behalf_of: paymentIntent.on_behalf_of,
            payment_method: paymentIntent.payment_method,
            payment_method_options:
              paymentIntent.payment_method_options as PaymentMethodOptions,
            payment_method_types: paymentIntent.payment_method_types,
            processing: paymentIntent.processing,
            receipt_email: paymentIntent.receipt_email,
            review: paymentIntent.review,
            setup_future_usage: paymentIntent.setup_future_usage,
            shipping: paymentIntent.shipping,
            source: paymentIntent.source,
            statement_descriptor: paymentIntent.statement_descriptor,
            statement_descriptor_suffix:
              paymentIntent.statement_descriptor_suffix,
            status: paymentIntent.status,
            transfer_data: paymentIntent.transfer_data,
            transfer_group: paymentIntent.transfer_data,
          },
        }
      );
      //update the user wallet, order, rewards and finally redirect to success page
      if (paymentIntent.status.localeCompare("succeeded") == 0) {
        //update the user wallet
        let orderStatus = "Completed";
        let orderType = "Buy";
        let email = getDBStripePayment.email;
        let orderId = getDBStripePayment.orderId;
        let results = await updateUserOrderHelper(
          email,
          orderId,
          (orderType = "Buy"),
          orderStatus,
          payment_intent
        );
        //let addTradeToEarn = await addRewards(email, orderId);
        let getOrder = await orderService.findOne({
          orderId: orderId,
        });
        let orderAmount = getOrder.breakdown.inAmount;
        let payAmount = getOrder.breakdown.outAmount;
        let inCurrenyName = getOrder.breakdown.inCurrenyName;
        let outCurrencyName = getOrder.breakdown.outCurrencyName; //
        console.log(
          "http://cex.indexx.ai/indexx-exchange/buy-sell/buy-in-progress/?orderCurrency=${inCurrenyName}&orderAmount=${orderAmount}&payCurrency=${outCurrencyName}&payAmount=${payAmount}"
        );
        return res.redirect(
          `http://cex.indexx.ai/indexx-exchange/buy-sell/buy-in-progress/?orderCurrency=${inCurrenyName}&orderAmount=${orderAmount}&payCurrency=${outCurrencyName}&payAmount=${payAmount}`
        ); // redirect to confirmation page on ui
      } else {
        //res.redirect('http://localhost:3001/payment-failed');
        res.redirect("https://cex.indexx.ai/payment-failed");
      }
      return paymentIntent;
    } catch (error) {
      console.log("err", error);
      return null;
    }
  }

  async updateDEXStripePayment(req: any, res: any) {
    try {
      const { payment_intent, payment_intent_client_secret, redirect_status } =
        req.query;
      let getDBStripePayment = await stripePaymentService.findOne({
        payment_intent: payment_intent,
      });

      let paymentIntent = await dex_stripe.paymentIntents.retrieve(
        payment_intent
      );
      console.log("paymentIntent DEX", paymentIntent.created);
      let updateStripePayment = await stripePaymentService.updatePart(
        {
          payment_intent: payment_intent,
          payment_intent_client_secret: payment_intent_client_secret,
        },
        {
          $set: {
            object: paymentIntent.object,
            amount: paymentIntent.amount,
            amount_capturable: paymentIntent.amount_capturable,
            amount_details: paymentIntent.amount_details as AmountDetails,
            amount_received: paymentIntent.amount_received,
            application: paymentIntent.application,
            application_fee_amount: paymentIntent.application_fee_amount,
            automatic_payment_methods:
              paymentIntent.automatic_payment_methods as AutomaticPaymentMethods,
            canceled_at: paymentIntent.canceled_at,
            cancellation_reason: paymentIntent.cancellation_reason,
            capture_method: paymentIntent.capture_method,
            charges: paymentIntent.charges as Charges,
            client_secret: String(paymentIntent.client_secret),
            confirmation_method: paymentIntent.confirmation_method,
            created: Number(paymentIntent.created),
            currency: paymentIntent.currency,
            customer: paymentIntent.customer,
            description: paymentIntent.description,
            invoice: paymentIntent.invoice,
            last_payment_error: paymentIntent.last_payment_error,
            livemode: paymentIntent.livemode,
            metadata: paymentIntent.metadata,
            next_action: paymentIntent.next_action,
            on_behalf_of: paymentIntent.on_behalf_of,
            payment_method: paymentIntent.payment_method,
            payment_method_options:
              paymentIntent.payment_method_options as PaymentMethodOptions,
            payment_method_types: paymentIntent.payment_method_types,
            processing: paymentIntent.processing,
            receipt_email: paymentIntent.receipt_email,
            review: paymentIntent.review,
            setup_future_usage: paymentIntent.setup_future_usage,
            shipping: paymentIntent.shipping,
            source: paymentIntent.source,
            statement_descriptor: paymentIntent.statement_descriptor,
            statement_descriptor_suffix:
              paymentIntent.statement_descriptor_suffix,
            status: paymentIntent.status,
            transfer_data: paymentIntent.transfer_data,
            transfer_group: paymentIntent.transfer_data,
          },
        }
      );
      //update the user wallet, order, rewards and finally redirect to success page
      if (paymentIntent.status.localeCompare("succeeded") == 0) {
        //update the user wallet
        let orderId = getDBStripePayment.orderId;
        let getOrder = await orderService.findOne({
          orderId: orderId,
        });
        console.log("getOrder", getOrder);
        //let results = await updateUserOrderHelper(email, orderId, orderType = 'Buy', orderStatus)
        let createOrderTX = {
          currency: getOrder.breakdown.inCurrenyName,
          amount: getOrder.breakdown.inAmount,
          trnReference: getDBStripePayment.payment_intent,
          trnHash: "",
          walletAddress: "",
          created: new Date(),
          status: "Completed",
        } as OrderTransaction;

        let updateOrder = await orderService.updatePart(
          {
            orderId: orderId,
          },
          {
            $set: {
              status: "ReceivedFiat",
              transactions: getOrder.transactions?.concat(createOrderTX),
            },
          }
        );
        const txOps = new TxOperations(req, res);
        let processPayOut = await txOps.processDEXBuyOrder(getOrder);
        let getUser = await uservice.findOne({ _id: getOrder.user.userId });

        if (processPayOut?.status == 200) {
          // let addTradeToEarn = await addDEXRewards(
          //   getUser.walletAddress,
          //   orderId
          // );

          // redirect to confirmation page on ui
          return res.redirect(
            `https://dex.indexx.ai/buy/payment-success?orderId=${orderId}`
            //`http://localhost:3001/buy/payment-success?orderId=${orderId}`
          ); // redirect to confirmation page on ui
        } else {
          return res.redirect(
            `https://dex.indexx.ai/buy/payment-failed?orderId=${orderId}`
          );
          //return res.redirect('http://indexx.ai/localhost:3001/payment-failed');
        }
      } else {
        //res.redirect('http://localhost:3001/payment-failed');
        res.redirect(`https://dex.indexx.ai/buy/payment-failed`);
      }
      return paymentIntent;
    } catch (error) {
      console.log("err", error);
      return null;
    }
  }

  async createSubscription(req: Request, res: Response) {
    const { customerId, priceId, paymentMethodId } = req.body;

    try {
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

      // Update customer's default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // 🔥 SAFELY HANDLE the different types here
      if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        if (invoice.payment_intent && typeof invoice.payment_intent !== 'string') {
          const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

          return res.send({
            subscriptionId: subscription.id,
            clientSecret: paymentIntent.client_secret,
          });
        }
      }


      return { error: 'Failed to create subscription.' };
    } catch (error: any) {
      console.log("err", error);
      return null;
    }
  };


  async createQuantumStripePayment(
    email: string,
    amountUsd: number,
    outAmount: number,
    currencyIn: string = "USD",
    source?: string,
    env?: string,
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
      // Fetch user
      const user = await uservice.findOneSelect({ email: email.toLowerCase() }, {});
      if (!user) return { success: false, error: "User not found" };
      if (user.role === "Admin") return { success: false, error: "Admin cannot place order" };

      const orderId = Math.floor(10000000 + Math.random() * 90000000).toString();

      const userLite: UserLite = {
        userId: user._id,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        isVerified: user.verification?.activated ?? false,
        language: user.language || "en",
      } as UserLite;

      const totalPayable = Number(feeData?.total ?? amountUsd);
      const orderRateValue =
        Number.isFinite(Number(btcyUsdRate)) && Number(btcyUsdRate) > 0
          ? Number(btcyUsdRate)
          : await resolveQuantumBtcyUsdRate();

      const orderBreakdown: any = {
        inCurrenyName: currencyIn,
        inAmount: feeData?.baseAmount ?? amountUsd,
        feePercent: feeData?.feePercent ?? 0,
        feeAmount: feeData?.fee ?? 0,
        netAmount: feeData?.netAmount ?? feeData?.baseAmount ?? amountUsd,
        totalPayable,
        outCurrencyName: "BTCY",
        outAmount: outAmount,
        finalAmountAfterDiscount: totalPayable,
      };

      const getRate: Rates = {
        currency: "BTCY",
        rate: orderRateValue,
      } as Rates;

      const newOrder: Order = {
        orderId,
        status: OrderStatus.Quoted,
        orderType: OrderType.Buy,
        orderRate: getRate,
        receiverAccount: {} as TransactionAccount,
        paymentType: PaymentTypes.Stripe,
        breakdown: orderBreakdown,
        user: userLite,
        created: new Date(),
        exchangeFees: feeData?.feePercent ?? 0,
        isCaptainPerformingOrder: false,
        captainBeeEmail: "",
        blockchainName: "Bitcoin",
        comments: "Quantum order for BTCY (Stripe payment)",
      } as Order;

      await orderService.create(newOrder);

      const isMobile = isMobileQuantumSource(source);
      const { successUrl, cancelUrl } = getQuantumRedirectUrls("stripe", source, env);

      const quantumPaymentMetadata = {
        order_type: "quantum",
        orderId,
        email: user.email,
        out_amount: String(outAmount),
        out_currency: "BTCY",
      };

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "BTCY Quantum Purchase",
                description: `Quantum order ${orderId}`,
              },
              unit_amount: Math.round(totalPayable * 100),
            },
            quantity: 1,
          },
        ],
        success_url: isMobile
          ? successUrl
          : appendQueryParams(successUrl, {
              session_id: "{CHECKOUT_SESSION_ID}",
              orderId,
            }),
        cancel_url: isMobile
          ? cancelUrl
          : appendQueryParams(cancelUrl, {
              orderId,
            }),
        metadata: quantumPaymentMetadata,
        payment_intent_data: {
          metadata: quantumPaymentMetadata,
        },
      });

      return {
        success: true,
        data: {
          sessionId: session.id,
          url: session.url,
          orderId,
        },
      };
    } catch (err: any) {
      console.error("[createQuantumStripePayment] error:", err);
      return { success: false, error: err.message };
    }
  }

  //helpers
}
