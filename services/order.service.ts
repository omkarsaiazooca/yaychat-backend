import ECPairFactory from "ecpair";
import Wallet from "ethereumjs-wallet";
import * as ecc from "tiny-secp256k1";
import { keys } from "../config/keys";
import { getPriceByName } from "../controllers/priceAPI";
import { CurrencyType } from "../data/common";
import { Order, OrderStatus } from "../data/order";
import { User, UserWallet } from "../data/user";
import orderSchema, { OrderModel } from "../models/order";
import { UserService } from "../services/user.service";
import { IndexxService } from "./IndexxTokens.service";
import { ServiceBase } from "./base";
import { encryptData } from "./crypto.service";
import { CurrencyService } from "./currency.service";
import { AffilateService } from "./affiliate.service";
import {
  calculateAndUpdateCommissionForCaptains,
  calculateCommissionInINEX,
  calculateFamilyRank,
  calculateRankAndCommission,
  getAllTeamMemberRanks,
} from "../data/rankStucture";
import * as StellarSdk from "@stellar/stellar-sdk";
import { v1 as uuidv1 } from "uuid";
import { CommissionService } from "./commission.service";
import { Network } from "bitcoinjs-lib";
import { Wallet as XRPWallet } from "xrpl";
import {
  Bip32PrivateKey,
  ByronAddress,
  Ed25519KeyHash,
  EnterpriseAddress,
  RewardAddress,
  StakeCredential,
  TransactionOutput,
} from "@emurgo/cardano-serialization-lib-nodejs";
import { Keypair } from "@solana/web3.js";
import { Staking } from "../data/staking";
import { StakingService } from "./staking.service";
import { getLatestPriceOfETF } from "../platform/etf.operations";
import { TransactionService } from "./transaction.service";
import { NonPaypalSubscriptionService } from "./nonPaypalSubscription.service";
import { ProfitLogService } from "./profitLog.service";
import { SmartCryptoService } from "./smartCrypto.service";
import { Transaction } from "../data/transaction";
import { getConfiguredBtcyFeePercent } from "../helpers/btcyFees";
import { SendEmail } from "../platform/email.operations";
import { AppSettingsService } from "./appSettings.service";
import { NewGiftCard } from "../data/newGiftCard";
import { NewGiftCardService } from "./newGiftCard.service";
import { MiningService } from "./mining.service";
import { SubscriptionService } from "./subscription.service";
import { SubscriptionPlansService } from "./miningSubscriptionPlan.service";
import { BTCYBuyHistoryService } from "./btcyBuyHistory.service";
import {
  applyQuantumBtcyBonusIfNeeded,
  appendQuantumBtcyBonusNote,
} from "../helpers/quantumBtcyBonus";
//import { addRewards } from "../platform/order.operations";
const profitAccountEmail = "wallet@azooca.com";
const env = keys.env.key;
//const bitcoincashjs = require("bitcoincashjs-lib");
const bitcoincashjs = require("@psf/bitcoincashjs-lib");
const { mnemonicGenerate } = require("@polkadot/util-crypto");
const { Keyring } = require("@polkadot/keyring");
let profitLogService: ProfitLogService = new ProfitLogService();
const uservice: UserService = new UserService();
const indexxService: IndexxService = new IndexxService();
const affilateService: AffilateService = new AffilateService();
const currencyService: CurrencyService = new CurrencyService();
const commissionService: CommissionService = new CommissionService();
const stakingService: StakingService = new StakingService();
const txService: TransactionService = new TransactionService();
let nonPaypalSubscriptionService: NonPaypalSubscriptionService =
  new NonPaypalSubscriptionService();
const bitcoin = require("bitcoinjs-lib");
const ECPair = ECPairFactory(ecc);
const smartCryptoService: SmartCryptoService = new SmartCryptoService();
let transactionService: TransactionService = new TransactionService();
let appSettingsService: AppSettingsService = new AppSettingsService();
const txservice: TransactionService = new TransactionService();
const newGiftCardService: NewGiftCardService = new NewGiftCardService();
const subscriptionPlansService: SubscriptionPlansService =
  new SubscriptionPlansService();
const userSubscriptionService: SubscriptionService = new SubscriptionService();
const miningService: MiningService = new MiningService();
const btcyBuyHistoryService: BTCYBuyHistoryService =
  new BTCYBuyHistoryService();

function isQuantumBtcyOrder(order: any): boolean {
  const comments = String(order?.comments || "").toLowerCase();
  const exchangeName = String(order?.exchangeName || "").toLowerCase();
  const orderId = String(order?.orderId || "");
  const outCurrency = String(order?.breakdown?.outCurrencyName || "").toUpperCase();

  return (
    outCurrency === "BTCY" &&
    (comments.includes("quantum") ||
      exchangeName.includes("cryptopaymentprocessor") ||
      orderId.startsWith("CRYPTO_"))
  );
}

export class OrderService extends ServiceBase<Order, OrderModel> {
  constructor() {
    super(orderSchema, "Order");
  }

  async processOrder(orderDetails: Order) {
    try {
      if (
        orderDetails.orderType == "Buy" ||
        orderDetails.orderType == "MonthlyINEXBuy" ||
        orderDetails.orderType == "AIBuy"
      ) {
        if (orderDetails.breakdown.outCurrencyName == "BTC") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "BTC"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferBitcoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "ETH") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "ETH"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferEthereumbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "LTC") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "LTC"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "XRP") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "XRP"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferEthereumbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "DOGE") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "DOGE"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "USDC") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "USDC"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "CHZ") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "CHZ"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "VET") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "VET"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "BTCY") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "BTCY"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        }
        else if (orderDetails.breakdown.outCurrencyName == "AVAX") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "AVAX"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "THETA") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "THETA"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "NOT") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "NOT"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "FTM") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "FTM"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "RUNE") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "RUNE"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "NEAR") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "NEAR"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "AAVE") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "AAVE"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "INJ") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "INJ"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "PYTH") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "PYTH"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "BEAM") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "BEAM"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "ADA") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "ADA"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "XLM") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "XLM"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "SUI") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "SUI"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "MANA") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "MANA"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "WIBS") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "WIBS"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "USDT") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "USDT"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "MATIC") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "MATIC"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "SOL") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "SOL"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "XRP") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "XRP"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "TON") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "TON"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "DAI") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "DAI"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "LINK") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "LINK"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "SHIB") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "SHIB"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferLitecoinbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (
          orderDetails.breakdown.outCurrencyName.localeCompare("IN500") == 0
        ) {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "IN500"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferIndexx500byAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (
          orderDetails.breakdown.outCurrencyName.localeCompare("INXC") == 0
        ) {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "INXC"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferIndexxCryptobyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "IUSD+") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "IUSD+"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferIndexxUSDPbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "BNB") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "BNB"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferBinancetokenbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "BUSD") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "BUSD"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferBUSDbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "INEX") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "INEX"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferBUSDbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "DaCrazy") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "DaCrazy"
            );
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
            return indexxService.transferBUSDbyAdmin(
              String(userAddress),
              orderDetails.breakdown.outAmount
            );
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "AMZN") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "APPL") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "META") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "MSFT") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "GOOGL") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "PEP") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "BCM") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (
          orderDetails.breakdown.outCurrencyName == "TLSA" ||
          orderDetails.breakdown.outCurrencyName == "TSLA"
        ) {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else if (orderDetails.breakdown.outCurrencyName == "NVDA") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          if (user) {
            await this.updateUserBalance(orderDetails);
            return { status: 200, data: "Order Completed" };
          } else {
            return { status: 500, data: "User not found" };
          }
        } else {
          return { status: 500, data: "Coin Not found" };
        }
      } else if (orderDetails.orderType == "Sell" || orderDetails.orderType == "AISell") {
        console.log("process order for sell");
        if (orderDetails.breakdown.outCurrencyName == "USD") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          let checkUserBal = await this.checkUserWalletBalance(
            user.email,
            orderDetails.breakdown.inCurrenyName
          );
          console.log(checkUserBal);
          if (checkUserBal < orderDetails.breakdown.inAmount) {
            return { status: 500, data: "Insufficient Balance" };
          } else {
            await this.updateUserBalance2(orderDetails);
            //let addTradeToEarn = await addRewards(user.email, orderDetails.orderId);
            return { status: 200, data: "Order processed" };
          }
        } else {
          return { status: 500, data: "Insufficient Balance" };
        }
      } else if (orderDetails.orderType === "SellETF") {
        console.log("process order for sell etf");
        if (orderDetails.breakdown.outCurrencyName == "USD") {
          let user = await uservice.findOne({ _id: orderDetails.user.userId });
          let checkUserBal = await this.checkUserWalletBalance(
            user.email,
            orderDetails.breakdown.inCurrenyName
          );
          console.log(checkUserBal);
          if (checkUserBal < orderDetails.breakdown.inAmount) {
            return { status: 500, data: "Insufficient Balance" };
          } else {
            await this.updateUserBalance2(orderDetails);
            //let addTradeToEarn = await addRewards(user.email, orderDetails.orderId);
            return { status: 200, data: "Order processed" };
          }
        } else {
          return { status: 500, data: "Insufficient Balance" };
        }
      } else if (orderDetails.orderType === "SmartCryptoBuy") {
        // Split the string into parts
        const parts = orderDetails.breakdown.outCurrencyName.split("|");

        // Extract the individual components
        const portfolioName = parts[0];
        const managedBy = parts[1];
        let getSmartCryptoPlan = await smartCryptoService.findOne({
          portfolioName: portfolioName,
          managedBy: managedBy,
          isActive: true,
        });

        let getAllCurrencies = getSmartCryptoPlan.cryptocurrencies;
        let amount = orderDetails.breakdown.inAmount / getAllCurrencies.length;
        console.log("each coin amount", amount);
        for (let index = 0; index < getAllCurrencies.length; index++) {
          const element = getAllCurrencies[index];
          let adminFees = await this.getAdminFees(element.token);
          let finalUsdAmount = amount - (amount * adminFees) / 100;
          let latestBaseRate = await getPriceByName(element.token);
          let rate = latestBaseRate.data;
          let email = orderDetails.user.email;
          let coin = element.token;
          let isStaked = false;
          let stakingPercentage = 0;
          let type = "";
          let txType = "INVESTMENT";
          let amountInvested = amount;
          let notes = `xBBBitcoin Bull-Run-2025 New 2025 Package-Omkar`;
          let fees = adminFees;
          let amountMode = orderDetails.paymentType;
          await this.updateSmartCrypto(
            email,
            coin,
            finalUsdAmount / rate,
            isStaked,
            stakingPercentage,
            type,
            txType,
            amountInvested,
            notes,
            fees,
            amountMode,
            rate
          );
        }
      } else if (orderDetails.orderType === "SmartAPY") {
        //let process = await orderService.processOrder(order);
        let res: any;
        let req = {
          body: {
            email: orderDetails.user.email,
            coin: orderDetails.breakdown.outCurrencyName,
            duration: orderDetails.smartAPYduration,
            amount: orderDetails.breakdown.inAmount,
            percentage: orderDetails.smartAPYPercentage,
            paymentMethod: orderDetails.paymentType,
          },
        } as any;
        // Removed dependency on UserOperations to avoid circular imports.
        // If needed, invoke SmartAPY flow via a dedicated service instead.
        let getNewDetails = await this.findOne({
          orderId: orderDetails.orderId,
        });

        //console.log("93110450", dataResults)

        let dataResults = {
          "message": "Successfully staked IUSD+",
          "status": 200,
          "data": {
            "smartApyId": "1b4dc7e0-274e-11f0-8483-156d993e1d9e",
            "stakedAmount": 10000,
            "rewardAmount": 750,
            "finalAmount": 10750,
            "coin": "IUSD+",
            "rewardCoin": "IUSD+",
            "email": "brownst81@yahoo.com",
            "percentage": 0.15,
            "isActive": true,
            "duration": "6 Months",
            "__v": 0
          }
        }
        // send email to user after completion
        await new SendEmail().sendUSDToIUSDOrderCompleted(
          "omkar@azooca.com",
          "User",
          10000, //getNewDetails.breakdown.outAmount,
          String(orderDetails.smartAPYduration),
          1,
          10000, //getNewDetails.breakdown.inAmount,
          dataResults.data as any,
          getNewDetails.orderId
        );
      } else if (orderDetails.orderType === "GiftCardBuy") {
        let email = orderDetails.user.email;
        const voucherCode = Array.from({ length: 4 }, () =>
          Math.random().toString(36).toUpperCase().substring(2, 6)
        ).join("-");
        let giftCardData: any = orderDetails.giftCardDetails;
        for (let index = 0; index < giftCardData.length; index++) {
          const element = giftCardData[index];
          let userGiftCard = {
            voucher: voucherCode,
            amount: element.amount,
            dateOfGeneration: new Date(),
            isUsed: false,
            type: element.type,
            createdBy: String(email).toLowerCase(),
            createdOn: new Date(),
            giftCardImgUrl: element.giftCardUrl,
            cardType: element.cardType,
          } as NewGiftCard;
          let giftCardDetails = await newGiftCardService.create(userGiftCard);
          //const toEmail = String(recevierEmail).toLowerCase();

          //create a transaction
          let newTx = await txService.create({
            email: email,
            orderId: uuidv1(),
            extRef: "",
            txId: "",
            from: "",
            to: "",
            amount: element.amount,
            info: "Created Gift Card",
            notes: `Gift Card (${voucherCode})`,
            status: OrderStatus.Completed,
            currencyRef: element.currency,
            walletType: "ASSET_WALLET",
            transactionType: "Create Gift",
            exchangeName: "CEX",
            txDate: new Date(),
            benificaryAddress: "",
          });
        }

        let message = "Successfully created gift card";
      } else if (orderDetails.orderType === "FreeTrailOrder") {
        try {
          // Split the string into parts
          const parts = orderDetails.breakdown.outCurrencyName.split("|");

          // Extract the individual components
          const portfolioName = parts[0];
          const managedBy = parts[1];
          console.log("parts", parts);
          let getSmartCryptoPlan = await smartCryptoService.findOne({
            portfolioName: portfolioName,
            managedBy: managedBy,
            isActive: true,
          });

          console.log("getSmartCryptoPlan");
          let getAllCurrencies = getSmartCryptoPlan.cryptocurrencies;
          let freeTrialAmount = 500;
          let amount = freeTrialAmount / getAllCurrencies.length;
          console.log("each coin amount", amount);
          for (let index = 0; index < getAllCurrencies.length; index++) {
            const element = getAllCurrencies[index];
            let adminFees = await this.getAdminFees(element.token);
            let finalUsdAmount = amount - (amount * adminFees) / 100;
            let latestBaseRate = await getPriceByName(element.token);
            let rate = latestBaseRate.data;
            let email = orderDetails.user.email;
            let coin = element.token;
            let isStaked = false;
            let stakingPercentage = 0;
            let type = "";
            let txType = "TRIAL_INVESTMENT";
            let amountInvested = amount;
            let notes = `${portfolioName} ${amount} Package-${managedBy}-FreeTrial`;
            let fees = adminFees;
            let amountMode = orderDetails.paymentType;
            console.log("INVESTMENT", email, coin, finalUsdAmount / rate);
            await this.updateSmartCryptoForFreeTrial(
              email,
              coin,
              finalUsdAmount / rate,
              isStaked,
              stakingPercentage,
              type,
              txType,
              amountInvested,
              notes,
              fees,
              amountMode,
              rate
            );
          }

          //Send email once the wallets are updated
          await new SendEmail().sendFreeTrialSuccessEmail(
            orderDetails.user.email,
            portfolioName
          );

          let email = orderDetails.user.email;
          // update the user details
          let updateUser = await uservice.updatePart(
            {
              email: email,
            },
            {
              $set: {
                isTestFundActive: true,
                freeTrailStartDate: new Date(),
              },
            }
          );
        } catch (err) {
          console.log("Error in FreeTrailOrder", err);
          return { status: 500, data: {} as any };
        }
      } else if (orderDetails.orderType === "SmartCryptoFreeTrialConvert") {
        // Split the string into parts
        const parts = orderDetails.breakdown.outCurrencyName.split("|");

        // Extract the individual components
        const portfolioName = parts[0];
        const managedBy = parts[1];
        let getSmartCryptoPlan = await smartCryptoService.findOne({
          portfolioName: portfolioName,
          managedBy: managedBy,
          isActive: true,
        });

        let getAllCurrencies = getSmartCryptoPlan.cryptocurrencies;
        let actualInvestmentPerCoin =
          orderDetails.breakdown.inAmount / getAllCurrencies.length;
        let subtractTrial = orderDetails.breakdown.inAmount - 500;
        let amount = subtractTrial / getAllCurrencies.length;
        console.log("each coin amount", amount);
        for (let index = 0; index < getAllCurrencies.length; index++) {
          const element = getAllCurrencies[index];
          let adminFees = await this.getAdminFees(element.token);
          let finalUsdAmount = amount - (amount * adminFees) / 100;
          let latestBaseRate = await getPriceByName(element.token);
          let rate = latestBaseRate.data;
          let email = orderDetails.user.email;
          let coin = element.token;
          let isStaked = false;
          let stakingPercentage = 0;
          let type = "";
          let txType = "INVESTMENT";
          let amountInvested = actualInvestmentPerCoin;
          let notes = `${portfolioName} ${amount} Package-${managedBy}`;
          let fees = adminFees;
          let amountMode = orderDetails.paymentType;
          await this.updateSmartCryptoFreeTrialConvert(
            email,
            coin,
            finalUsdAmount / rate,
            isStaked,
            stakingPercentage,
            type,
            txType,
            amountInvested,
            notes,
            fees,
            amountMode,
            rate
          );
        }
        let email = orderDetails.user.email;
        // Fetch all transactions where email matches and notes contain 'FreeTrial'
        let freeTrialRecords = await txService.find({
          email: email,
          txType: "TRIAL_INVESTMENT",
          notes: { $regex: "FreeTrial", $options: "i" }, // Case-insensitive search
        });

        console.log("freeTrialRecords", freeTrialRecords.length);
        // Loop through each record and delete it one by one
        for (let record of freeTrialRecords) {
          await txService.deleteOne({
            orderId: record.orderId,
            email: record.email,
          });
        }

        // update the user details
        let updateUser = await uservice.updatePart(
          {
            email: email,
          },
          {
            $set: {
              isFreeTrailEnded: true,
              freeTrailEndDate: new Date(),
            },
          }
        );
      } else if (orderDetails.orderType === "MiningSubscriptionOrder") {
        let getSubscriptionByName = await subscriptionPlansService.findOne({
          name: orderDetails.breakdown.outCurrencyName,
        });
        // update the subscription to user plan
        await userSubscriptionService.subscribeUser(
          orderDetails.user.email,
          orderDetails.breakdown.outCurrencyName,
          orderDetails.paymentType,
          "BTCY"
        );

        const currentSubscription = await userSubscriptionService.findOne({
          email: orderDetails.user.email,
          coinSymbol: "BTCY",
          status: "Active",
        });
        const miningPlan =
          currentSubscription?.plan || orderDetails.breakdown.outCurrencyName;
        const miningRate =
          currentSubscription?.miningRate ?? getSubscriptionByName.miningRate;

        // update the mining to the effective current subscription. During the
        // anniversary promo, purchases are queued so Nuclear remains active.
        await miningService.startMining(
          orderDetails.user.email,
          miningPlan,
          miningRate,
          "BTCY"
        );
      } else if (orderDetails.orderType === "Deposit") {
        let user = await uservice.findOne({ _id: orderDetails.user.userId });
        const inAmount = orderDetails.breakdown.inAmount;
        const filter = { email: user.email, "userWallets.coinSymbol": "USD" };

        // If the USD wallet might not exist, use arrayFilters + upsert
        const updatedUser = await uservice.findOneUpdate(
          filter,
          {
            $inc: { "userWallets.$.coinBalance": inAmount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() },
          },
          {
            new: true,                                // return the doc AFTER update
            projection: { "userWallets.$": 1, email: 1 },
          }
        );

        // If USD wallet might be missing, handle creating it
        let usdWallet: UserWallet | undefined = updatedUser?.userWallets?.[0];
        if (!usdWallet) {
          // Create USD wallet if it doesn't exist yet (previous = 0)
          const created = await uservice.findOneUpdate(
            { email: user.email, "userWallets.coinSymbol": { $ne: "USD" } },
            {
              $push: {
                userWallets: {
                  coinSymbol: "USD",
                  coinBalance: inAmount,
                  coinLastUsedOn: new Date(),
                },
              },
            },
            {
              new: true,
              upsert: false, // set true if you also want to create user if missing
              projection: { userWallets: 1, email: 1 },
            }
          );
          usdWallet = created.userWallets.find((w: any) => w.coinSymbol === "USD");
        }

        if (!usdWallet) {
          throw new Error("USD wallet not found or failed to create.");
        }
        const newBalance = usdWallet.coinBalance as number;
        const previousBalance = Number((newBalance - inAmount).toFixed(8));

        await new SendEmail().sendDepositReceived(
          user.email,
          "",
          orderDetails.breakdown.inAmount,
          "USD",
          orderDetails.breakdown.inAmount,
          previousBalance,               // prior wallet balance in asset
          newBalance,
        );
      }
      else {
        return { status: 500, data: "Invalid Order Type" };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: {} as any };
    }
  }

  /**
   * Helpers
   * **/

  async getAdminFees(orderCurrency: string) {
    try {
      if (String(orderCurrency || "").toUpperCase() === "BTCY") {
        return getConfiguredBtcyFeePercent();
      }

      if (
        orderCurrency == "BTC" ||
        orderCurrency == "ETH" ||
        orderCurrency == "BNB" ||
        orderCurrency == "BUSD" ||
        orderCurrency == "LTC" ||
        orderCurrency == "USD" ||
        orderCurrency == "AMZN" ||
        orderCurrency == "APPL" ||
        orderCurrency == "GOOGL" ||
        orderCurrency == "MSFT" ||
        orderCurrency == "META" ||
        orderCurrency == "NVDA" ||
        orderCurrency == "PEP" ||
        orderCurrency == "BCM" ||
        orderCurrency == "CHZ" ||
        orderCurrency == "VET" ||
        orderCurrency == "BTCY" ||
        orderCurrency == "AVAX" ||
        orderCurrency == "THETA" ||
        orderCurrency == "NOT" ||
        orderCurrency == "FTM" ||
        orderCurrency == "RUNE" ||
        orderCurrency == "NEAR" ||
        orderCurrency == "AAVE" ||
        orderCurrency == "INJ" ||
        orderCurrency == "PYTH" ||
        orderCurrency == "BEAM" ||
        orderCurrency == "ADA" ||
        orderCurrency == "XLM" ||
        orderCurrency == "SUI" ||
        orderCurrency == "MANA" ||
        orderCurrency == "SNP500" ||
        orderCurrency == "TLSA" ||
        orderCurrency == "DAI" ||
        orderCurrency == "USDT" ||
        orderCurrency == "USDC" ||
        orderCurrency == "MATIC" ||
        orderCurrency == "BCH" ||
        orderCurrency == "SOL" ||
        orderCurrency == "DOT" ||
        orderCurrency == "SHIB" ||
        orderCurrency == "LINK" ||
        orderCurrency == "DAI" ||
        orderCurrency == "DOGE" ||
        orderCurrency == "LEO" ||
        orderCurrency == "TUSD" ||
        orderCurrency == "XRP" ||
        orderCurrency == "EQSTK" ||
        orderCurrency == "CRYC10" ||
        orderCurrency == "ALCRYP" ||
        orderCurrency == "INDXXF" ||
        orderCurrency == "TOB"
      ) {
        let adminFee = await appSettingsService.findOne({ key: "AdminFees" });
        return adminFee.value;
      } else if (
        orderCurrency == "IN500" ||
        orderCurrency == "INEX" ||
        orderCurrency == "DaCrazy" ||
        orderCurrency == "INXC" ||
        orderCurrency == "IUSD+" ||
        orderCurrency == "INXP" ||
        orderCurrency == "WIBS" ||
        orderCurrency == "DaCrazy" ||
        orderCurrency == "SRT"
      ) {
        let adminFee = await appSettingsService.findOne({
          key: "IndexxTokensAdminFees",
        });
        return adminFee.value;
      } else if (orderCurrency === "PowerPack") {
        let powerpackFee = await appSettingsService.findOne({
          key: "PowerPackFee",
        });
        return powerpackFee.value;
      } else {
        return 0;
      }
    } catch (err) {
      return 0;
    }
  }

  async updateSmartCrypto(
    email: string,
    coin: string,
    amount: number,
    isStaked: boolean,
    stakingPercentage: number,
    type: string,
    txType: string,
    amountInvested: number,
    notes: string,
    fees: number,
    amountMode: string,
    rate: number
  ) {
    try {
      let getUser = (await uservice.findOne({
        email: String(email).toLowerCase(),
      })) as User;
      if (getUser) {
        let userRequiredWallet = getUser.userWallets.find(
          (x) => x.coinSymbol === coin
        );
        if (amountMode === "usd") {
        }
        let tokenUsdtValue;
        const isIndexxToken = (coin: string) =>
          ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);
        let inexPrice = await currencyService.findOne({
          code: coin,
        });
        if (coin === "INEX") {
          tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
        } else if (isIndexxToken(coin)) {
          console.log("indexx tokens");
          const latestBaseRate = await currencyService.findOne({
            code: coin,
          });
          tokenUsdtValue = latestBaseRate.buyPrice;
        } else {
          const getCoinPrice = await getPriceByName(coin);
          tokenUsdtValue = getCoinPrice.data;
        }

        if (userRequiredWallet) {
          if (isStaked) {
            stakingPercentage = stakingPercentage / 100;
            const tokenPercentageReward = Number(amount) * stakingPercentage;

            const inexReward = tokenPercentageReward * tokenUsdtValue;
            let finalAmount = inexReward;
            let duration, endDate;

            switch (type) {
              case "Short":
                duration = "6 months";
                endDate = new Date(
                  new Date().setMonth(new Date().getMonth() + 6)
                );
                break;
              case "Long":
                duration = "1 year";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                );
                break;
              case "Longer":
                duration = "2 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 2)
                );
                break;
              case "SuperLong":
                duration = "5 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 5)
                );
                break;
              default:
                duration = "1 day";
                endDate = new Date(
                  new Date().setDate(new Date().getDate() + 1)
                );
                stakingPercentage = 0.00273973;
                break;
            }

            let stakeData = {
              stakingId: uuidv1(),
              stakedAmount: Number(amount), // How much the user is staking
              rewardAmount: inexReward, // how reward is gained
              finalAmount: finalAmount, // Final amount the user gets staked + reward
              coin: coin,
              rewardCoin: "INEX",
              email: getUser.email,
              percentage: stakingPercentage,
              startDate: new Date(),
              endDate: endDate,
              isActive: true,
              type: type, // Short or Long
              duration: duration, // 6 months or 1 year
            } as Staking;

            let createStaking = await stakingService.create(stakeData);

            console.log("createStaking", createStaking);
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(getUser.email, String(coin))
            ) {
              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinStakedBalance": amount,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists",
              updateWallet
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            await new SendEmail().sendReceivedCoins(
              getUser?.email,
              amount,
              coin,
              coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          } else {
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(getUser.email, String(coin))
            ) {
              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": amount,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists",
              updateWallet
            );

            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            // await new SendEmail().sendReceivedCoins(
            //   getUser?.email,
            //   amount,
            //   coin,
            //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            // );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          }
        } else {
          console.log("No Wallet available");
          // create wallet first
          let newWallet = await this.checkAndCreateUserWallet(email, coin);

          if (newWallet) {
            //update User Wallet
            let updateUserWallet = await uservice.updatePart(
              {
                email: getUser.email,
                "userWallets.coinSymbol": coin,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": amount,
                },
              }
            );
            console.log(
              "final update user wallet no wallet. exist already",
              updateUserWallet
            );
          }

          let transaction = {
            orderId: uuidv1(),
            extRef: "",
            txId: "",
            from: "",
            to: getUser.email,
            amount: amount,
            info: "",
            status: OrderStatus.Completed,
            currencyRef: coin,
            walletType: "Asset Wallet",
            transactionType: txType,
            exchangeName: "CEX",
            email: getUser.email,
            txDate: new Date(),
            benificaryAddress: "",
            amountInvested: amountInvested,
            notes: notes,
            rate: rate,
          } as Transaction;
          let createTx = await transactionService.create(transaction);

          // await new SendEmail().sendReceivedCoins(
          //   getUser?.email,
          //   amount,
          //   coin,
          //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
          // );
          return {
            status: 200,
            data: {
              message: "Wallet updated successfully",
            },
          };
        }
      } else {
        return {
          status: 200,
          data: {
            message: "No User found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  async updateSmartCryptoFreeTrialConvert(
    email: string,
    coin: string,
    amount: number,
    isStaked: boolean,
    stakingPercentage: number,
    type: string,
    txType: string,
    amountInvested: number,
    notes: string,
    fees: number,
    amountMode: string,
    rate: number
  ) {
    try {
      let getUser = (await uservice.findOne({
        email: String(email).toLowerCase(),
      })) as User;
      if (getUser) {
        let userRequiredWallet = getUser.userWallets.find(
          (x) => x.coinSymbol === coin
        );
        if (amountMode === "usd") {
        }
        let tokenUsdtValue;
        const isIndexxToken = (coin: string) =>
          ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);
        let inexPrice = await currencyService.findOne({
          code: coin,
        });
        if (coin === "INEX") {
          tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
        } else if (isIndexxToken(coin)) {
          console.log("indexx tokens");
          const latestBaseRate = await currencyService.findOne({
            code: coin,
          });
          tokenUsdtValue = latestBaseRate.buyPrice;
        } else {
          const getCoinPrice = await getPriceByName(coin);
          tokenUsdtValue = getCoinPrice.data;
        }

        if (userRequiredWallet) {
          if (isStaked) {
            stakingPercentage = stakingPercentage / 100;
            const tokenPercentageReward = Number(amount) * stakingPercentage;

            const inexReward = tokenPercentageReward * tokenUsdtValue;
            let finalAmount = inexReward;
            let duration, endDate;

            switch (type) {
              case "Short":
                duration = "6 months";
                endDate = new Date(
                  new Date().setMonth(new Date().getMonth() + 6)
                );
                break;
              case "Long":
                duration = "1 year";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                );
                break;
              case "Longer":
                duration = "2 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 2)
                );
                break;
              case "SuperLong":
                duration = "5 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 5)
                );
                break;
              default:
                duration = "1 day";
                endDate = new Date(
                  new Date().setDate(new Date().getDate() + 1)
                );
                stakingPercentage = 0.00273973;
                break;
            }

            let stakeData = {
              stakingId: uuidv1(),
              stakedAmount: Number(amount), // How much the user is staking
              rewardAmount: inexReward, // how reward is gained
              finalAmount: finalAmount, // Final amount the user gets staked + reward
              coin: coin,
              rewardCoin: "INEX",
              email: getUser.email,
              percentage: stakingPercentage,
              startDate: new Date(),
              endDate: endDate,
              isActive: true,
              type: type, // Short or Long
              duration: duration, // 6 months or 1 year
            } as Staking;

            let createStaking = await stakingService.create(stakeData);

            console.log("createStaking", createStaking);
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(getUser.email, String(coin))
            ) {
              let getFreeTrialAmount: number = Number(
                getUser.freeTrailUserWallets.find((x) => x.coinSymbol === coin)
                  ?.coinBalance
              );
              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinStakedBalance":
                      amount + getFreeTrialAmount,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists updateSmartCryptoFreeTrialConvert",
              updateWallet,
              coin
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            await new SendEmail().sendReceivedCoins(
              getUser?.email,
              amount,
              coin,
              coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          } else {
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(getUser.email, String(coin))
            ) {
              let getFreeTrialAmount: number = Number(
                getUser.freeTrailUserWallets.find((x) => x.coinSymbol === coin)
                  ?.coinBalance
              );
              console.log("getFreeTrialAmount", getFreeTrialAmount);
              console.log("amount", amount);
              console.log("coin", coin);
              const validAmount = Number(amount) || 0;
              const validFreeTrialAmount = Number(getFreeTrialAmount) || 0;
              // Compute the total balance to be added safely
              const totalAmountToAdd = validAmount + validFreeTrialAmount;

              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": totalAmountToAdd,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists updateSmartCryptoFreeTrialConvert 0",
              updateWallet,
              coin
            );

            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            // await new SendEmail().sendReceivedCoins(
            //   getUser?.email,
            //   amount,
            //   coin,
            //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            // );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          }
        } else {
          console.log("No Wallet available");
          // create wallet first
          let newWallet = await this.checkAndCreateUserWallet(email, coin);

          if (newWallet) {
            //update User Wallet
            let getFreeTrialAmount: number = Number(
              getUser.freeTrailUserWallets.find((x) => x.coinSymbol === coin)
                ?.coinBalance
            );
            let updateUserWallet = await uservice.updatePart(
              {
                email: getUser.email,
                "userWallets.coinSymbol": coin,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": amount + getFreeTrialAmount,
                },
              }
            );
            console.log(
              "final update user wallet no wallet. exist already",
              updateUserWallet,
              coin
            );
          }

          let transaction = {
            orderId: uuidv1(),
            extRef: "",
            txId: "",
            from: "",
            to: getUser.email,
            amount: amount,
            info: "",
            status: OrderStatus.Completed,
            currencyRef: coin,
            walletType: "Asset Wallet",
            transactionType: txType,
            exchangeName: "CEX",
            email: getUser.email,
            txDate: new Date(),
            benificaryAddress: "",
            amountInvested: amountInvested,
            notes: notes,
            rate: rate,
          } as Transaction;
          let createTx = await transactionService.create(transaction);

          // await new SendEmail().sendReceivedCoins(
          //   getUser?.email,
          //   amount,
          //   coin,
          //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
          // );
          return {
            status: 200,
            data: {
              message: "Wallet updated successfully",
            },
          };
        }
      } else {
        return {
          status: 200,
          data: {
            message: "No User found",
          },
        };
      }
    } catch (err: any) {
      console.log("err in updateSmartCryptoFreeTrialConvert", err);
      return { status: 500, data: err };
    }
  }

  async updateSmartCryptoForFreeTrial(
    email: string,
    coin: string,
    amount: number,
    isStaked: boolean,
    stakingPercentage: number,
    type: string,
    txType: string,
    amountInvested: number,
    notes: string,
    fees: number,
    amountMode: string,
    rate: number
  ) {
    try {
      let getUser = (await uservice.findOne({
        email: String(email).toLowerCase(),
      })) as User;
      if (getUser) {
        let userRequiredWallet = getUser.freeTrailUserWallets.find(
          (x) => x.coinSymbol === coin
        );
        if (amountMode === "usd") {
        }
        let tokenUsdtValue;
        const isIndexxToken = (coin: string) =>
          ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);
        let inexPrice = await currencyService.findOne({
          code: coin,
        });
        if (coin === "INEX") {
          tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
        } else if (isIndexxToken(coin)) {
          console.log("indexx tokens");
          const latestBaseRate = await currencyService.findOne({
            code: coin,
          });
          tokenUsdtValue = latestBaseRate.buyPrice;
        } else {
          const getCoinPrice = await getPriceByName(coin);
          tokenUsdtValue = getCoinPrice.data;
        }

        if (userRequiredWallet) {
          if (isStaked) {
            stakingPercentage = stakingPercentage / 100;
            const tokenPercentageReward = Number(amount) * stakingPercentage;

            const inexReward = tokenPercentageReward * tokenUsdtValue;
            let finalAmount = inexReward;
            let duration, endDate;

            switch (type) {
              case "Short":
                duration = "6 months";
                endDate = new Date(
                  new Date().setMonth(new Date().getMonth() + 6)
                );
                break;
              case "Long":
                duration = "1 year";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                );
                break;
              case "Longer":
                duration = "2 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 2)
                );
                break;
              case "SuperLong":
                duration = "5 years";
                endDate = new Date(
                  new Date().setFullYear(new Date().getFullYear() + 5)
                );
                break;
              default:
                duration = "1 day";
                endDate = new Date(
                  new Date().setDate(new Date().getDate() + 1)
                );
                stakingPercentage = 0.00273973;
                break;
            }

            let stakeData = {
              stakingId: uuidv1(),
              stakedAmount: Number(amount), // How much the user is staking
              rewardAmount: inexReward, // how reward is gained
              finalAmount: finalAmount, // Final amount the user gets staked + reward
              coin: coin,
              rewardCoin: "INEX",
              email: getUser.email,
              percentage: stakingPercentage,
              startDate: new Date(),
              endDate: endDate,
              isActive: true,
              type: type, // Short or Long
              duration: duration, // 6 months or 1 year
            } as Staking;

            let createStaking = await stakingService.create(stakeData);

            console.log("createStaking", createStaking);
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(getUser.email, String(coin))
            ) {
              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinStakedBalance": amount,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists updateSmartCryptoForFreeTrial",
              updateWallet,
              coin
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            await new SendEmail().sendReceivedCoins(
              getUser?.email,
              amount,
              coin,
              coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          } else {
            let updateWallet;
            if (
              await this.checkAndCreateUserWallet(
                getUser.email,
                String(coin),
                true
              )
            ) {
              updateWallet = await uservice.updatePart(
                {
                  email: getUser.email,
                  "freeTrailUserWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "freeTrailUserWallets.$.coinBalance": amount,
                  },
                }
              );
            }
            console.log(
              "final update user wallet. wallet exists updateSmartCryptoForFreeTrial",
              updateWallet,
              coin
            );

            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: "",
              from: "",
              to: getUser.email,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: coin,
              walletType: "Asset Wallet",
              transactionType: txType,
              exchangeName: "CEX",
              email: getUser.email,
              txDate: new Date(),
              benificaryAddress: "",
              amountInvested: amountInvested,
              notes: notes,
              rate: rate,
            } as Transaction;
            let createTx = await transactionService.create(transaction);

            // await new SendEmail().sendReceivedCoins(
            //   getUser?.email,
            //   amount,
            //   coin,
            //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
            // );
            return {
              status: 200,
              data: {
                message: "Wallet updated successfully",
              },
            };
          }
        } else {
          console.log("No Wallet available");
          // create wallet first
          let newWallet = await this.checkAndCreateUserWallet(
            email,
            coin,
            true
          );

          if (newWallet) {
            //update User Wallet
            let updateUserWallet = await uservice.updatePart(
              {
                email: getUser.email,
                "freeTrailUserWallets.coinSymbol": coin,
              },
              {
                $inc: {
                  "freeTrailUserWallets.$.coinBalance": amount,
                },
              }
            );
            console.log(
              "final update user wallet no wallet. exist already",
              updateUserWallet
            );
          }

          let transaction = {
            orderId: uuidv1(),
            extRef: "",
            txId: "",
            from: "",
            to: getUser.email,
            amount: amount,
            info: "",
            status: OrderStatus.Completed,
            currencyRef: coin,
            walletType: "Asset Wallet",
            transactionType: txType,
            exchangeName: "CEX",
            email: getUser.email,
            txDate: new Date(),
            benificaryAddress: "",
            amountInvested: amountInvested,
            notes: notes,
            rate: rate,
          } as Transaction;
          let createTx = await transactionService.create(transaction);

          // await new SendEmail().sendReceivedCoins(
          //   getUser?.email,
          //   amount,
          //   coin,
          //   coin === "INEX" ? inexPrice.buyPrice : tokenUsdtValue
          // );
          return {
            status: 200,
            data: {
              message: "Wallet updated successfully",
            },
          };
        }
      } else {
        return {
          status: 200,
          data: {
            message: "No User found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  //Method to update user wallet balance for buy order
  async updateUserBalance(orderDetails: Order) {
    try {
      console.log(" IAM INSIDE UPDATED BALACNE");
      let convertAmount = orderDetails.breakdown.inAmount;
      let convertCurrency = orderDetails.breakdown.inCurrenyName;
      let convertToCurrency = orderDetails.breakdown.outCurrencyName;
      if (
        convertToCurrency.localeCompare("BTC") == 0 ||
        convertToCurrency.localeCompare("ETH") == 0 ||
        convertToCurrency.localeCompare("BNB") == 0 ||
        convertToCurrency.localeCompare("LTC") == 0 ||
        convertToCurrency.localeCompare("XRP") == 0 ||
        convertToCurrency.localeCompare("DOGE") == 0 ||
        convertToCurrency.localeCompare("USDC") == 0 ||
        convertToCurrency.localeCompare("USDT") == 0 ||
        convertToCurrency.localeCompare("MATIC") == 0 ||
        convertToCurrency.localeCompare("DOT") == 0 ||
        convertToCurrency.localeCompare("BCH") == 0 ||
        convertToCurrency.localeCompare("SOL") == 0 ||
        convertToCurrency.localeCompare("LINK") == 0 ||
        convertToCurrency.localeCompare("TON") == 0 ||
        convertToCurrency.localeCompare("DAI") == 0 ||
        convertToCurrency.localeCompare("SHIB") == 0 ||
        convertToCurrency.localeCompare("CHZ") == 0 ||
        convertToCurrency.localeCompare("VET") == 0 ||
        convertToCurrency.localeCompare("BTCY") == 0 ||
        convertToCurrency.localeCompare("AVAX") == 0 ||
        convertToCurrency.localeCompare("THETA") == 0 ||
        convertToCurrency.localeCompare("NOT") == 0 ||
        convertToCurrency.localeCompare("FTM") == 0 ||
        convertToCurrency.localeCompare("RUNE") == 0 ||
        convertToCurrency.localeCompare("NEAR") == 0 ||
        convertToCurrency.localeCompare("AAVE") == 0 ||
        convertToCurrency.localeCompare("INJ") == 0 ||
        convertToCurrency.localeCompare("PYTH") == 0 ||
        convertToCurrency.localeCompare("BEAM") == 0 ||
        convertToCurrency.localeCompare("XLM") == 0 ||
        convertToCurrency.localeCompare("SUI") == 0 ||
        convertToCurrency.localeCompare("MANA") == 0 ||
        convertToCurrency.localeCompare("ADA") == 0 ||
        convertToCurrency.localeCompare("BUSD") == 0 ||
        convertToCurrency.localeCompare("AMZN") == 0 ||
        convertToCurrency.localeCompare("APPL") == 0 ||
        convertToCurrency.localeCompare("GOOGL") == 0 ||
        convertToCurrency.localeCompare("META") == 0 ||
        convertToCurrency.localeCompare("MSFT") == 0 ||
        convertToCurrency.localeCompare("TSLA") == 0 ||
        convertToCurrency.localeCompare("TLSA") == 0 ||
        convertToCurrency.localeCompare("APPL") == 0 ||
        convertToCurrency.localeCompare("BCM") == 0 ||
        convertToCurrency.localeCompare("SNP500") == 0 ||
        convertToCurrency.localeCompare("NVDA") == 0 ||
        convertToCurrency.localeCompare("TRX") == 0 ||
        convertToCurrency.localeCompare("PEP") == 0
      ) {
        console.log("base tokens");
        const quantumBtcyOrder = isQuantumBtcyOrder(orderDetails);
        let latestBaseRate = quantumBtcyOrder
          ? {
              data: Number(orderDetails?.orderRate?.rate || 0.1),
            }
          : await getPriceByName(convertToCurrency);
        console.log(latestBaseRate, "a");
        let finalOutAmount =
          Number(orderDetails?.breakdown?.netAmount ?? NaN);
        if (!Number.isFinite(finalOutAmount) || finalOutAmount <= 0) {
          finalOutAmount =
            convertAmount -
            convertAmount * (Number(orderDetails?.exchangeFees) / 100);
        }
        console.log("finalOutAmount", finalOutAmount);
        let totalOutAmount = quantumBtcyOrder
          ? Number(orderDetails?.breakdown?.outAmount || 0)
          : finalOutAmount / latestBaseRate.data;
        let nextNotes = String(orderDetails?.notes || "");

        if (convertToCurrency.localeCompare("BTCY") == 0 && quantumBtcyOrder) {
          const bonusEval = applyQuantumBtcyBonusIfNeeded(orderDetails, totalOutAmount);
          if (bonusEval.applied) {
            totalOutAmount = bonusEval.finalOutAmount;
            nextNotes = appendQuantumBtcyBonusNote(
              nextNotes,
              bonusEval.bonusAmount,
              totalOutAmount
            );
          }
        }
        console.log(totalOutAmount, "totalOutAmount");

        //update Order
        let updateOrder = await this.updatePart(
          {
            _id: orderDetails._id,
          },
          {
            $set: {
              status: "Completed",
              orderCompletedOn: new Date(),
              "breakdown.outAmount": totalOutAmount,
              "breakdown.netAmount": finalOutAmount,
              "orderRate.rate": latestBaseRate.data,
              "orderRate.currency": orderDetails.breakdown.outCurrencyName,
              notes: nextNotes,
            },
          }
        );

        if (convertToCurrency.localeCompare("BTCY") == 0) {
          try {
            await btcyBuyHistoryService.recordBuy({
              email: orderDetails.user.email,
              orderId: orderDetails.orderId,
              orderMongoId: String(orderDetails._id || ""),
              amount: totalOutAmount,
              priceAtBuy: Number(latestBaseRate.data),
              boughtAt: new Date(),
            });
          } catch (err) {
            console.warn("Failed to record BTCY buy history", err);
          }
        }
        let userData = await uservice.findOne({
          email: orderDetails.user.email,
        });
        let maincaptainBeeData = await uservice.findOne({
          referralCode: userData.referralCodeUsed,
        });
        if (maincaptainBeeData) {
          this.UpdateDBForOrderCommission(
            orderDetails.user.email,
            maincaptainBeeData.email,
            orderDetails
          );
        }

        if (orderDetails?.isCaptainPerformingOrder) {
          await this.UpdateDBForCaptainOrder(
            orderDetails.user.email,
            orderDetails.captainBeeEmail,
            orderDetails
          );
        }
        let user = await uservice.findOne({
          _id: orderDetails.user.userId,
        });

        const coin = String(orderDetails?.breakdown?.outCurrencyName || "").toUpperCase();
        const result = await this.checkAndCreateUserWallet(
          user.email,
          coin,
          false,
          coin === "BTCY" ? "Ying Yang Chain" : undefined  // only for BTCY
        )
        console.log("result of checkAndCreateUserWallet", result);
        if (
          result
        ) {
          const WALLET_ARRAY = "userWallets"; // change to "userWallet" if that's your schema

          const coinRaw = String(orderDetails.breakdown.outCurrencyName || "");
          const coin = coinRaw.toUpperCase();
          const isBTCY = coin === "BTCY";
          const network = isBTCY ? "Ying Yang Chain" : undefined;

          const incAmount = Number(totalOutAmount);
          const usdValue =
            Number(orderDetails.breakdown.outAmount) * Number(latestBaseRate.data);

          // Build array filter: require network only for BTCY
          const arrayFilters = isBTCY
            ? [{ "w.coinSymbol": coin, "w.coinNetwork": network }]
            : [{ "w.coinSymbol": coin }];

          // Primary update: hit the exact wallet element
          const updateResult: any = await uservice.updatePartWithOptions(
            { _id: orderDetails.user.userId, email: user.email },
            {
              $inc: { [`${WALLET_ARRAY}.$[w].coinBalance`]: incAmount },
              $set: {
                [`${WALLET_ARRAY}.$[w].coinLastUsedOn`]: new Date(),
                [`${WALLET_ARRAY}.$[w].coinBalanceInUSD`]: usdValue
              }
            },
            { arrayFilters }
          );

          console.log("wallet update (arrayFilters) =>", updateResult);

          // If no element matched (wallet entry missing), push a new one
          if (!updateResult || updateResult.modifiedCount === 0) {
            const pushRes = await uservice.updatePart(
              { _id: orderDetails.user.userId },
              {
                $push: {
                  [WALLET_ARRAY]: {
                    coinSymbol: coin,
                    coinNetwork: isBTCY ? network : null, // only store network for BTCY
                    coinBalance: incAmount,
                    coinBalanceInUSD: usdValue,
                    coinLastUsedOn: new Date()
                  }
                }
              }
            );
            console.log("wallet push (created new entry) =>", pushRes);
          }

        }
        return { status: 200, data: "Updated user balances" };
      } else if (
        convertToCurrency.localeCompare("IN500") == 0 ||
        convertToCurrency.localeCompare("IUSD+") == 0 ||
        convertToCurrency.localeCompare("INXC") == 0 ||
        convertToCurrency.localeCompare("WIBS") == 0 ||
        convertToCurrency.localeCompare("DaCrazy") == 0 ||
        convertToCurrency.localeCompare("INEX") == 0
      ) {
        console.log("indexx tokens");

        let latestBaseRate = await currencyService.findOne({
          code: convertToCurrency,
        });
        let finalOutAmount =
          convertAmount -
          convertAmount * (Number(orderDetails?.exchangeFees) / 100);
        let totalOutAmount = finalOutAmount / latestBaseRate.buyPrice;

        // Add logic for WIBS
        if (convertToCurrency.localeCompare("WIBS") == 0) {
          totalOutAmount = totalOutAmount * 4; // For each token bought, receive a total of 4 tokens (1 bought + 3 free)
        } else if (convertToCurrency.localeCompare("DaCrazy") == 0) {
          totalOutAmount = totalOutAmount * 9; // For each token bought, receive a total of 10 tokens (1 bought + 9 free)
        }

        console.log(
          "finalOutAmount, totalOutAmount",
          finalOutAmount,
          totalOutAmount
        );

        // Update order
        let updateOrder = await this.updatePart(
          {
            orderId: orderDetails.orderId,
          },
          {
            $set: {
              "breakdown.outAmount": totalOutAmount,
              orderCompletedOn: new Date(),
              "orderRate.rate": latestBaseRate.buyPrice,
              "orderRate.currency": latestBaseRate.code,
              status: "Completed",
              notes:
                convertToCurrency.localeCompare("WIBS") == 0
                  ? "Buy 1 Get 3 WIBS Promotion"
                  : convertToCurrency.localeCompare("DaCrazy") == 0
                    ? "Buy 1 Get 9 DaCrazy Promotion"
                    : "",
            },
          }
        );
        let userData = await uservice.findOne({
          email: orderDetails.user.email,
        });
        let maincaptainBeeData = await uservice.findOne({
          referralCode: userData.referralCodeUsed,
        });
        if (maincaptainBeeData) {
          this.UpdateDBForOrderCommission(
            orderDetails.user.email,
            maincaptainBeeData.email,
            orderDetails
          );
        }

        if (orderDetails?.isCaptainPerformingOrder) {
          await this.UpdateDBForCaptainOrder(
            orderDetails.user.email,
            orderDetails.captainBeeEmail,
            orderDetails
          );
        }
        let user = await uservice.findOne({
          _id: orderDetails.user.userId,
        });
        if (
          await this.checkAndCreateUserWallet(
            user.email,
            orderDetails.breakdown.outCurrencyName
          )
        ) {
          //update User Wallet
          const isInex = orderDetails?.breakdown?.outCurrencyName === 'INEX';

          const update = {
            $inc: { "userWallets.$.coinBalance": totalOutAmount },
            $set: {
              "userWallets.$.coinLastUsedOn": new Date(),
              ...(isInex ? { "userWallets.$.coinNetwork": "Binance Smart Chain" } : {}),
            },
          };

          const updateUserWallet = await uservice.updatePart(
            {
              _id: orderDetails.user.userId,
              "userWallets.coinSymbol": orderDetails.breakdown.outCurrencyName,
            },
            update
          );


          //stake the user coins if the order is monthly inex purchase
          if (
            (orderDetails?.comments === "INEX Monthly Purchase" ||
              orderDetails?.comments?.localeCompare("INEX Monthly Purchase") ===
              0) &&
            convertToCurrency.localeCompare("INEX") == 0
          ) {
            let stakingPercentage = 15 / 100; //APR for INEX 15%

            const tokenPercentageReward =
              Number(totalOutAmount) * stakingPercentage;
            let tokenUsdtValue;

            tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price

            const inexReward = tokenPercentageReward * tokenUsdtValue;

            let finalAmount = inexReward;
            // Calculate the endDate based on the duration
            let startDate = new Date();
            let endDate = new Date(startDate);
            endDate.setFullYear(startDate.getFullYear() + 1);

            //After adding balance to user wallet stake same amount for 1 year
            let stakeData = {
              stakingId: uuidv1(),
              stakedAmount: Number(totalOutAmount), // How much the user is staking
              rewardAmount: inexReward, // how reward is gained
              finalAmount: finalAmount, // Final amount the user gets staked + reward
              coin: "INEX",
              rewardCoin: "INEX",
              email: user.email,
              percentage: stakingPercentage,
              startDate: startDate,
              endDate: endDate,
              isActive: true,
              type: "Long", // Short or Long
              duration: "1 year", // 6 months or 1 year
            } as Staking;

            let createStaking = await stakingService.create(stakeData);
            let userAddress = user.userWallets.find(
              (x) => x.coinSymbol == "INEX"
            );

            console.log("createStaking", createStaking);

            // Update the user balance
            let updateUserWallet = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "INEX",
              },
              {
                $set: {
                  coinLastUsedOn: new Date(),
                  "userWallets.$.coinBalance":
                    Number(userAddress?.coinBalance) - Number(totalOutAmount),
                  "userWallets.$.coinStakedBalance":
                    userAddress?.coinStakedBalance
                      ? userAddress.coinStakedBalance + Number(totalOutAmount)
                      : Number(totalOutAmount),
                },
              }
            );

            console.log("updateUserWallet", updateUserWallet);

            if (orderDetails.orderType === "MonthlyINEXBuy") {
              const paymentDate = new Date();
              const nextPaymentDate = new Date(paymentDate);
              nextPaymentDate.setMonth(paymentDate.getMonth() + 1);
              // update the non paypal subscription record
              let nonPaypalSubscriptionData =
                await nonPaypalSubscriptionService.updatePart(
                  {
                    orderId: orderDetails.orderId,
                  },
                  {
                    paymentDate: paymentDate,
                    nextPaymentDate: nextPaymentDate, // next one month data
                    paymentStatus: "ACTIVE",
                  }
                );
            }
          }

          console.log("updated user balance", updateUserWallet);
          return { status: 200, data: "Updated user balances" };
        } else {
          return { status: 500, data: "Error updating user balance" };
        }
      }
    } catch (err) {
      return { status: 500, data: "Failed to update user balances" };
    }
  }

  // Function to subtract from the user's wallet (decrement balance)
  async subtractFromUserWallet(
    userEmail: string,
    currencyRef: string,
    amount: number
  ) {
    console.log(`Subtracting ${amount} ${currencyRef} from user ${userEmail}`);

    await this.checkAndCreateUserWallet(userEmail, currencyRef);

    let updateUser = await uservice.updatePart(
      {
        email: userEmail,
        "userWallets.coinSymbol": currencyRef,
      },
      {
        $inc: {
          "userWallets.$.coinBalance": -1 * amount, // Decrement the crypto balance
        },
        $set: {
          coinLastUsedOn: new Date(),
        },
      }
    );
  }

  // Function to add to the profit account (increment balance)
  async addToUserWallet(
    userEmail: string,
    currencyRef: string,
    amount: number
  ) {
    console.log(
      `Adding ${amount} ${currencyRef} to profit account (${userEmail})`
    );

    await this.checkAndCreateUserWallet(userEmail, currencyRef);

    let updateUser = await uservice.updatePart(
      {
        email: userEmail,
        "userWallets.coinSymbol": currencyRef,
      },
      {
        $inc: {
          "userWallets.$.coinBalance": amount, // Increment the crypto balance
        },
        $set: {
          coinLastUsedOn: new Date(),
        },
      }
    );
  }

  //Method to update user wallet balance for sell order
  async updateUserBalance2(orderDetails: Order) {
    {
      try {
        let totalOutAmount = 0;
        let convertAmount = orderDetails.breakdown.inAmount;
        let convertCurrency = orderDetails.breakdown.inCurrenyName;
        let convertToCurrency = orderDetails.breakdown.outCurrencyName;
        console.log("convertCurrency", convertCurrency);
        console.log("convertToCurrency", convertToCurrency);
        console.log("convertAmount", convertAmount);
        // Fetch the current price of the currency being sold
        let latestBaseRate = await getPriceByName(convertCurrency);
        totalOutAmount = convertAmount * latestBaseRate.data;

        let afterOurFees =
          totalOutAmount -
          totalOutAmount * (Number(orderDetails.exchangeFees) / 100);

        // Fetch the original buy order for the user to calculate profit
        let originalBuyOrder = await this.findOne({
          "user.email": orderDetails.user.email,
          "breakdown.inCurrenyName": convertCurrency,
          status: "Completed",
          orderType: "Buy",
        });

        console.log("originalBuyOrder", originalBuyOrder);
        if (originalBuyOrder) {
          let originalBuyPrice = originalBuyOrder.orderRate.rate;
          let currentSellPrice = latestBaseRate.data;
          let profit = (currentSellPrice - originalBuyPrice) * convertAmount;

          console.log("proft", profit);
          if (profit > 0) {
            // Take 10% of the profit
            let profitToTake = profit * 0.1;

            // Log the profit details
            await profitLogService.create({
              userEmail: orderDetails.user.email,
              profitAccountEmail: profitAccountEmail,
              currencyRef: convertCurrency,
              profitInCrypto: profitToTake,
              profitInUsd: profitToTake * currentSellPrice, // Convert to USD equivalent
              txDate: new Date(),
              originalInvestment:
                originalBuyOrder.orderRate.rate * convertAmount,
              currentValue: currentSellPrice * convertAmount,
              logDate: new Date(),
              note: `10% profit taken from ${orderDetails.user.email} in ${convertCurrency}`,
              type: "Sell",
            });

            // Subtract profit from user balance and add to support account
            await this.subtractFromUserWallet(
              orderDetails.user.email,
              convertCurrency,
              profitToTake
            );
            await this.addToUserWallet(
              profitAccountEmail,
              convertCurrency,
              profitToTake
            );
          }
        }
        if (
          convertCurrency.localeCompare("BTC") == 0 ||
          convertCurrency.localeCompare("ETH") == 0 ||
          convertCurrency.localeCompare("LTC") == 0 ||
          convertCurrency.localeCompare("BNB") == 0 ||
          convertCurrency.localeCompare("XRP") == 0 ||
          convertCurrency.localeCompare("DOGE") == 0 ||
          convertCurrency.localeCompare("SOL") == 0 ||
          convertCurrency.localeCompare("USDC") == 0 ||
          convertCurrency.localeCompare("MATIC") == 0 ||
          convertCurrency.localeCompare("DOT") == 0 ||
          convertCurrency.localeCompare("LINK") == 0 ||
          convertCurrency.localeCompare("CHZ") == 0 ||
          convertCurrency.localeCompare("AVAX") == 0 ||
          convertCurrency.localeCompare("THETA") == 0 ||
          convertCurrency.localeCompare("VET") == 0 ||
          convertCurrency.localeCompare("BTCY") == 0 ||
          convertCurrency.localeCompare("NOT") == 0 ||
          convertCurrency.localeCompare("FTM") == 0 ||
          convertCurrency.localeCompare("RUNE") == 0 ||
          convertCurrency.localeCompare("NEAR") == 0 ||
          convertCurrency.localeCompare("SHIB") == 0 ||
          convertCurrency.localeCompare("AAVE") == 0 ||
          convertCurrency.localeCompare("INJ") == 0 ||
          convertCurrency.localeCompare("PYTH") == 0 ||
          convertCurrency.localeCompare("BEAM") == 0 ||
          convertCurrency.localeCompare("XLM") == 0 ||
          convertCurrency.localeCompare("SUI") == 0 ||
          convertCurrency.localeCompare("ADA") == 0 ||
          convertCurrency.localeCompare("MANA") == 0 ||
          convertCurrency.localeCompare("BCH") == 0 ||
          convertCurrency.localeCompare("USDT") == 0 ||
          convertCurrency.localeCompare("AMZN") == 0 ||
          convertCurrency.localeCompare("APPL") == 0 ||
          convertCurrency.localeCompare("GOOGL") == 0 ||
          convertCurrency.localeCompare("META") == 0 ||
          convertCurrency.localeCompare("MSFT") == 0 ||
          convertCurrency.localeCompare("TSLA") == 0 ||
          convertCurrency.localeCompare("TLSA") == 0 ||
          convertCurrency.localeCompare("APPL") == 0 ||
          convertCurrency.localeCompare("BCM") == 0 ||
          convertCurrency.localeCompare("SNP500") == 0 ||
          convertCurrency.localeCompare("NVDA") == 0 ||
          convertCurrency.localeCompare("TRX") == 0 ||
          convertCurrency.localeCompare("PEP") == 0
        ) {
          let latestBaseRate = await getPriceByName(convertCurrency);
          console.log(latestBaseRate, "a");
          totalOutAmount = convertAmount * latestBaseRate.data;
          let afterOurFees =
            totalOutAmount -
            totalOutAmount * (Number(orderDetails.exchangeFees) / 100);
          console.log("afterOurFees", afterOurFees);

          // Calculate the fees amount
          let finalFeesAmount =
            totalOutAmount * (Number(orderDetails.exchangeFees) / 100);
          console.log("feesAmount", finalFeesAmount);

          if (
            await this.checkAndCreateUserWallet(
              "wallet@azooca.com",
              convertToCurrency
            )
          ) {
            // Add fees to wallet@azooca.com
            let updatFeeseWallet = await uservice.updatePart(
              {
                email: "wallet@azooca.com",
                "userWallets.coinSymbol": convertToCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinStakedBalance": finalFeesAmount,
                },
              }
            );

            // Create a new transaction for the profit account
            const newProfitTransaction: Transaction = {
              orderId: uuidv1(), // Reference the original transaction
              extRef: "", // Optional external reference
              txId: "", // Optional transaction ID
              from: orderDetails.user.email, // From the user's email
              to: profitAccountEmail, // To the profit account
              amount: finalFeesAmount, // Amount of crypto taken as profit
              info: "Sell Fees transferred", // Information about the transaction
              status: OrderStatus.Completed, // Status of the transaction
              currencyRef: convertToCurrency, // The currency in which profit is transferred (e.g., BTC)
              walletType: "Profit Account", // Indicate that this is for the profit account
              transactionType: "FEES", // Type of transaction
              exchangeName: "CEX", // Exchange name if applicable
              email: profitAccountEmail, // The email for the profit account
              txDate: new Date(), // Date of the profit transaction
              benificaryAddress: "", // Beneficiary address if applicable
              notes: `Sell Fees of ${finalFeesAmount.toFixed(
                8
              )} ${convertToCurrency} taken from ${orderDetails.user.email
                } and transferred to profit account`,
            };
            await txservice.create(newProfitTransaction);
          }

          //update order
          let updateOrder = await this.updatePart(
            {
              _id: orderDetails._id,
            },
            {
              $set: {
                status: "Completed",
                orderCompletedOn: new Date(),
                "breakdown.outAmount": afterOurFees,
                "orderRate.rate": latestBaseRate.data,
                "orderRate.currency": convertCurrency,
              },
            }
          );

          if (orderDetails?.isCaptainPerformingOrder) {
            await this.UpdateDBForCaptainOrder(
              orderDetails.user.email,
              orderDetails.captainBeeEmail,
              orderDetails
            );
          }
          console.log("2", convertToCurrency);
          console.log("convertCurrency", convertCurrency);
          console.log("updateOrder", updateOrder);
          let user = await uservice.findOne({
            _id: orderDetails.user.userId,
          });
          if (
            await this.checkAndCreateUserWallet(user.email, convertToCurrency)
          ) {
            console.log("inside sell updateUser1");
            //update 1 for user increment fiat value
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertToCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": afterOurFees,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          if (
            await this.checkAndCreateUserWallet(user.email, convertCurrency)
          ) {
            console.log("inside sell updateUser2");

            // update 2 for user decrement crypto value
            let updateUser2 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * convertAmount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          return { status: 200, data: "Updated user balances" };
        } else if (
          convertCurrency.localeCompare("IN500") == 0 ||
          convertCurrency.localeCompare("INEX") == 0 ||
          convertCurrency.localeCompare("INXC") == 0 ||
          convertCurrency.localeCompare("WIBS") == 0 ||
          convertCurrency.localeCompare("DaCrazy") == 0 ||
          convertCurrency.localeCompare("IUSD+") == 0
        ) {
          let latestBaseRate = await currencyService.findOne({
            code: convertCurrency,
          });
          totalOutAmount = convertAmount * latestBaseRate.sellPrice;
          let afterOurFees =
            totalOutAmount -
            totalOutAmount * (Number(orderDetails?.exchangeFees) / 100);

          console.log(totalOutAmount);
          console.log(afterOurFees);
          //update order
          let updateOrder1 = await this.updatePart(
            {
              _id: orderDetails._id,
            },
            {
              $set: {
                status: "Completed",
                orderCompletedOn: new Date(),
                "breakdown.outAmount": afterOurFees,
                "orderRate.rate": latestBaseRate.buyPrice,
                "orderRate.currency": latestBaseRate.code,
              },
            }
          );

          if (orderDetails?.isCaptainPerformingOrder) {
            await this.UpdateDBForCaptainOrder(
              orderDetails.user.email,
              orderDetails.captainBeeEmail,
              orderDetails
            );
          }
          let user = await uservice.findOne({
            _id: orderDetails.user.userId,
          });
          console.log("2", convertToCurrency);
          console.log("convertCurrency", convertCurrency);
          console.log("updateOrder1", updateOrder1);
          if (
            await this.checkAndCreateUserWallet(user.email, convertToCurrency)
          ) {
            console.log("inside sell updateUser1");
            //update 1 for user increment fiat value
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertToCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": afterOurFees,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          if (
            await this.checkAndCreateUserWallet(user.email, convertCurrency)
          ) {
            console.log("inside sell updateUser2");

            // update 2 for user decrement crypto value
            let updateUser2 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * convertAmount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          return { status: 200, data: "Updated user balances" };
        } else if (
          convertCurrency.localeCompare("EQSTK") == 0 ||
          convertCurrency.localeCompare("CRYC10") == 0 ||
          convertCurrency.localeCompare("ALCRYP") == 0 ||
          convertCurrency.localeCompare("TOB") == 0 ||
          convertCurrency.localeCompare("INDXXF") == 0
        ) {
          let latestBaseRate = await getLatestPriceOfETF(convertCurrency);
          console.log(latestBaseRate, "a");
          totalOutAmount =
            convertAmount * Number(latestBaseRate.data?.totalETFPrice);
          let afterOurFees =
            totalOutAmount -
            totalOutAmount * (Number(orderDetails.exchangeFees) / 100);
          console.log("afterOurFees", afterOurFees);
          //update order
          let updateOrder = await this.updatePart(
            {
              _id: orderDetails._id,
            },
            {
              $set: {
                status: "Completed",
                orderCompletedOn: new Date(),
                "breakdown.outAmount": afterOurFees,
                "orderRate.rate": latestBaseRate.data,
                "orderRate.currency": convertCurrency,
              },
            }
          );

          if (orderDetails?.isCaptainPerformingOrder) {
            await this.UpdateDBForCaptainOrder(
              orderDetails.user.email,
              orderDetails.captainBeeEmail,
              orderDetails
            );
          }
          console.log("2", convertToCurrency);
          console.log("convertCurrency", convertCurrency);
          console.log("updateOrder", updateOrder);
          let user = await uservice.findOne({
            _id: orderDetails.user.userId,
          });
          if (
            await this.checkAndCreateUserWallet(user.email, convertToCurrency)
          ) {
            console.log("inside sell updateUser1");
            //update 1 for user increment fiat value
            let updateUser1 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertToCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": afterOurFees,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          if (
            await this.checkAndCreateUserWallet(user.email, convertCurrency)
          ) {
            console.log("inside sell updateUser2");

            // update 2 for user decrement crypto value
            let updateUser2 = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": convertCurrency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * convertAmount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
          }
          return { status: 200, data: "Updated user balances" };
        }
      } catch (err) {
        return { status: 500, data: "Failed to update user balances" };
      }
    }
  }

  //Method to update check and create a new wallet if not avaliable
  async checkAndCreateUserWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean,
    network?: string
  ) {
    try {
      let user = await uservice.findOne({ email: email });
      let userWallets = freeTrailUserWallets
        ? user.freeTrailUserWallets
        : user.userWallets;
      const COIN = String(coin ?? "").trim().toUpperCase();
      const NET = (network ?? "").trim();

      // ✅ Return true only if:
      // - coin matches AND
      // - if network arg is provided, it must match too
      const wallet = userWallets?.find((w: any) =>
        String(w?.coinSymbol ?? "").toUpperCase() === COIN &&
        (NET ? String(w?.coinNetwork ?? "") === NET : true)
      );

      if (wallet) {
        return true;
      } else {
        console.log("wallet no t found", coin);
        console.log(coin == "BTC");
        console.log("G", coin == "IUSD+");
        let dataResults;
        if (coin == "BTC") {
          dataResults = await this.createBitcoinWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "ETH") {
          dataResults = await this.createEthereumWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "BNB") {
          dataResults = await this.createBinanceWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "IN500") {
          dataResults = await this.createIN500Wallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "INXC") {
          dataResults = await this.createINXCWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "IUSD+") {
          dataResults = await this.createIUSDPWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "BUSD") {
          dataResults = await this.createBUSDWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "INEX") {
          dataResults = await this.createINEXWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
          dataResults = await this.createMATICINEXWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin == "WIBS" ) {
          if(network === "Solana") {
          dataResults = await this.createSOLWIBSWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else {
          dataResults = await this.createETHWIBSWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        }
        }
        else if (coin == "DaCrazy") {
          dataResults = await this.createDaCrazyWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin == "LTC") {
          dataResults = await this.createLitecoinWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "USD") {
          dataResults = await this.createUSDWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "INXP") {
          dataResults = await this.createINXPWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "TOB") {
          dataResults = await this.createTOBWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "INDXXF") {
          dataResults = await this.createINDXXFWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "ALCRYP") {
          dataResults = await this.createALCRYPWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "CRYC10") {
          dataResults = await this.createCRYC10Wallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "EQSTK") {
          dataResults = await this.createEQSTKWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "DOGE") {
          dataResults = await this.createDOGEWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "CHZ") {
          dataResults = await this.createChilizWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "VET") {
          dataResults = await this.createVETWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "BTCY" && network === "Ying Yang Chain") {
          dataResults = await this.createBitcoinYahWalletReal(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "BTCY") {
          dataResults = await this.createBitcoinYahWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        }
        else if (coin === "AVAX") {
          dataResults = await this.createAVAXWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "THETA") {
          dataResults = await this.createTHETAWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "NOT") {
          dataResults = await this.createNotWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "FTM") {
          dataResults = await this.createFTMWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "RUNE") {
          dataResults = await this.createThorChainWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "NEAR") {
          dataResults = await this.createNEARWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "AAVE") {
          dataResults = await this.createAAVEWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "INJ") {
          dataResults = await this.createINJWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "PYTH") {
          dataResults = await this.createPYTHWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "BEAM") {
          dataResults = await this.createBEAMWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "ADA") {
          dataResults = await this.createADAWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "XLM") {
          dataResults = await this.createXLMWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "SUI") {
          dataResults = await this.createSUIWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        }
        else if (coin === "MANA") {
          dataResults = await this.createMANAWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "DAI") {
          dataResults = await this.createDAIBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "SHIB") {
          dataResults = await this.createSHIBBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "XRP") {
          dataResults = await this.createRippleWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "TRX") {
          dataResults = await this.createTRONBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "TUSD") {
          dataResults = await this.createTUSDBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "USDT") {
          dataResults = await this.createUSDTBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "USDC") {
          dataResults = await this.createUSDCBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "SOL") {
          dataResults = await this.createSolanaWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "LINK") {
          dataResults = await this.createLINKBNBWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "DOT") {
          dataResults = await this.createDOTWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "MATIC") {
          dataResults = await this.createMaticWallet(
            email,
            coin,
            0,
            freeTrailUserWallets
          );
        } else if (coin === "USD") {
          dataResults = await this.createUSDWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "WIBS") {
          dataResults = await this.createETHWIBSWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        } else if (coin === "BTCY") {
          dataResults = await this.createBitcoinYahWallet(
            email,
            coin,
            freeTrailUserWallets
          );
        }
        // } else  if (coin === "TON") {
        //   dataResults = await this.createTONBNBWallet(email, coin);
        // }
        return true;
      }
    } catch (err) {
      return false;
    }
  }

  get userLiteFields() {
    return {
      userId: 1,
      email: 1,
      firstName: 1,
      lastName: 1,
      role: 1,
      isVerified: 1,
      language: 1,
    };
  }

  async createBitcoinWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      let TESTNET;
      let keyPair;
      let address;
      let encryptedPrivateKey;
      if (user) {
        if (env == "development" || env == "test") {
          TESTNET = bitcoin.networks.testnet;
          keyPair = ECPair.makeRandom({ network: TESTNET });
          address = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: TESTNET,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        } else if (env == "prod" || env == "main") {
          keyPair = ECPair.makeRandom({ network: bitcoin.networks.bitcoin });
          address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        }
        let createUserWallet = {
          userId: user._id,
          coinSymbol: coin,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address.address,
          coinPrivateKey: encryptedPrivateKey,
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: "Bitcoin",
          coinName: "Bitcoin",
          coinDecimals: 8,
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as unknown as UserWallet;
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: address.address };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBitcoinYahWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});

      if (user) {
        // Generate Stellar Keypair
        const keypair = StellarSdk.Keypair.random();
        const address = keypair.publicKey(); // Stellar Public Address
        const encryptedPrivateKey = encryptData(keypair.secret()); // Encrypt Secret Key

        let createUserWallet = {
          userId: user._id,
          coinSymbol: coin, // BTCY for Bitcoin Yahwee
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address, // Stellar Public Key
          coinPrivateKey: encryptedPrivateKey, // Encrypted Stellar Secret Key
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: "Stellar",
          coinName: "Bitcoin Yay",
          coinDecimals: 7, // Stellar uses 7 decimals
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as unknown as UserWallet;

        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: createUserWallet };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: "Error creating wallet" };
    }
  }

  async createBitcoinYahWalletReal(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean,
    forceCreateNewWallet: boolean = false
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});

      if (user) {
        const walletCollection = (freeTrailUserWallets
          ? user.freeTrailUserWallets
          : user.userWallets) || [];

        const existingWallet = walletCollection.find(
          (wallet: any) =>
            wallet?.coinSymbol === coin &&
            wallet?.coinNetwork === "Ying Yang Chain"
        );

        if (existingWallet && !forceCreateNewWallet) {
          return {
            status: 200,
            data: existingWallet,
            message: "BTCY wallet already exists on Ying Yang Chain",
          };
        }

        // Generate Stellar Keypair
        const keypair = StellarSdk.Keypair.random();
        const address = keypair.publicKey(); // Stellar Public Address
        const encryptedPrivateKey = encryptData(keypair.secret()); // Encrypt Secret Key

        let createUserWallet = {
          userId: user._id,
          coinSymbol: coin, // BTCY for Bitcoin Yahwee
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address, // Stellar Public Key
          coinPrivateKey: encryptedPrivateKey, // Encrypted Stellar Secret Key
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: "Ying Yang Chain",
          coinName: "Bitcoin Yay",
          coinDecimals: 7, // Ying Yang Chain uses 7 decimals
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as unknown as UserWallet;

        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        console.log("wallet", wallet);

        return { status: 200, data: createUserWallet };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: "Error creating wallet" };
    }
  }

  async createUSDWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        let createUserWallet = {
          userId: user._id,
          coinSymbol: coin,
          coinType: CurrencyType.Fiat,
          coinWalletAddress: "",
          coinPrivateKey: "",
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: "USD",
          coinName: "USD",
          coinDecimals: 2,
          coinBalanceInUSD: 0,
          coinStakedBalance: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as UserWallet;
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: "USD wallet created" };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createLitecoinWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      if (!(env == "development" || env == "test")) {
        const ltcnet = {
          messagePrefix: "\x19Litecoin Signed Message:\n",
          bech32: "ltc",
          bip32: {
            public: 0x043587cf,
            private: 0x04358394,
          },
          pubKeyHash: 0x6f,
          scriptHash: 0xc4, //  for segwit (start with 2)
          wif: 0xef,
        };
        const keyPair = ECPair.makeRandom({ network: ltcnet });
        const { address } = bitcoin.payments.p2pkh({
          pubkey: keyPair.publicKey,
          network: ltcnet,
        });
        const encryptedPrivateKey = encryptData(keyPair.toWIF());
        console.log(address);
        return { status: 200, data: address };
      } else {
        const LITECOIN = {
          messagePrefix: "\x19Litecoin Signed Message:\n",
          bech32: "ltc",
          bip32: {
            public: 0x019da462,
            private: 0x019d9cfe,
          },
          pubKeyHash: 0x30,
          scriptHash: 0x32,
          wif: 0xb0,
        };

        const keyPair = ECPair.makeRandom({ network: LITECOIN });
        const { address } = bitcoin.payments.p2pkh({
          pubkey: keyPair.publicKey,
          network: LITECOIN,
        });
        let getUser = await uservice.findOne({ email: email });

        let createUserWallet = {
          userId: getUser._id,
          coinType: "Crypto",
          coinWalletAddress: String(address),
          coinPrivateKey: String(keyPair.publicKey),
          coinNetwork: "Litecoin",
          coinName: "Litecoin",
          coinSymbol: coin,
          coinDecimals: 8,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: address };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createEthereumWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Ethereum",
          coinSymbol: "ETH",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBinanceWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Binance",
          coinSymbol: "BNB",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createChilizWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Chiliz",
          coinSymbol: "CHZ",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createNotWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ton Chain",
          coinName: "Notcoin",
          coinSymbol: "NOT",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createFTMWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Fantom",
          coinSymbol: "FTM",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createThorChainWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Thor Chain",
          coinName: "Thor Chain",
          coinSymbol: "RUNE",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createNEARWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Near Protocol",
          coinName: "Near Protocol",
          coinSymbol: "NEAR",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createAAVEWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Aave Coin",
          coinSymbol: "AAVE",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINJWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Injective",
          coinSymbol: "INJ",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createPYTHWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Solona",
          coinName: "Pyth Network",
          coinSymbol: "PYTH",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBEAMWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Beam",
          coinSymbol: "BEAM",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createVETWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "VeChain",
          coinName: "VeChain",
          coinSymbol: "VET",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createAVAXWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Avalanche",
          coinName: "Avalanche",
          coinSymbol: "AVAX",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createTHETAWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Theta Network",
          coinName: "Theta Network",
          coinSymbol: "THETA",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createADAWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Cardano",
          coinName: "Cardano",
          coinSymbol: "ADA",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMANAWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Decentraland",
          coinSymbol: "MANA",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createXLMWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Stellar",
          coinName: "Steller",
          coinSymbol: "XLM",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }


  async createSUIWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "SUI Network",
          coinName: "SUI",
          coinSymbol: "SUI",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIN500Wallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Indexx500",
          coinSymbol: "IN500",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIAppleWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxAppleStock",
          coinSymbol: "APPL",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIAmazonWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxAmazonStock",
          coinSymbol: "AMZN",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIBroadcomWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxBroadcomStock",
          coinSymbol: "BCM",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIGoogleWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxGoogleStock",
          coinSymbol: "GOOGL",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIMetaWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxMetaStock",
          coinSymbol: "META",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIMicrosoftWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxMicrosoftStock",
          coinSymbol: "MSFT",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIPespiCoWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxPespiStock",
          coinSymbol: "PEP",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINividaWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxNividaStock",
          coinSymbol: "NVDA",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createISNP500Wallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxSNP500Stock",
          coinSymbol: "SNP500",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createITelsaWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxTelsaStock",
          coinSymbol: "TSLA",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINXCWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxCrypto",
          coinSymbol: "INXC",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createFTTETHWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "FTX Token",
          coinSymbol: "FTT",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createDaCrazyWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "DaCrazyHawaiian",
          coinSymbol: "DaCrazy",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIUSDPWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxUSD+",
          coinSymbol: "IUSD+",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHWIBSWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "WhoIsBitcoinSatoshi",
          coinSymbol: "WIBS",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createSOLWIBSWallet(
    email: string,
    coin: string = "",
        freeTrailUserWallets?: boolean,
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        const addressData = Keypair.generate();
        const address = addressData.publicKey.toString();

        let encryptedPrivateKey = await encryptData(addressData.secretKey);
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address,
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Solana",
          coinName: "WhoIsBitcoinSatoshi",
          coinSymbol: "WIBS",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }


  async createINEXWallet(
    email: string,
    coin: string,
    balance: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMATICINEXWallet(
    email: string,
    coin: string = "",
    balance: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polygon",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINXPWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "IndexxPheonix",
          coinSymbol: "INXP",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createTOBWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "NoNetwork",
          coinName: "TokenBlendETF",
          coinSymbol: "TOB",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINDXXFWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "NoNetwork",
          coinName: "IndexxFocusETF",
          coinSymbol: "INDXXF",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createALCRYPWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "NoNetwork",
          coinName: "AltCryptoAlphaETF",
          coinSymbol: "ALCRYP",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createCRYC10Wallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "NoNetwork",
          coinName: "CryptoCap10ETF",
          coinSymbol: "CRYC10",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createEQSTKWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "NoNetwork",
          coinName: "EquiStocksETF",
          coinSymbol: "EQSTK",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBUSDWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Binance USD",
          coinSymbol: "BUSD",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async checkUserWalletBalance(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let getUserWallets = await uservice.findOne({
        email: email,
      });
      if (getUserWallets) {
        let userWallet = getUserWallets.userWallets.find(
          (x) => x.coinSymbol == coin
        ) as UserWallet;
        if (userWallet?.coinBalance !== undefined) {
          return userWallet?.coinBalance;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    } catch (err) {
      console.log("err");
      return 0;
    }
  }

  async createDOGEWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      let currentNetwork;
      let keyPair;
      let address;
      let encryptedPrivateKey;
      if (user) {
        if (env === "development" || env === "test") {
          const DOGE_TESTNET = {
            messagePrefix: "\x19Dogecoin Signed Message:\n",
            bip32: {
              public: 0x0432a9a8,
              private: 0x0432a243,
            },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1,
          } as Network;
          currentNetwork = DOGE_TESTNET;
          keyPair = ECPair.makeRandom({ network: currentNetwork });
          address = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: currentNetwork,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        } else if (env === "production" || env === "prod") {
          const DOGE_MAINNET = {
            messagePrefix: "\x19Dogecoin Signed Message:\n",
            bip32: {
              public: 0x02facafd,
              private: 0x02fac398,
            },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e,
          } as Network;
          currentNetwork = DOGE_MAINNET;
          keyPair = ECPair.makeRandom({ network: currentNetwork });
          address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        }
        let createUserWallet = {
          userId: user._id,
          coinSymbol: "DOGE",
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address.address,
          coinPrivateKey: encryptedPrivateKey,
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: "Dogecoin",
          coinName: "Dogecoin",
          coinDecimals: 8,
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as UserWallet;
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: address.address };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: "An error occurred" };
    }
  }

  async createRippleWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      let networkLabel;

      // Determine environment and label accordingly
      if (env === "development" || env === "test") {
        networkLabel = "Ripple Testnet";
      } else if (env === "production" || env === "prod") {
        networkLabel = "Ripple Mainnet";
      }

      if (user) {
        const wallet = XRPWallet.generate();

        const encryptedPrivateKey = encryptData(wallet.privateKey); // Encrypting the private key for security

        let createUserWallet = {
          userId: user._id,
          coinSymbol: coin,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: wallet.classicAddress,
          coinPrivateKey: encryptedPrivateKey,
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: networkLabel, // Using the determined label here
          coinName: "Ripple",
          coinDecimals: 6, // XRP has a fixed scale of 6 decimal places
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as UserWallet;

        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let updateWallet = await uservice.updatePart(
          { email: email },
          updateData
        );

        return { status: 200, data: wallet.classicAddress };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return;
    }
  }

  async createUSDCBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "USDC",
          coinSymbol: "USDC",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMaticWallet(
    email: string,
    coin: string = "",
    balance: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polygon",
          coinName: "Polygon",
          coinSymbol: "MATIC",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBCHWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});

      let TESTNET;
      let keyPair;
      let addressObj;
      let encryptedPrivateKey;

      if (user) {
        if (env === "development" || env === "test") {
          TESTNET = bitcoincashjs.networks.testnet;
          keyPair = bitcoincashjs.ECPair.makeRandom({ network: TESTNET });
          addressObj = bitcoincashjs.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: TESTNET,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        } else if (env === "production" || env === "prod") {
          keyPair = bitcoincashjs.ECPair.makeRandom({
            network: bitcoincashjs.networks.bitcoin,
          });
          addressObj = bitcoincashjs.payments.p2pkh({
            pubkey: keyPair.publicKey,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        }

        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressObj.address,
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Bitcoin Cash",
          coinName: "Bitcoin Cash",
          coinSymbol: "BCH",
          coinDecimals: 8,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };

        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createDOTWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});

      const mnemonic = mnemonicGenerate();
      const keyring = new Keyring({ type: "sr25519" });
      const pair = keyring.addFromMnemonic(mnemonic);

      let address = pair.address;
      let encryptedPrivateKey = encryptData(mnemonic); // Storing mnemonic as the private key

      if (user) {
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address,
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polkadot",
          coinName: "Polkadot",
          coinSymbol: "DOT",
          coinDecimals: 10, // DOT has 10 decimals
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };

        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createTUSDBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "True USD",
          coinSymbol: "TUSD",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createLEOWallet(
    email: string,
    coin: string,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "UNUS SED LEO",
          coinSymbol: "LEO",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createUSDTBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Tether",
          coinSymbol: "USDT",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createTONBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Toncoin",
          coinSymbol: "TON",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createDAIBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Dai",
          coinSymbol: "DAI",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createLINKBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "ChainLink",
          coinSymbol: "LINK",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createSHIBBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Shiba Inu",
          coinSymbol: "SHIB",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  // async createCardanoWallet(email: string, coin: string, amount: number = 0, freeTrailUserWallets?: boolean) {
  //   try {
  //     let user = await uservice.findOneSelect({ email: email }, {});

  //     if (user) {
  //         // Create a new mnemonic (24 words)
  //         const mnemonic = Bip32PrivateKey.from_bip39_entropy(Buffer.from(Utils.getRandomBytes(32)), Buffer.from("")).to_bip39_mnemonic();

  //         // Generate a private key from the mnemonic
  //         const rootKey = Bip32PrivateKey.from_bip39_mnemonic(mnemonic);

  //         // Derive the first receiving address (using path m/44'/1815'/0'/0/0)
  //         const childKey = rootKey.derive([44 | 0x80000000, 1815 | 0x80000000, 0 | 0x80000000, 0, 0]);
  //         const publicKey = childKey.to_public();
  //         const address = EnterpriseAddress.new(0, StakeCredential.from_keyhash(Ed25519KeyHash.from_bytes(publicKey.as_bytes()))).to_address();

  //         const bech32Address = address.to_bech32();

  //         // Encrypt the mnemonic securely (assuming you have an encryptData function)
  //         let encryptedMnemonic = encryptData(mnemonic);

  //         let userWallet = {
  //             // ... [the rest of your fields]
  //             coinWalletAddress: bech32Address,
  //             coinPrivateKey: encryptedMnemonic,  // Storing encrypted mnemonic here
  //             // ... [the rest of your fields]
  //         } as UserWallet;

  //         let updateUser = await uservice.updatePart(
  //             { email: email },
  //             { $push: { userWallets: userWallet } }
  //         );

  //         return { status: 200, data: bech32Address };
  //     } else {
  //         return { status: 500, data: "User not found" };
  //     }
  // } catch (err) {
  //     console.log(err);
  //     return { status: 500, data: "An error occurred" };
  // }
  // }

  async createSolanaWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        const wallet = Keypair.generate();
        const address = wallet.publicKey.toString();

        let encryptedPrivateKey = await encryptData(wallet.secretKey);
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address,
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Solana",
          coinName: "Solana",
          coinSymbol: "SOL",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };

        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let updateWallet = await uservice.updatePart(
          { email: email },
          updateData
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: "An error occurred" };
    }
  }

  async createTRONBNBWallet(
    email: string,
    coin: string,
    amount: number = 0,
    freeTrailUserWallets?: boolean
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Tron",
          coinSymbol: "TRX",
          coinDecimals: 18,
          coinBalance: amount,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        // Update user's wallet field
        let updateData: any = {};

        if (freeTrailUserWallets) {
          updateData["$push"] = { freeTrailUserWallets: createUserWallet };
        } else {
          updateData["$push"] = { userWallets: createUserWallet };
        }

        let wallet = await uservice.updatePart({ email: email }, updateData);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  //Helper
  async UpdateDBForOrderCommission(
    honeyBeeEmail: string,
    CaptainEmail: string,
    order: Order
  ) {
    try {
      console.log(
        "honeyBeeEmail",
        honeyBeeEmail,
        order?.user?.email === honeyBeeEmail
      );
      console.log("CaptainEmail", CaptainEmail);
      console.log("order", order.orderId);
      let getCaptainData = await affilateService.findOne({
        Email: CaptainEmail,
      });
      let checkEmailIsCaptainBee = await affilateService.findOne({
        Email: honeyBeeEmail,
      });
      console.log("checkEmailIsCaptainBee", checkEmailIsCaptainBee);
      if (
        getCaptainData &&
        (order?.orderType === "Buy" ||
          order?.orderType === "PowerPack" ||
          order?.orderType === "MonthlyINEXBuy")
      ) {
        if (order && order?.user?.email === honeyBeeEmail) {
          let currentOrderCount = getCaptainData?.orderCount ?? 0;
          let currentCaptainOrderCount = getCaptainData?.captainOrderCount ?? 0;
          let currentTotalVolume = getCaptainData?.totalCaptainBeeVolume ?? 0;
          let currentHoneyBeeVolume = getCaptainData?.totalHoneyBeeVolume ?? 0;
          let currentTotalCommissionEarnedInUSD =
            getCaptainData?.totalCommissionEarned?.amountInUSD ?? 0;
          let currentTotalCommissionEarnedInINEX =
            getCaptainData?.totalCommissionEarned?.amountInINEX ?? 0;
          let currentTotalCommissionToBePaidInUSD =
            getCaptainData?.totalCommissionToBePaid?.amountInUSD ?? 0;
          let currentTotalCommissionToBePaidINEX =
            getCaptainData?.totalCommissionToBePaid?.amountInINEX ?? 0;
          let currentCommissionPercentage =
            getCaptainData?.commissionPercentage ?? 0;
          let currentRank = getCaptainData?.rank ?? "Bronze";
          let currentTotalHoneyBeeCommissionToBePaidInUSD = getCaptainData
            ?.totalHoneyBeeCommissionToBePaid.amountInUSD
            ? getCaptainData?.totalHoneyBeeCommissionToBePaid.amountInUSD
            : 0;
          let currentTotalHoneyBeeCommissionEarnedToBePaidINEX = getCaptainData
            ?.totalHoneyBeeCommissionToBePaid.amountInINEX
            ? getCaptainData?.totalHoneyBeeCommissionToBePaid.amountInINEX
            : 0;

          let currentTotalHoneyBeeCommissionEarnedInINEX = getCaptainData
            ?.totalHoneyBeeCommissionEarned.amountInINEX
            ? getCaptainData?.totalHoneyBeeCommissionEarned.amountInINEX
            : 0;

          let currentTotalHoneyBeeCommissionEarnedInUSD = getCaptainData
            ?.totalHoneyBeeCommissionEarned.amountInUSD
            ? getCaptainData?.totalHoneyBeeCommissionEarned.amountInUSD
            : 0;

          if (order.breakdown.outCurrencyName === "INEX") {
            let getLatestRankAndCommissionPer =
              calculateRankAndCommission(currentTotalVolume);

            let teamMembersByRank = await getAllTeamMemberRanks(
              getCaptainData.captainBees
            );
            console.log(
              "getLatestRankAndCommissionPer 0",
              getLatestRankAndCommissionPer
            );
            let userFamilyRank = teamMembersByRank
              ? calculateFamilyRank(
                getLatestRankAndCommissionPer.rank,
                teamMembersByRank
              )
              : undefined;

            let commissionAmountInUSD = 0;
            let commissionAmountInINEX = 0;
            console.log("userFamilyRank", userFamilyRank);
            if (userFamilyRank?.familyRank) {
              commissionAmountInUSD =
                (order.breakdown.inAmount *
                  (userFamilyRank.compensationInNumber / 100)) /
                2;
              commissionAmountInINEX = await calculateCommissionInINEX(
                order,
                userFamilyRank.compensationInNumber
              );
            } else {
              console.log(
                "getLatestRankAndCommissionPer",
                getLatestRankAndCommissionPer,
                order.breakdown.inAmount
              );
              commissionAmountInUSD =
                (order.breakdown.inAmount *
                  (getLatestRankAndCommissionPer.newCommissionPercentageNumber /
                    100)) /
                2;
              commissionAmountInINEX = await calculateCommissionInINEX(
                order,
                getLatestRankAndCommissionPer.newCommissionPercentageNumber
              );
              // (order.breakdown.inAmount *
              //   (getLatestRankAndCommissionPer.newCommissionPercentageNumber /
              //     100)) /
              // 2;
              console.log("commissionAmountInUSD", commissionAmountInUSD);
              console.log("commissionAmountInINEX", commissionAmountInINEX);
            }
            let updateFields: Record<string, any> = {
              orderCount: checkEmailIsCaptainBee
                ? currentOrderCount
                : currentOrderCount + 1,
              captainOrderCount: checkEmailIsCaptainBee
                ? currentCaptainOrderCount + 1
                : currentCaptainOrderCount,
              totalHoneyBeeVolume: checkEmailIsCaptainBee
                ? currentHoneyBeeVolume
                : currentHoneyBeeVolume + order.breakdown.inAmount,
              totalCaptainBeeVolume: checkEmailIsCaptainBee
                ? currentTotalVolume + order.breakdown.inAmount
                : currentHoneyBeeVolume,
              commissionPercentage: currentCommissionPercentage,
              rank: currentRank,
            };

            // Conditional fields based on checkEmailIsCaptainBee
            if (checkEmailIsCaptainBee) {
              updateFields = {
                ...updateFields,
                "totalCommissionEarned.amountInUSD":
                  currentTotalCommissionEarnedInUSD + commissionAmountInUSD,
                "totalCommissionEarned.amountInINEX":
                  currentTotalCommissionEarnedInINEX + commissionAmountInINEX,
                "totalCommissionToBePaid.amountInUSD":
                  currentTotalCommissionToBePaidInUSD + commissionAmountInUSD,
                "totalCommissionToBePaid.amountInINEX":
                  currentTotalCommissionToBePaidINEX + commissionAmountInINEX,
              };
            } else {
              updateFields = {
                ...updateFields,
                "totalHoneyBeeCommissionEarned.amountInUSD":
                  currentTotalHoneyBeeCommissionToBePaidInUSD +
                  commissionAmountInUSD,
                "totalHoneyBeeCommissionEarned.amountInINEX":
                  currentTotalHoneyBeeCommissionEarnedInINEX +
                  commissionAmountInINEX,
                "totalHoneyBeeCommissionToBePaid.amountInUSD":
                  currentTotalHoneyBeeCommissionEarnedInUSD +
                  commissionAmountInUSD,
                "totalHoneyBeeCommissionToBePaid.amountInINEX":
                  currentTotalHoneyBeeCommissionEarnedToBePaidINEX +
                  commissionAmountInINEX,
              };
            }

            //create the commission record
            let createCommissionStucture = {
              orderId: order.orderId,
              mainCaptainBeeEmail: CaptainEmail,
              captainBeeEmail: checkEmailIsCaptainBee ? honeyBeeEmail : "",
              honeyBeeEmail: checkEmailIsCaptainBee ? "" : honeyBeeEmail,
              commissionPercentage: userFamilyRank?.familyRank
                ? userFamilyRank.compensationInNumber
                : getLatestRankAndCommissionPer.newCommissionPercentageNumber, //15% or 20% or 25% or 30% or 35% or 40% or 45%
              finalCommissionAmountInUSD: commissionAmountInUSD, // orderAmount * commissionPercentage / 2(50 % of commission percentage in USD)
              finalCommissionAmountInINEX: commissionAmountInINEX, // orderAmount * commissionPercentage /2 (50 % of commission percentage in INEX)
              orderAmount: order.breakdown.inAmount,
              orderInCurrency: order.breakdown.inCurrenyName,
              orderOutCurrency: order.breakdown.outCurrencyName,
              orderType: order.orderType,
              name: "",
              rank: "",
            };
            // Perform the update
            let updateCaptainData = await affilateService.updatePart(
              { Email: CaptainEmail },
              { $set: updateFields }
            );
            console.log("updateCaptainData", updateCaptainData);
            let createCommission = await commissionService.create(
              createCommissionStucture
            );
          } else {
            // let getLatestRankAndCommissionPer =
            //   calculateRankAndCommission(currentTotalVolume);

            // let teamMembersByRank = await getAllTeamMemberRanks(
            //   getCaptainData.captainBees
            // );
            // console.log(
            //   "getLatestRankAndCommissionPer 0",
            //   getLatestRankAndCommissionPer
            // );
            // let userFamilyRank = teamMembersByRank ?
            //   calculateFamilyRank(
            //       getLatestRankAndCommissionPer.rank,
            //       teamMembersByRank
            //     )
            //   : undefined;
            let commissionAmountInUSD = 0;
            let commissionAmountInINEX = 0;
            // console.log("userFamilyRank", userFamilyRank);
            // if (userFamilyRank?.familyRank) {
            //   commissionAmountInUSD =
            //     (order.breakdown.inAmount *
            //       (userFamilyRank.compensationInNumber / 100)) /
            //     2;
            //   commissionAmountInINEX =
            //     (order.breakdown.inAmount *
            //       (userFamilyRank.compensationInNumber / 100)) /
            //     2;
            // } else {
            //   console.log("NOT INEX Ord")
            //   console.log(
            //     "getLatestRankAndCommissionPer",
            //     getLatestRankAndCommissionPer,
            //     order.breakdown.inAmount
            //   );
            let commissionForNonInexOrder = 2; // 2% commission for non inex orders
            commissionAmountInUSD =
              (order.breakdown.inAmount * (commissionForNonInexOrder / 100)) /
              2;
            commissionAmountInINEX = await calculateCommissionInINEX(
              order,
              commissionForNonInexOrder
            );
            //(order.breakdown.inAmount * (commissionForNonInexOrder / 100)) / 2;
            console.log("commissionAmountInUSD", commissionAmountInUSD);
            console.log("commissionAmountInINEX", commissionAmountInINEX);
            // }
            // let updateCaptainData = await affilateService.updatePart(
            //   {
            //     Email: CaptainEmail,
            //   },
            //   {
            //     $set: {
            //       orderCount: checkEmailIsCaptainBee
            //         ? currentOrderCount
            //         : currentOrderCount + 1,
            //       captainOrderCount: checkEmailIsCaptainBee
            //         ? currentCaptainOrderCount + 1
            //         : currentCaptainOrderCount,
            //       totalHoneyBeeVolume: checkEmailIsCaptainBee
            //         ? currentHoneyBeeVolume
            //         : currentHoneyBeeVolume + order.breakdown.inAmount,
            //       totalCaptainBeeVolume: checkEmailIsCaptainBee
            //         ? currentTotalVolume + order.breakdown.inAmount
            //         : currentHoneyBeeVolume,
            //       "totalCommissionEarned.amountInUSD":
            //         currentTotalCommissionEarnedInUSD + commissionAmountInUSD,
            //       "totalCommissionEarned.amountInINEX":
            //         currentTotalCommissionEarnedInINEX + commissionAmountInINEX,
            //       "totalCommissionToBePaid.amountInUSD":
            //         currentTotalCommissionToBePaidInUSD + commissionAmountInUSD,
            //       "totalCommissionToBePaid.amountInINEX":
            //         currentTotalCommissionToBePaidINEX + commissionAmountInINEX,
            //       commissionPercentage: currentCommissionPercentage,
            //       rank: currentRank,
            //     },
            //   }
            // );

            let updateFields: Record<string, any> = {
              orderCount: checkEmailIsCaptainBee
                ? currentOrderCount
                : currentOrderCount + 1,
              captainOrderCount: checkEmailIsCaptainBee
                ? currentCaptainOrderCount + 1
                : currentCaptainOrderCount,
              totalHoneyBeeVolume: checkEmailIsCaptainBee
                ? currentHoneyBeeVolume
                : currentHoneyBeeVolume + order.breakdown.inAmount,
              totalCaptainBeeVolume: checkEmailIsCaptainBee
                ? currentTotalVolume + order.breakdown.inAmount
                : currentHoneyBeeVolume,
              commissionPercentage: currentCommissionPercentage,
              rank: currentRank,
            };

            // Conditional fields based on checkEmailIsCaptainBee
            if (checkEmailIsCaptainBee) {
              updateFields = {
                ...updateFields,
                "totalCommissionEarned.amountInUSD":
                  currentTotalCommissionEarnedInUSD + commissionAmountInUSD,
                "totalCommissionEarned.amountInINEX":
                  currentTotalCommissionEarnedInINEX + commissionAmountInINEX,
                "totalCommissionToBePaid.amountInUSD":
                  currentTotalCommissionToBePaidInUSD + commissionAmountInUSD,
                "totalCommissionToBePaid.amountInINEX":
                  currentTotalCommissionToBePaidINEX + commissionAmountInINEX,
              };
            } else {
              updateFields = {
                ...updateFields,
                "totalHoneyBeeCommissionEarned.amountInUSD":
                  currentTotalHoneyBeeCommissionToBePaidInUSD +
                  commissionAmountInUSD,
                "totalHoneyBeeCommissionEarned.amountInINEX":
                  currentTotalHoneyBeeCommissionEarnedInINEX +
                  commissionAmountInINEX,
                "totalHoneyBeeCommissionToBePaid.amountInUSD":
                  currentTotalHoneyBeeCommissionEarnedInUSD +
                  commissionAmountInUSD,
                "totalHoneyBeeCommissionToBePaid.amountInINEX":
                  currentTotalHoneyBeeCommissionEarnedToBePaidINEX +
                  commissionAmountInINEX,
              };
            }
            let updateCaptainData = await affilateService.updatePart(
              { Email: CaptainEmail },
              { $set: updateFields }
            );
            //create the commission record
            let createCommissionStucture = {
              orderId: order.orderId,
              mainCaptainBeeEmail: CaptainEmail,
              captainBeeEmail: checkEmailIsCaptainBee ? honeyBeeEmail : "",
              honeyBeeEmail: checkEmailIsCaptainBee ? "" : honeyBeeEmail,
              commissionPercentage: commissionForNonInexOrder, //2% for non inex orders
              finalCommissionAmountInUSD: commissionAmountInUSD, // orderAmount * commissionPercentage / 2(50 % of commission percentage in USD)
              finalCommissionAmountInINEX: commissionAmountInINEX, // orderAmount * commissionPercentage /2 (50 % of commission percentage in INEX)
              orderAmount: order.breakdown.inAmount,
              orderInCurrency: order.breakdown.inCurrenyName,
              orderOutCurrency: order.breakdown.outCurrencyName,
              orderType: order.orderType,
              name: "",
              rank: "",
            };

            console.log("updateCaptainData", updateCaptainData);
            let createCommission = await commissionService.create(
              createCommissionStucture
            );
          }
          let level2Commission =
            order.breakdown.outCurrencyName === "INEX" ? 2 : 0.1;
          await calculateAndUpdateCommissionForCaptains(
            order,
            CaptainEmail,
            honeyBeeEmail,
            level2Commission
          );
          //Check levels and add commission to them
        } else {
          let data = {
            message: "No Order Found Existing",
          };
          return data;
        }
      } else {
        let data = {
          message: "No Captain Bee Existing",
        };
        return data;
      }
    } catch (err) {
      console.log("error", err);
    }
  }

  async UpdateDBForCaptainOrder(
    honeyBeeEmail: string,
    CaptainEmail: string,
    order: Order
  ) {
    try {
      console.log(
        "honeyBeeEmail",
        honeyBeeEmail,
        order?.user?.email === honeyBeeEmail
      );
      console.log("CaptainEmail", CaptainEmail);
      console.log("order", order.orderId);
      let getCaptainData = await affilateService.findOne({
        Email: CaptainEmail,
      });

      if (getCaptainData) {
        if (order && order?.user?.email === honeyBeeEmail) {
          let currenctOrderCount = getCaptainData?.orderCount
            ? getCaptainData.orderCount
            : 0;
          let updateCaptainData = await affilateService.updatePart(
            {
              Email: CaptainEmail,
            },
            {
              $set: { orderCount: currenctOrderCount + 1 },
            }
          );
          console.log("updateCaptainData", updateCaptainData);
        } else {
          let data = {
            message: "No Order Found Existing",
          };
          return data;
        }
      } else {
        let data = {
          message: "No Captain Bee Existing",
        };
        return data;
      }
    } catch (err) {
      console.log("error");
    }
  }
}
