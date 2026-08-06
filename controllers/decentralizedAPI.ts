import { Request, Response } from "express";
import axios from "axios";
import {
  addDEXUserRewards,
  OrderOperations,
} from "../platform/order.operations";
import { StripeOperations } from "../platform/stripe.operations";
import { TxOperations } from "../platform/tx.operations";
import { UserOperations } from "../platform/user.operations";
import { AppSettingsService } from "../services/appSettings.service";
import { CurrencyService } from "../services/currency.service";
import { OrderService } from "../services/order.service";
import { UserService } from "../services/user.service";
import { WalletOperations } from "../platform/wallet.operations";
const currencyService: CurrencyService = new CurrencyService();
const appSettingsService: AppSettingsService = new AppSettingsService();
const orderService: OrderService = new OrderService();
const uservice: UserService = new UserService();
export class DEXController {
  constructor() {}

  get selectCurrencyTable() {
    return {
      currencyType: 1,
      code: 1,
      text: 1,
      isActive: 1,
      buyPrice: 1,
      sellPrice: 1,
      min: 1,
      max: 1,
      type: 1,
      fees: 1,
    };
  }

  async getSettings(req: Request, res: Response) {
    try {
      const settings = await appSettingsService.getSettings();
      if (settings) {
        return res.status(200).json(settings);
      } else {
        return res.status(500).json({} as any);
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async orderMinMax(req: Request, res: Response) {
    try {
      console.log("code", req.body.currency);
      console.log("code", req.body.orderType);
      const settings = await currencyService.findOne({
        code: req.body.currency,
        type: req.body.orderType,
      });
      res.status(200);
      res.send(settings);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async registerUser(req: any, res: any) {
    try {
      let { userWalletAddress } = req.body;
      if (!userWalletAddress || userWalletAddress == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      console.log(req.body);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.registerDEXUser(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createExchange(req: any, res: any) {
    try {
      let {
        userWalletAddress,
        inCurr,
        inAmount,
        outCurr,
        outAmount,
        orderType,
        orderRate,
        metaMaskAddress,
        blockchain,
      } = req.body;
      if (
        !userWalletAddress ||
        userWalletAddress == undefined ||
        !inCurr ||
        inCurr == undefined ||
        !inAmount ||
        inAmount == undefined ||
        !outCurr ||
        outCurr == undefined ||
        !outAmount ||
        outAmount == undefined ||
        !orderType ||
        orderType == undefined ||
        !orderRate ||
        orderRate == undefined ||
        !metaMaskAddress ||
        metaMaskAddress == undefined ||
        !blockchain ||
        blockchain == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.createExchange(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getOrderDetails(req: any, res: any) {
    try {
      let { orderId } = req.params;
      if (!orderId || orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const orderOps = new OrderOperations(req, res);
      let dataResults = await orderOps.getDEXOrderDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async alchemyWebhook(req: any, res: any) {
    try {
      // let { orderId } = req.body;
      // if (!orderId || orderId == undefined) {
      //   res.statusCode = 400;
      //   res.send({ status: 400, data: "Bad Request" });
      //   return;
      // }
      // const orderOps = new OrderOperations(req, res);
      // let dataResults = await orderOps.alchemyWebhook(
      //   req,
      //   res,
      // );
      // res.statusCode = dataResults.status;
      // res.send(dataResults);
      const txOps = new TxOperations(req, res);
      console.log("alchemyWebhook", req.body.event.activity);
      const eventLogs = req.body.event.activity[0];
      const orderOps = new OrderOperations(req, res);
      const txHash = eventLogs.hash;
      const coin = eventLogs.asset;
      // let getCoreWallet = await
      // let getRequiredCoin = getUserWallet.userWallets.find(
      //   (x) => x.coinSymbol === coin
      // );
      // let checkStatus = await txOps.checkCoinTransaction(coin, txHash);
      // if (
      //   checkStatus &&
      //   checkStatus.confirmations >= 3 &&
      //   checkStatus.transferedAmount != 0 &&
      //   String(getRequiredCoin?.coinWalletAddress).toLocaleLowerCase ===
      //     String(checkStatus.to).toLocaleLowerCase
      // ) {

      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkDeposit(req: any, res: any) {
    try {
      let { txHash, orderDetails } = req.body;
      if (
        !orderDetails ||
        orderDetails == undefined ||
        !txHash ||
        txHash == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const txOps = new TxOperations(req, res);
      let dataResults = await txOps.checkDeposit(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async confirmExchange(req: any, res: any) {
    try {
      let { orderId } = req.body;
      if (!orderId || orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const txOps = new TxOperations(req, res);
      let dataResults = await txOps.confirmExchange(req, res);
      let getOrder = await orderService.findOne({ orderId: req.body.orderId });
      let getUser = await uservice.findOne({ _id: getOrder.user.userId });

      //add rewards
      let updateRewards = await addDEXUserRewards(
        getOrder.receiverAccount.userReceiveAddress,
        req.body.orderId,
        getOrder.usdValue
      );
      console.log(updateRewards);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkAndConfirmExchange(req: any, res: any) {
    try {
      let { orderId } = req.body;
      if (!orderId || orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const txOps = new TxOperations(req, res);
      let dataResults = await txOps.checkandconfirmExchange(req, res);
      let getOrder = await orderService.findOne({ orderId: req.body.orderId });
      let getUser = await uservice.findOne({ _id: getOrder.user.userId });
      
      //add rewards
      let updateRewards = await addDEXUserRewards(
        getOrder.receiverAccount.userReceiveAddress,
        req.body.orderId,
        getOrder.usdValue
      );
      console.log(updateRewards);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createStripePaymentIntent(req: any, res: any) {
    try {
      let orderAmount = req.body.amount * 100;
      let orderId = req.body.orderId;
      if (
        orderAmount == undefined ||
        !orderAmount ||
        orderId == undefined ||
        !orderId
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const stripeOps = new StripeOperations();
      let paymentIntent = await stripeOps.createDEXStripePayment(req, res);
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

  async updateStripePaymentIntent(req: any, res: any) {
    try {
      const stripeOps = new StripeOperations();
      console.log("i am here");
      const dataResults = await stripeOps.updateDEXStripePayment(req, res);
      res.statusCode = 200;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getTradeToEarnRewards(req: any, res: any) {
    try {
      let { userWalletAddr } = req.params;
      if (!userWalletAddr || userWalletAddr == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getDEXUserRewardDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async withdrawRewards(req: any, res: any) {
    try {
      const userWallerAddress = req.body.userWallerAddress;
      const amount = req.body.amount;
      if (
        userWallerAddress == undefined ||
        amount == undefined ||
        !userWallerAddress ||
        !amount
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.withdrawDEXRewards(req, res);
      console.log(dataResults);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async paypalWebhookupdateOrder(req: any, res: any) {
    try {
      let { orderId, status } = req.body;
      if (!orderId || orderId == undefined || !status || status == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const orderOps = new OrderOperations(req, res);
      let orderDetails = await orderOps.getDEXOrderDetailsByOrderId(orderId);
      const txOps = new TxOperations(req, res);
      let dataResults = await txOps.processDEXBuyOrderByPaypal(orderDetails);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async startBlockchainSubscribe(req: any, res: any) {
    try {
      const orderId = req.body.orderId;
      if (!orderId || orderId === undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const txOps = new TxOperations(req, res);
      let dataResults = await txOps.startDEXBlockchainSubscribe(orderId);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createBlockCypherWebHook(req: any, res: any) {
    try {
      let webhookData = {
        event: "unconfirmed-tx",
        address: req.body.address,
        url: "https://api.indexx.ai/api/v1/dex/user/webhook",
      };
      const response = await axios.post(
        "https://api.blockcypher.com/v1/btc/main/hooks?token=" +
          "b2be5d16315b4e5389fe7a8066e7720c",
        JSON.stringify(webhookData)
      );
      console.log(`Webhook created: ${response.data.id}`);
      res.statusCode = 200; //dataResults.status;
      res.send(response.data);
      return;
    } catch (err) {
      console.error(`Failed to create webhook: ${err}`);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async handleWebhook(req: any, res: any) {
    try {
      const unconfirmedTransaction = req.body;
      console.log(unconfirmedTransaction);
    } catch (err) {
      console.log(err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async generateBitcoinAddress(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      const dataResults = await walletOps.createBitcoinWalletForDexUser();
      console.log(`wallet created: ${dataResults}`);
      res.statusCode = 200; //dataResults.status;
      res.send(dataResults.data);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
}
