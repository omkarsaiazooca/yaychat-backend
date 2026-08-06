import axios, { AxiosResponse } from "axios";
import { Request, Response } from "express";
import { createClient } from "redis";
import { keys } from "../config/keys";
import { getCryptoPriceBySymobl } from "../controllers/priceAPI";
import { UserWallet } from "../data/user";
import { IndexxService } from "../services/IndexxTokens.service";
import { CurrencyService } from "../services/currency.service";
import { OrderService } from "../services/order.service";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";

const indexxService: IndexxService = new IndexxService();
const currencyService: CurrencyService = new CurrencyService();
const uservice: UserService = new UserService();
const orderService: OrderService = new OrderService();
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com",
    port: 11678,
  },
});
interface Item {
  value: number;
  valueInUSD: number;
}

interface RedemptionOption {
  item: Item;
  quantity: number;
}

interface Redemption {
  redeemOptions: RedemptionOption[];
  remainingValue: number;
}

type RedemptionVariant = {
  options: RedemptionOption[];
  remainingBalance: number;
};

interface StockResponse {
  values?: { close: string }[];
  [key: string]: any;
}

export class GiftCardOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async getRedeemAbleItems(req: any, res: any, giftCardData: any) {
    try {
      console.log(giftCardData);
      const btcToUsdRate = await getCryptoPriceBySymobl("BTC"); // Conversion rate for BTC to USD
      const ethToUsdRate = await getCryptoPriceBySymobl("ETH"); // Conversion rate for ETH to USD

      const giftCardValue = giftCardData.amount - (giftCardData.amount * 0.05); // subtract 5% for gas fees this is only of Matic chain, for ethereum we need to increase this
      console.log(giftCardValue);
      let items: Item[] = [];
      if (giftCardData.type === "BTC") {
        const bitcoinBlack = {
          value: 1,
          valueInUSD: btcToUsdRate.data.lastPrice,
        };
        const bitcoinPurple = {
          value: 0.5,
          valueInUSD: 0.5 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinBlue = {
          value: 0.25,
          valueInUSD: 0.25 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinGreen = {
          value: 0.1,
          valueInUSD: 0.1 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinPink = {
          value: 0.01,
          valueInUSD: 0.01 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinOrange = {
          value: 0.001,
          valueInUSD: 0.001 * btcToUsdRate.data.lastPrice,
        };

        items.push(bitcoinBlack);
        items.push(bitcoinPurple);
        items.push(bitcoinBlue);
        items.push(bitcoinGreen);
        items.push(bitcoinPink);
        items.push(bitcoinOrange);

        items.sort((a, b) => b.valueInUSD - a.valueInUSD); // sort items by value in USD in descending order

        console.log(items);

        const redeemOptions: RedemptionOption[] = [];
        let remainingValue = giftCardValue * 0.8; // 80% for XNFT
        const remainingBalance = giftCardValue * 0.15; // 15% for INEX tokens
        let remainingValueIntoINEX = 0;
        items.forEach((item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let quantity = Math.floor(remainingValue / item.valueInUSD);
          redeemOptions[i].quantity += quantity;
          console.log(remainingValue, "remainingValue");
          console.log(quantity, "quantity");
          console.log(item.valueInUSD, "item.valueInUSD");
          remainingValue -= quantity * item.valueInUSD;
        }

        console.log(remainingValue, "final remainingValue");
        remainingValueIntoINEX = remainingValue;
        console.log(remainingBalance, "final remainingBalance 0.2");
        if (redeemOptions.every((option) => option.quantity === 0)) {
          remainingValue = 0; // Set remainingValue to null if no redeemable options
        } else {
          remainingValue += remainingBalance;
        }

        return {
          redeemOptions,
          remainingValue,
          remainingValueIntoINEX,
        };
      } else if (giftCardData.type === "ETH") {
        const ethBlack = {
          value: 1,
          valueInUSD: ethToUsdRate.data.lastPrice,
        };
        const ethPurple = {
          value: 0.5,
          valueInUSD: 0.5 * ethToUsdRate.data.lastPrice,
        };
        const ethBlue = {
          value: 0.25,
          valueInUSD: 0.25 * ethToUsdRate.data.lastPrice,
        };
        const ethGreen = {
          value: 0.1,
          valueInUSD: 0.1 * ethToUsdRate.data.lastPrice,
        };
        const ethPink = {
          value: 0.01,
          valueInUSD: 0.01 * ethToUsdRate.data.lastPrice,
        };
        const ethOrange = {
          value: 0.001,
          valueInUSD: 0.001 * ethToUsdRate.data.lastPrice,
        };

        items.push(ethBlack);
        items.push(ethPurple);
        items.push(ethBlue);
        items.push(ethGreen);
        items.push(ethPink);
        items.push(ethOrange);

        items.sort((a, b) => b.valueInUSD - a.valueInUSD); // sort items by value in USD in descending order

        console.log(items);

        const redeemOptions: RedemptionOption[] = [];
        let remainingValue = giftCardValue * 0.8; // 80% for XNFT
        const remainingBalance = giftCardValue * 0.15; // 20% for INEX tokens
        let remainingValueIntoINEX = 0;
        items.forEach((item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let quantity = Math.floor(remainingValue / item.valueInUSD);
          redeemOptions[i].quantity += quantity;
          console.log(remainingValue, "remainingValue");
          console.log(quantity, "quantity");
          console.log(item.valueInUSD, "item.valueInUSD");
          remainingValue -= quantity * item.valueInUSD;
        }

        console.log(remainingValue, "final remainingValue");
        remainingValueIntoINEX = remainingValue;
        console.log(remainingBalance, "final remainingBalance 0.2");
        if (redeemOptions.every((option) => option.quantity === 0)) {
          remainingValue = 0; // Set remainingValue to null if no redeemable options
        } else {
          remainingValue += remainingBalance;
        }

        return {
          redeemOptions,
          remainingValue,
          remainingValueIntoINEX,
        };
      } else if (giftCardData.type === "XUSD") {
        const redeemOptions: RedemptionOption[] = [];
        let remainingValue = giftCardValue * 0.8; // 80% for XNFT
        const remainingBalance = giftCardValue * 0.15; // 20% for INEX tokens
        const xusd = {
          value: 1,
          valueInUSD: 1,
        };

        items.push(xusd);

        items.sort((a, b) => b.valueInUSD - a.valueInUSD); // sort items by value in USD in descending order

        console.log(items);
        items.forEach((item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let quantity = Math.floor(remainingValue / item.valueInUSD);
          redeemOptions[i].quantity += quantity;
          console.log(remainingValue, "remainingValue");
          console.log(quantity, "quantity");
          console.log(item.valueInUSD, "item.valueInUSD");
          remainingValue -= quantity * item.valueInUSD;
        }

        console.log(remainingValue, "final remainingValue");
        console.log(remainingBalance, "final remainingBalance 0.2");
        if (redeemOptions.every((option) => option.quantity === 0)) {
          remainingValue = 0; // Set remainingValue to null if no redeemable options
        } else {
          remainingValue += remainingBalance;
        }

        return {
          redeemOptions,
          remainingValue,
        };
      } else {
        throw new Error("Type does not support");
      }
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async getXNFTRedeemAbleItems(req: any, res: any, giftCardData: any) {
    try {
      console.log(giftCardData);
      const btcToUsdRate = await getCryptoPriceBySymobl("BTC"); // Conversion rate for BTC to USD
      const ethToUsdRate = await getCryptoPriceBySymobl("ETH"); // Conversion rate for ETH to USD

      const giftCardValue = giftCardData.amount;
      console.log(giftCardValue);
      console.log(giftCardData.type.includes("BTC"));
      let items: Item[] = [];
      if (giftCardData.type.includes("BTC")) {
        const bitcoinBlack = {
          value: 1,
          valueInUSD: btcToUsdRate.data.lastPrice,
        };
        const bitcoinPurple = {
          value: 0.5,
          valueInUSD: 0.5 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinBlue = {
          value: 0.25,
          valueInUSD: 0.25 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinGreen = {
          value: 0.1,
          valueInUSD: 0.1 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinPink = {
          value: 0.01,
          valueInUSD: 0.01 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinOrange = {
          value: 0.001,
          valueInUSD: 0.001 * btcToUsdRate.data.lastPrice,
        };

        const btcValue =
          giftCardValue === 1
            ? bitcoinBlack?.valueInUSD
            : giftCardValue === 0.5
            ? bitcoinPurple?.valueInUSD
            : giftCardValue === 0.25
            ? bitcoinBlue?.valueInUSD
            : giftCardValue === 0.1
            ? bitcoinGreen?.valueInUSD
            : giftCardValue === 0.01
            ? bitcoinPink?.valueInUSD
            : bitcoinOrange?.valueInUSD;
        const redeemOptions: RedemptionOption[] = [];
        const item = {
          value: giftCardValue,
          valueInUSD: btcValue,
        };
        const redeemOp = {
          item: item,
          quantity: 1,
        };
        redeemOptions.push(redeemOp);
        let remainingValueIntoINEX = btcValue * 0.15; // 15% for INEX tokens

        return {
          redeemOptions,
          remainingValueIntoINEX,
          usdValue: btcValue,
        };
      } else if (giftCardData.type.includes("ETH")) {
        const ethBlack = {
          value: 1,
          valueInUSD: ethToUsdRate.data.lastPrice,
        };
        const ethPurple = {
          value: 0.5,
          valueInUSD: 0.5 * ethToUsdRate.data.lastPrice,
        };
        const ethBlue = {
          value: 0.25,
          valueInUSD: 0.25 * ethToUsdRate.data.lastPrice,
        };
        const ethGreen = {
          value: 0.1,
          valueInUSD: 0.1 * ethToUsdRate.data.lastPrice,
        };
        const ethPink = {
          value: 0.01,
          valueInUSD: 0.01 * ethToUsdRate.data.lastPrice,
        };
        const ethOrange = {
          value: 0.001,
          valueInUSD: 0.001 * ethToUsdRate.data.lastPrice,
        };

        const ethValue =
          giftCardValue === 1
            ? ethBlack?.valueInUSD
            : giftCardValue === 0.5
            ? ethPurple?.valueInUSD
            : giftCardValue === 0.25
            ? ethBlue?.valueInUSD
            : giftCardValue === 0.1
            ? ethGreen?.valueInUSD
            : giftCardValue === 0.01
            ? ethPink?.valueInUSD
            : ethOrange?.valueInUSD;
        const redeemOptions: RedemptionOption[] = [];
        const item = {
          value: giftCardValue,
          valueInUSD: ethValue,
        };
        const redeemOp = {
          item: item,
          quantity: 1,
        };
        redeemOptions.push(redeemOp);
        let remainingValueIntoINEX = ethValue * 0.15; // 15% for INEX tokens

        return {
          redeemOptions,
          remainingValueIntoINEX,
          usdValue: ethValue,
        };
      } else {
        throw new Error("Type does not support");
      }
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async getStockRedeemAbleItems(req: any, res: any, giftCardData: any) {
    try {
      console.log(giftCardData);
      const getStockVale = await this.fetchStockPrice(giftCardData.type); //100

      const giftCardValue = giftCardData.amount;
      console.log(giftCardValue);
      // let c =
      //   giftCardData.type === "APPL"
      //     ? "IAPPL"
      //     : giftCardData.type === "AMZN"
      //     ? "IAMZN"
      //     : giftCardData.type === "BCM"
      //     ? "IBCM"
      //     : giftCardData.type === "GOOGL"
      //     ? "IGOOGL"
      //     : giftCardData.type === "META"
      //     ? "IMETA"
      //     : giftCardData.type === "MSFT"
      //     ? "IMSFT"
      //     : giftCardData.type === "NVDA"
      //     ? "INVDA"
      //     : giftCardData.type === "PEP"
      //     ? "IPEP"
      //     : giftCardData.type === "SNP500"
      //     ? "ISNP500"
      //     : "ITLSA";
      switch (true) {
        case giftCardData.type.includes("APPL"):
        case giftCardData.type.includes("TLSA"):
        case giftCardData.type.includes("META"):
        case giftCardData.type.includes("NVDA"):
        case giftCardData.type.includes("AMZN"):
        case giftCardData.type.includes("SNP500"):
        case giftCardData.type.includes("BCM"):
        case giftCardData.type.includes("GOOGL"):
        case giftCardData.type.includes("MSFT"):
        case giftCardData.type.includes("PEP"):
          const redeemValue = (giftCardData.amount / getStockVale) * 1000; // Total tokens
          return {
            redeemValue: redeemValue + " " + giftCardData.type,
            getStockVale,
          };
        default:
          throw new Error("Type does not support");
      }
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async redeemCoupon(
    req: any,
    res: any,
    giftCardOptions: any,
    giftCardData: any,
    toAddress: any
  ) {
    try {
      console.log(giftCardOptions, giftCardData, toAddress);
      let INEXPrice = await currencyService.findOne({
        code: "INEX",
        type: "BUY",
      });
      let indexxExTokenPrice = INEXPrice.buyPrice;
      let indexxExAmountToTransfer =
        giftCardOptions.remainingValue / indexxExTokenPrice;
      let transferResults = {
        INEXtx: "",
        XNFTtx: [] as any[],
      };
      //Transfer Indexx tokens to remainingVale
      let indexxExTransfer =
        await indexxService.transferMainIndexxExchangebyAdmimForGiftCard(
          toAddress,
          indexxExAmountToTransfer * 2, //transfer 2 times of total worth of INEX tokens as per the requirement
          giftCardData.voucher,
          "Gift Card Claim by User",
          "Gift Card Claim",
          "From XNFT"
        );
      console.log(indexxExTransfer);
      transferResults.INEXtx = indexxExTransfer.data.transactionHash;
      if (giftCardData.type === "ETH") {
        //Transfer XNFT tokens based on the options
        let XNFTs =
          await indexxService.transferMainMaticETHXNFTbyAdmimForGiftCard(
            toAddress,
            0,
            giftCardData.voucher,
            "Gift Card Claim by User",
            "Gift Card Claim",
            "From XNFT",
            giftCardOptions
          );
        console.log(XNFTs, "XNFTs");
        for (let index = 0; index < XNFTs?.data.length; index++) {
          transferResults.XNFTtx.push(
            String(XNFTs?.data[index].transactionHash)
          );
        }
      } else if (giftCardData.type === "BTC") {
        //Transfer XNFT tokens based on the options
        let XNFTs =
          await indexxService.transferMainMaticBTCXNFTbyAdmimForGiftCard(
            toAddress,
            0,
            giftCardData.voucher,
            "Gift Card Claim by User",
            "Gift Card Claim",
            "From XNFT",
            giftCardOptions
          );
        console.log(XNFTs, "XNFTs");
        for (let index = 0; index < XNFTs?.data.length; index++) {
          transferResults.XNFTtx.push(
            String(XNFTs?.data[index].transactionHash)
          );
        }
      } else if (giftCardData.type === "XUSD") {
        //Transfer XNFT tokens based on the options
        let XNFTs =
          await indexxService.transferMainMaticXUSDNFTbyAdmimForGiftCard(
            toAddress,
            0,
            giftCardData.voucher,
            "Gift Card Claim by User",
            "Gift Card Claim",
            "From XNFT",
            giftCardOptions
          );
        console.log(XNFTs, "XNFTs");
        for (let index = 0; index < XNFTs?.data.length; index++) {
          transferResults.XNFTtx.push(
            String(XNFTs?.data[index].transactionHash)
          );
        }
      }
      return transferResults;
    } catch (err) {
      return err;
    }
  }

  async redeemXNFTCoupon(
    req: any,
    res: any,
    giftCardOptions: any,
    giftCardData: any,
    toAddress: any
  ) {
    try {
      console.log(giftCardOptions, giftCardData, toAddress);
      let INEXPrice = await currencyService.findOne({
        code: "INEX",
        type: "BUY",
      });
      let indexxExTokenPrice = INEXPrice.buyPrice;
      let indexxExAmountToTransfer = giftCardOptions.remainingValueIntoINEX;
      let transferResults = {
        INEXtx: "",
        XNFTtx: [] as any[],
      };
      console.log(toAddress, indexxExAmountToTransfer * 2, giftCardOptions);
      //Transfer Indexx tokens to remainingVale
      let indexxExTransfer =
        await indexxService.transferMainIndexxExchangebyAdmimForGiftCard(
          toAddress,
          indexxExAmountToTransfer * 2, //transfer 2 times of total worth of INEX tokens as per the requirement
          giftCardData.voucher,
          "XNFT Card Claim by User",
          "XNFT Card Claim",
          "From XNFT"
        );
      console.log(indexxExTransfer);
      transferResults.INEXtx = indexxExTransfer.data.transactionHash;
      if (giftCardData.type.includes("ETH")) {
        //Transfer XNFT tokens based on the options
        let XNFTs =
          await indexxService.transferMainMaticETHXNFTbyAdmimForXNFTCard(
            toAddress,
            0,
            giftCardData.voucher,
            "XNFT Card Claim by User",
            "XNFT Card Claim",
            "From XNFT",
            giftCardOptions
          );
        console.log(XNFTs, "XNFTs");
        for (let index = 0; index < XNFTs?.data.length; index++) {
          transferResults.XNFTtx.push(
            String(XNFTs?.data[index].transactionHash)
          );
        }
      } else if (giftCardData.type.includes("BTC")) {
        //Transfer XNFT tokens based on the options
        let XNFTs =
          await indexxService.transferMainMaticBTCXNFTbyAdmimForXNFTCard(
            toAddress,
            0,
            giftCardData.voucher,
            "XNFT Card Claim by User",
            "XNFT Card Claim",
            "From XNFT",
            giftCardOptions
          );
        console.log(XNFTs, "XNFTs");
        for (let index = 0; index < XNFTs?.data.length; index++) {
          transferResults.XNFTtx.push(
            String(XNFTs?.data[index].transactionHash)
          );
        }
      }
      return transferResults;
    } catch (err) {
      return err;
    }
  }

  async withdrawStockToken(
    req: any,
    res: any,
    amount: any,
    type: any,
    toAddress: any
  ) {
    try {
      const getStockVale = await this.fetchStockPrice(type);
      let transferResults = {
        data: {
          tx: "",
        },
        status: 200,
      };
      const redeemValue = (amount / getStockVale) * 1000; // Total tokens
      let contractAddress = "";
      switch (true) {
        case type.includes("APPL"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxAppleContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxAppleContract.key;
          }
          break;
        case type.includes("TLSA"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxTelsaContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxTelsaContract.key;
          }
          break;
        case type.includes("META"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxMetaContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxMetaContract.key;
          }
          break;
        case type.includes("NVDA"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxNividiaContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxNividaContract.key;
          }
          break;
        case type.includes("AMZN"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxAmazonContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxAmazonContract.key;
          }
          break;
        case type.includes("INX"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxSNP500Contract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxSNP500Contract.key;
          }
          break;
        case type.includes("BCM"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxBroadcomContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxBroadcomContract.key;
          }
          break;
        case type.includes("GOOGL"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxGoogleContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxGoogleContract.key;
          }
          break;
        case type.includes("MSFT"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxMicrosoftContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxMicrsoftContract.key;
          }
          break;
        case type.includes("PEP"):
          if (keys.env.key == "prod") {
            contractAddress = keys.MainIndexxPepsiCoContract.key;
          } else if (keys.env.key == "test" || keys.env.key == "development") {
            contractAddress = keys.TestIndexxPepsiCoContract.key;
          }
          break;
        default:
          throw new Error("Type does not support");
      }
      let transferStocks =
        await indexxService.transferIndexxStockbyAdminBNBChain(
          toAddress,
          redeemValue,
          "CEX",
          contractAddress
        );
      console.log(transferStocks);
      transferResults.data.tx = transferStocks.data.txHash;
      return transferResults;
    } catch (err) {
      return {
        data: {
          tx: "",
        },
        status: 500,
      };
    }
  }

  async redeemStockCouponBinanceChain(
    req: any,
    res: any,
    options: any,
    giftCard: any,
    email: any
  ) {
    try {
      const getStockVale = await this.fetchStockPrice(giftCard.type);
      let getUser = await uservice.findOne({
        email: email,
      });
      let c =
        giftCard.type === "APPL"
          ? "APPL"
          : giftCard.type === "AMZN"
          ? "AMZN"
          : giftCard.type === "BCM"
          ? "BCM"
          : giftCard.type === "GOOGL"
          ? "GOOGL"
          : giftCard.type === "META"
          ? "META"
          : giftCard.type === "MSFT"
          ? "MSFT"
          : giftCard.type === "NVDA"
          ? "NVDA"
          : giftCard.type === "PEP"
          ? "PEP"
          : giftCard.type === "SNP500"
          ? "SNP500"
          : "TLSA";
      const redeemValue = (giftCard.amount / getStockVale) * 1000; // Total tokens
      let getCoin = getUser.userWallets.find(
        (x) => x.coinSymbol === c && x.coinNetwork === "Binance Smart Chain"
      );
      console.log("getcoin", getCoin, c);
      if (getCoin !== undefined) {
        //update user wallet balance
        const wallet = await uservice.updatePart(
          {
            email: email,
            "userWallets.coinSymbol": c,
            "userWallets.coinNetwork": "Binance Smart Chain",
          },
          {
            $set: {
              "userWallets.$.coinLastUsedOn": new Date(),
              "userWallets.$.coinBalance": getCoin.coinBalance + redeemValue,
            },
          }
        );

        if (wallet) {
          return {
            status: 200,
            data: { message: "Redeem Completed" },
          };
        } else {
          return {
            status: 500,
            data: { message: "Internal Server Error" },
          };
        }
      } else {
        let c =
          giftCard.type === "APPL"
            ? "APPL"
            : giftCard.type === "AMZN"
            ? "AMZN"
            : giftCard.type === "BCM"
            ? "BCM"
            : giftCard.type === "GOOGL"
            ? "GOOGL"
            : giftCard.type === "META"
            ? "META"
            : giftCard.type === "MSFT"
            ? "MSFT"
            : giftCard.type === "NVDA"
            ? "NVDA"
            : giftCard.type === "PEP"
            ? "PEP"
            : giftCard.type === "SNP500"
            ? "SNP500"
            : "TLSA";
        //create coin wallet
        if (c == "APPL") {
          orderService
            .createIAppleWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "AMZN") {
          orderService
            .createIAmazonWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "BCM") {
          orderService
            .createIBroadcomWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "GOOGL") {
          orderService
            .createIGoogleWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "META") {
          orderService
            .createIMetaWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "MSFT") {
          orderService
            .createIMicrosoftWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "NVDA") {
          orderService
            .createINividaWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "PEP") {
          orderService
            .createIPespiCoWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "SNP500") {
          orderService
            .createISNP500Wallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        } else if (c == "TLSA") {
          orderService
            .createITelsaWallet(email, c, redeemValue)
            .then((x: any) => {
              console.log(x);
            });
        }
        return {
          status: 200,
          data: { message: "Redeem Completed" },
        };
      }
    } catch (err) {
      console.log("err", err);
      return err;
    }
  }

  async getRedeemAbleItems2(req: any, res: any, giftCardData: any) {
    try {
      console.log(giftCardData);
      const btcToUsdRate = await getCryptoPriceBySymobl("BTC"); // Conversion rate for BTC to USD
      const ethToUsdRate = await getCryptoPriceBySymobl("ETH"); // Conversion rate for ETH to USD

      interface Item {
        value: number;
        valueInUSD: number;
      }

      interface RedemptionVariant {
        item: Item;
        quantity: number;
      }

      interface RedemptionOption {
        options: RedemptionVariant[];
        remainingValue: number;
      }

      const giftCardValue = giftCardData.amount;
      console.log(giftCardValue);
      console.log("getRedeemAbleItems2");
      let items: Item[] = [];
      if (giftCardData.type === "BTC") {
        const bitcoinBlack = {
          value: 1,
          valueInUSD: btcToUsdRate.data.lastPrice,
        };
        const bitcoinPurple = {
          value: 0.5,
          valueInUSD: 0.5 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinBlue = {
          value: 0.25,
          valueInUSD: 0.25 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinGreen = {
          value: 0.1,
          valueInUSD: 0.1 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinPink = {
          value: 0.01,
          valueInUSD: 0.01 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinOrange = {
          value: 0.001,
          valueInUSD: 0.001 * btcToUsdRate.data.lastPrice,
        };

        items.push(bitcoinBlack);
        items.push(bitcoinPurple);
        items.push(bitcoinBlue);
        items.push(bitcoinGreen);
        items.push(bitcoinPink);
        items.push(bitcoinOrange);

        items.sort((a, b) => b.valueInUSD - a.valueInUSD); // sort items by value in USD in descending order

        console.log(items);

        const redeemOptions: RedemptionVariant[] = [];
        const redeemableValue = giftCardValue * 0.8;
        const remainingBalance = giftCardValue * 0.15;
        const redeemVariants: RedemptionOption[] = [];

        items.forEach((item: Item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        console.log("redeemOptions", redeemOptions);
        // Filter items that have a valueInUSD less than the redeemable value
        const viableItems = items.filter(
          (item) => item.valueInUSD <= redeemableValue
        );
        const redeemOptions2 = this.generateCombos(
          viableItems,
          redeemableValue,
          remainingBalance
        );
        console.log(redeemOptions2);

        return {
          redeemOptions,
        };
      } else if (giftCardData.type === "ETH") {
        const ethBlack = {
          value: 1,
          valueInUSD: ethToUsdRate.data.lastPrice,
        };
        const ethPurple = {
          value: 0.5,
          valueInUSD: 0.5 * ethToUsdRate.data.lastPrice,
        };
        const ethBlue = {
          value: 0.25,
          valueInUSD: 0.25 * ethToUsdRate.data.lastPrice,
        };
        const ethGreen = {
          value: 0.1,
          valueInUSD: 0.1 * ethToUsdRate.data.lastPrice,
        };
        const ethPink = {
          value: 0.01,
          valueInUSD: 0.01 * ethToUsdRate.data.lastPrice,
        };
        const ethOrange = {
          value: 0.001,
          valueInUSD: 0.001 * ethToUsdRate.data.lastPrice,
        };

        items.push(ethBlack);
        items.push(ethPurple);
        items.push(ethBlue);
        items.push(ethGreen);
        items.push(ethPink);
        items.push(ethOrange);

        items.sort((a, b) => b.valueInUSD - a.valueInUSD); // sort items by value in USD in descending order

        console.log(items);

        const redeemOptions: RedemptionVariant[] = [];
        const redeemableValue = giftCardValue * 0.8;
        const remainingBalance = giftCardValue * 0.15;
        const redeemVariants: RedemptionOption[] = [];

        items.forEach((item: Item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        console.log("redeemOptions", redeemOptions);
        // Filter items that have a valueInUSD less than the redeemable value
        const viableItems = items.filter(
          (item) => item.valueInUSD <= redeemableValue
        );
        const redeemOptions2 = await this.generateCombos(
          viableItems,
          redeemableValue,
          remainingBalance
        );
        console.log(redeemOptions2);

        return {
          redeemOptions,
        };
      } else {
        console.log("i am in else");
        return 0;
      }
      return 1;
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async getUserWalletAndCheckHasBalance(
    req: any,
    res: any,
    email: string,
    coin: string,
    network: string,
    withdrawAmount: number
  ) {
    try {
      let getUser = await uservice.findOne({
        email: email,
      });
      let getCoin = getUser.userWallets.find(
        (x) => x.coinSymbol === coin && x.coinNetwork === network
      ) as UserWallet;

      if (getCoin.coinBalance >= withdrawAmount) {
        return {
          status: 200,
          data: "Balance avaliable",
        };
      } else {
        return {
          status: 500,
          data: "No Balance avaliable",
        };
      }
    } catch (err) {
      return {
        status: 500,
        data: "No balance avalible or Error",
      };
    }
  }

  async updateWalletAndCheckHasBalance(
    req: any,
    res: any,
    email: string,
    coin: string,
    network: string,
    withdrawAmount: number
  ) {
    try {
      let getUser = await uservice.findOne({
        email: email,
      });
      let getCoin = getUser.userWallets.find(
        (x) => x.coinSymbol === coin && x.coinNetwork === network
      ) as UserWallet;

      if (getCoin.coinBalance >= withdrawAmount) {
        await uservice.updatePart(
          {
            email: email,
            userWallets: { $elemMatch: { coinSymbol: coin } },
          },
          {
            $set: {
              "userWallets.$.coinBalance": getCoin.coinBalance - withdrawAmount,
            },
          }
        );
        return {
          status: 200,
          data: "Updated User Balance",
        };
      } else {
        return {
          status: 500,
          data: "Not Updated User Balance",
        };
      }
    } catch (err) {
      return {
        status: 500,
        data: "Not Updated User Balance or Error",
      };
    }
  }

  // Generate possible combinations
  async generateCombos(
    items: Item[],
    redeemableValue: number,
    remainingBalance: number,
    currentIndex = 0
  ): Promise<RedemptionVariant[]> {
    if (currentIndex === items.length || redeemableValue < 0) {
      return [
        { options: [], remainingBalance: remainingBalance + redeemableValue },
      ];
    }

    let withoutCurrent = await this.generateCombos(
      items,
      redeemableValue,
      remainingBalance,
      currentIndex + 1
    );

    let withCurrent: RedemptionVariant[] = [];
    let quantity = 0;
    let valueWithCurrent = redeemableValue;

    while (valueWithCurrent >= items[currentIndex].valueInUSD) {
      let otherCombos = await this.generateCombos(
        items,
        valueWithCurrent,
        remainingBalance,
        currentIndex + 1
      );
      let currentCombos = otherCombos.map((combo: any) => {
        let updatedOptions = [
          { item: items[currentIndex], quantity: quantity + 1 },
          ...combo.options,
        ];
        let updatedBalance = combo.remainingBalance;
        return { options: updatedOptions, remainingBalance: updatedBalance };
      });
      withCurrent = withCurrent.concat(currentCombos);
      valueWithCurrent = valueWithCurrent - items[currentIndex].valueInUSD;
      quantity = quantity + 1;
    }

    return withoutCurrent.concat(withCurrent);
  }

  async fetchStockPrice(symbol: string) {
    try {
      const endpoint = "https://api.twelvedata.com/time_series";
      await redisClient.connect();

      // Create a unique Redis key based on the interval and symbol
      const redisKey = `stockPriceData:${symbol}`;
      console.log("INX b", symbol)
      if(symbol === "SNP500") {
        symbol = "INX";
      }
      console.log("INX a", symbol)

      const cachedData: string | null = await this.getFromRedis(redisKey);

      // If data found in cache, return it
      if (cachedData) {
        return Number(cachedData);
      }

      if (symbol === "APPL") {
        symbol = "APPL";
      }

      const response: AxiosResponse<StockResponse> = await axios.get(endpoint, {
        params: {
          symbol: symbol,
          interval: "1min",
          apikey: process.env.TWELVE_DATA_API_KEY,
        },
      });
      console.log("response", response.data);
      if (response.data?.values && response.data.values.length > 0) {
        const latestPrice: number = Number(response.data.values[0].close);
        console.log(`The latest price for ${symbol} is $${latestPrice}`);

        // Store in Redis and set expiration
        redisClient.set(redisKey, latestPrice.toString());
        redisClient.expire(redisKey, 86400);

        await redisClient.quit(); // Gracefully close Redis connection
        return latestPrice;
      } else {
        await redisClient.quit(); // Gracefully close Redis connection
        console.log(`Failed to fetch data for ${symbol}`);
        return 0;
      }
    } catch (error: any) {
      await redisClient.quit(); // Gracefully close Redis connection
      console.error(`Error: ${error.message}`);
      return 0;
    }
  }

  async getFromRedis(key: string): Promise<any> {
    const cachedResult = await redisClient.get(key);
    if (cachedResult !== null) {
      await redisClient.quit();
      return cachedResult;
    }
  }
}

/*

 // for (let item of items) {
        //   if (item.valueInUSD <= redemption.remainingValue) {
        //     let quantity = Math.floor(
        //       redemption.remainingValue / item.valueInUSD
        //     );
        //     redemption.redeemItems[item.value.toString()] = quantity;
        //     redemption.remainingValue -= quantity * item.valueInUSD;
        //   } else {
        //     redemption.redeemItems[item.value] = 0;
        //   }
        // }

        // redemption.remainingValue =
        //   initialRemainingValue + redemption.remainingValue;

        /*
        for (let itemToMaximize of items) {
          let redeemableValue: number = giftCardValue * 0.6;
          const initialRemainingValue: number = giftCardValue * 0.4;
          let redemption: Redemption = {
            redeemItems: {},
            remainingValue: redeemableValue,
          };

          for (let item of items) {
            if (
              item.value === itemToMaximize.value &&
              item.valueInUSD <= redemption.remainingValue
            ) {
              let quantity = Math.floor(
                redemption.remainingValue / item.valueInUSD
              );
              redemption.redeemItems[item.value.toString()] = quantity;
              redemption.remainingValue -= quantity * item.valueInUSD;
            }
          }

          for (let item of items) {
            if (
              item.value !== itemToMaximize.value &&
              item.valueInUSD <= redemption.remainingValue
            ) {
              let quantity = Math.floor(
                redemption.remainingValue / item.valueInUSD
              );
              redemption.redeemItems[item.value.toString()] = quantity;
              redemption.remainingValue -= quantity * item.valueInUSD;
            }
          }

          redemption.remainingValue += initialRemainingValue;

          redemptionOptions.push(redemption);
        }
*/
/*
        for (let i = 0; i < items.length; i++) {
          let redemption: Redemption = {
            redeemItems: {},
            remainingValue: redeemableValue,
          };

          for (let j = i; j < items.length; j++) {
            let item = items[j];

            if (item.valueInUSD <= redemption.remainingValue) {
              let quantity = Math.floor(
                redemption.remainingValue / item.valueInUSD
              );
              redemption.redeemItems[item.value.toString()] = quantity;
              redemption.remainingValue -= quantity * item.valueInUSD;
            }
          }

          redemption.remainingValue += initialRemainingValue;
          redemptionOptions.push(redemption);
        } */

/*
        for (let i = 0; i < items.length; i++) {
          let redemption: Redemption = {
            redeemItems: {},
            remainingValue: redeemableValue,
          };

          for (let j = i; j < items.length; j++) {
            let item = items[j];

            if (item.valueInUSD <= redemption.remainingValue) {
              let quantity = Math.min(
                1,
                Math.floor(redemption.remainingValue / item.valueInUSD)
              );
              redemption.redeemItems[item.value.toString()] = quantity;
              redemption.remainingValue -= quantity * item.valueInUSD;
            }
          }

          redemption.remainingValue += initialRemainingValue;
          redemptionOptions.push(redemption);
        }*/

/*
        const redeemItems: { [key: string]: number } = {};
        items.forEach((item) => {
          redeemItems[item.value.toString()] = 0;
        });

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = Math.floor(remainingValue / item.valueInUSD);
            redeemItems[item.value.toString()] += quantity;
            remainingValue -= quantity * item.valueInUSD;
          }
        */
/*
        const redeemOptions: RedemptionOption[] = [];
        let remainingValue = giftCardValue * 0.6;
        const remainingBalance = giftCardValue * 0.4;

        items.forEach((item) => {
          redeemOptions.push({ item, quantity: 0 });
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const quantity = Math.floor(remainingValue / item.valueInUSD);
          redeemOptions[i].quantity += quantity;
          remainingValue -= quantity * item.valueInUSD;
        }

        remainingValue += remainingBalance;

        console.log(redeemOptions, remainingValue);*/
