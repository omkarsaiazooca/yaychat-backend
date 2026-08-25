import { Request, Response } from "express";
import { BaseAPIOperations } from "./base.operations";
import { UserService } from "../services/user.service";
import Binance from "node-binance-api";
import {
  BeeRelationship,
  CaptainBeeRelationship,
  Permissions,
  User,
  UserLite,
  UserRoleTypes,
  UserVerification,
  UserWallet,
} from "../data/user";
import {
  Address,
  AuthProviders,
  Currency,
  languageMap,
  Languages,
  PaymentTypes,
  ResponseData,
  TransactionAccount,
} from "../data/common";
import moment from "moment";
import { JwtAuthUtil } from "./jwt.operations";
import { MessageConstants } from "../data/constants";
import { SendEmail } from "../platform/email.operations";
import { OrderService } from "../services/order.service";
import { Order, OrderBreakdown } from "../data/order";
import { OrderStatus, OrderType, Rates } from "../data/order";
import { v1 as uuidv1 } from "uuid";
import { OrderTransaction } from "../data/order";
import { RewardService } from "../services/reward.service";
import { TransactionService } from "../services/transaction.service";
import { AppSettingsService } from "../services/appSettings.service";
import { CurrencyService } from "../services/currency.service";
import { IndexxService } from "../services/IndexxTokens.service";
import { OrderOperations } from "../platform/order.operations";
import { CoreWalletService } from "../services/coreWallet.service";
import { CoreWallet } from "../data/coreWallet";
import { keys } from "../config/keys";
import {
  BugDocument,
  BugDocumentLite,
  FileModes,
  FileTypes,
  UserBugs,
} from "../data/userBugs";
import { UserBugsService } from "../services/userBugs.service";
import { TaskCenterService } from "../services/taskCenter.service";

import {
  KYCPoints,
  signUpPoints,
  TaskCenter,
  tradeToEarnPercentage,
} from "../data/taskCenter";
import { PaypalService } from "../services/paypal.service";
import {
  createDEXPaypalOrder,
  createPaypalOrder,
  getSubscriptionDetails,
} from "./paypal.wrapper";
import { createFirstTimeWallets } from "../helpers/createWallet";
import { phoneQuery, toE164 } from "../helpers/phone";
import { AffilateService } from "../services/affiliate.service";
import { getLatestFTTPrice } from "../helpers/getFTTPrice";
import { getLatestStockPrice } from "../helpers/twelveDataLatestPrice";
import { getPrevDayPriceByName, getPriceByName } from "../controllers/priceAPI";
import { PowerPackService } from "../services/powerPack.service";
import { emailQueue, userTaskQueue } from "..";
import { PublicMessagesService } from "../services/publicMessages.service";
import { WalletUserService } from "../services/walletUser.service";
import { createUserWithEmailAndPasswordForWallet } from "../helpers/firebase";
import { WalletOperations } from "./wallet.operations";
import axios from "axios";
import { StakingService } from "../services/staking.service";
import { Staking } from "../data/staking";
import { logToFile } from "./log.operations";
import { CommissionService } from "../services/commission.service";
import { PaypalSubscriptionService } from "../services/paypalSubscription.service";
import { getLatestPriceOfETF } from "./etf.operations";
import { AirdropService } from "../services/airdrop.service";
import { Airdrop } from "../data/airdrop";
import { checkUserType } from "../helpers/checkUserTypeBasedOnEmail";
import { AdminAuditLogService } from "../services/adminAuditLogDB.servcie";
import { LotteryService } from "../services/lottery.service";
import { BitcoinAirdropService } from "../services/bitcoinAirdrop.service";
import { WhoIsBitcoinSatoshiAirdropService } from "../services/whoIsBitcoinSatoshiAirdrop.service";
import { Transaction } from "../data/transaction";
import { SubscriptionEmailsService } from "../services/subscriptionEmails.service";
import { ContactUsService } from "../services/contactUs.service";
import { WhoIsBitcoinSatoshiAirdrop27MayService } from "../services/whoIsBitcoinSatoshiAirdrop27May.service";
import { verifyAppleToken, verifyGoogleToken } from "../helpers/authHelpers";
import { UserOtpsService } from "../services/userOtps.service";
import {
  checkRegistration,
  validateLoginProvider,
} from "../helpers/checkRegisteration";
import { WhoIsBitcoinSatoshiAirdrop16JunService } from "../services/whoIsBitcoinSatoshiAirdrop16Jun.service";
import { WhoIsBitcoinSatoshiAirdrop29SepService } from "../services/whoIsBitcoinSatoshiAirdrop29Sep.service";
import { InvestmentService } from "../services/investment.service";
import { InvestmentRecord } from "../data/InvestmentRecord";
import { NewGiftCardService } from "../services/newGiftCard.service";
import { NewGiftCard } from "../data/newGiftCard";
import { ReferralEarningService } from "../services/referralEarning.service";
import { Affiliate } from "../data/affiliate";
import { TempAffilateService } from "../services/tempaffiliate.service";
import { createFreeGiftCard } from "../helpers/createShopGiftCard";
import { DacrazyAirdropService } from "../services/daCrazyAirdrop.service";
import { SmartCryptoService } from "../services/smartCrypto.service";
import { SmartApy } from "../data/smartAPY";
import { SmartAPYService } from "../services/smartAPY.service";
import { UserMiningBalanceService } from "../services/userMiningBalance.service";
import { smsService } from "../services/sms.service";
import { createClient } from "redis";
import { SubscriptionService } from "../services/subscription.service";
import { MiningService } from "../services/mining.service";
import { SubscriptionPlansService } from "../services/miningSubscriptionPlan.service";
import { BtcyAirdropService } from "../services/btcyairdrop.service";
import { Btcy4thJlyAirdropService } from "../services/btcy4thjlyairdrop.service";
import { BtcyLottoAirdropService } from "../services/btcyLottoairdrop.service";
import { BtcyNewYear2026AirdropService } from "../services/btcyNewYear2026Airdrop.service";
import { BtcyLoyaltyAirdrop2026Service } from "../services/btcyLoyaltyAirdrop2026.service";
import { WallstreetInexAirdropRegistrationService } from "../services/wallstreetInexAirdropRegistration.service";
import { BTCYSocialPostAirdropService } from "../services/btcySocialPostAirdrop.service";
import { NotificationService } from "../services/notification.service";
import jwt from "jsonwebtoken";
import { format } from "fast-csv";
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com",
    port: 11678,
  },
});

const mongoose = require("mongoose");
const referralCodes = require("referral-codes");
const binance = new Binance().options({
  APIKEY: keys.BinanceKey.key,
  APISECRET: keys.BinanceSecret.key,
  family: 0,
});
let subscriptionPlansService: SubscriptionPlansService =
  new SubscriptionPlansService();
let miningService: MiningService = new MiningService();
let subscriptionService: SubscriptionService = new SubscriptionService();
let adminAuditLogService: AdminAuditLogService = new AdminAuditLogService();
let uservice: UserService = new UserService();
let userOtpSerive: UserOtpsService = new UserOtpsService();
let emailService: SendEmail = new SendEmail();
let orderService: OrderService = new OrderService();
let rewardService: RewardService = new RewardService();
let indexxTokenService: IndexxService = new IndexxService();
let transactionService: TransactionService = new TransactionService();
let appSettingsService: AppSettingsService = new AppSettingsService();
let currencyService: CurrencyService = new CurrencyService();
let coreWalletService: CoreWalletService = new CoreWalletService();
let bugService: UserBugsService = new UserBugsService();
let taskCenterService: TaskCenterService = new TaskCenterService();
let paypalService: PaypalService = new PaypalService();
let paypalSubscriptionService: PaypalSubscriptionService =
  new PaypalSubscriptionService();
let affilateService: AffilateService = new AffilateService();
let tempAffilicateService: TempAffilateService = new TempAffilateService();
let powerPackService: PowerPackService = new PowerPackService();
let publicMessageService: PublicMessagesService = new PublicMessagesService();
let wuserservice: WalletUserService = new WalletUserService();
let stakingService: StakingService = new StakingService();
let smartAPYService: SmartAPYService = new SmartAPYService();
let commissionService: CommissionService = new CommissionService();
let airdropService: AirdropService = new AirdropService();
let bitcoinAirdropService: BitcoinAirdropService = new BitcoinAirdropService();
let whoIsBitcoinSatoshiAirdropService: WhoIsBitcoinSatoshiAirdropService =
  new WhoIsBitcoinSatoshiAirdropService();
let whoIsBitcoinSatoshiAirdrop27MayService: WhoIsBitcoinSatoshiAirdrop27MayService =
  new WhoIsBitcoinSatoshiAirdrop27MayService();
let whoIsBitcoinSatoshiAirdrop16JunService: WhoIsBitcoinSatoshiAirdrop16JunService =
  new WhoIsBitcoinSatoshiAirdrop16JunService();
let whoIsBitcoinSatoshiAirdrop29SepService: WhoIsBitcoinSatoshiAirdrop29SepService =
  new WhoIsBitcoinSatoshiAirdrop29SepService();
let dacrazyAirdropService: DacrazyAirdropService = new DacrazyAirdropService();
let btcyAirdropService: BtcyAirdropService = new BtcyAirdropService();
let btcy4thJlyAirdropService: Btcy4thJlyAirdropService = new Btcy4thJlyAirdropService();
let btcyLottoAirdropService: BtcyLottoAirdropService = new BtcyLottoAirdropService();
let btcyNewYear2026AirdropService: BtcyNewYear2026AirdropService =
  new BtcyNewYear2026AirdropService();
let btcyLoyaltyAirdrop2026Service: BtcyLoyaltyAirdrop2026Service =
  new BtcyLoyaltyAirdrop2026Service();
const wallstreetInexAirdropRegistrationService: WallstreetInexAirdropRegistrationService =
  new WallstreetInexAirdropRegistrationService();
const btcySocialPostAirdropService: BTCYSocialPostAirdropService =
  new BTCYSocialPostAirdropService();
const lotteryService: LotteryService = new LotteryService();
let emailsSubscriptionService: SubscriptionEmailsService =
  new SubscriptionEmailsService();
let contactUsService: ContactUsService = new ContactUsService();
const investmentService: InvestmentService = new InvestmentService();
const txService: TransactionService = new TransactionService();
const newGiftCardService: NewGiftCardService = new NewGiftCardService();
const referralEarningService: ReferralEarningService =
  new ReferralEarningService();
const smartCryptoService: SmartCryptoService = new SmartCryptoService();
const userMiningBalance: UserMiningBalanceService =
  new UserMiningBalanceService();
const notificationService: NotificationService = new NotificationService();
const VALID_MINING_PAYMENT_METHODS = new Set([
  "gpay",
  "paypal",
  "tygapay",
  "wiretransfer",
  "ach",
  "creditcard",
  "zelle",
]);
interface CaptainData {
  affiliateData: any; // Replace 'any' with more specific types as per your data model
  useFullData: any;
  powerPackData: any;
  ordersData: any;
  stakingData: any;
  transactionHistory: any;
  commissionData: any;
}

export class UserOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  get registerFields() {
    return {
      basic: 1,
      authProviders: 1,
      language: 1,
      email: 1,
      verification: 1,
      role: 1,
      userType: 1,
      referralCode: 1,
      referralCodeUsed: 1,
      isTestFundActive: 1,
      freeTrailStartDate: 1,
      isFreeTrailEnded: 1,
    };
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
      referralCode: 1
    };
  }

  get miningLiteFields() {
    return {
      userId: 1,
      email: 1,
      firstName: 1,
      lastName: 1,
      role: 1,
      isVerified: 1,
      language: 1,
      referralCode: 1,
      relationships: 1
    };
  }

  private resolveProfileEmail(req: any): { email?: string; status?: number; message?: string } {
    const authEmail = req.user?.email
      ? String(req.user.email).trim().toLowerCase()
      : "";

    const requestedEmail = req.body?.email
      ? String(req.body.email).trim().toLowerCase()
      : "";

    if (authEmail && requestedEmail && authEmail !== requestedEmail) {
      return {
        status: 403,
        message: "Authenticated user does not match the requested email",
      };
    }

    const email = authEmail || requestedEmail;
    if (!email) {
      return {
        status: 400,
        message: "Email is required",
      };
    }

    return { email };
  }

  private pickProfileString(rawValue: any): string | undefined {
    if (rawValue === undefined) {
      return undefined;
    }
    if (rawValue === null) {
      return "";
    }
    return String(rawValue).trim();
  }

  private pickProfileBoolean(rawValue: any): boolean | undefined {
    if (rawValue === undefined) {
      return undefined;
    }
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    if (typeof rawValue === "string") {
      if (rawValue.toLowerCase() === "true") {
        return true;
      }
      if (rawValue.toLowerCase() === "false") {
        return false;
      }
    }
    return undefined;
  }

  private buildS3PublicUrl(key: string): string {
    const bucketName = process.env.AWS_BUCKET_NAME as string;
    const region = process.env.AWS_REGION as string;
    const explicitBaseUrl =
      process.env.AWS_PUBLIC_BASE_URL || process.env.AWS_S3_PUBLIC_BASE_URL;

    if (explicitBaseUrl) {
      return `${explicitBaseUrl.replace(/\/+$/, "")}/${key}`;
    }

    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  private pickProfileImageValue(source: any): string | undefined {
    const directUrl = this.pickProfileString(
      source.profilePic ?? source.profileImageUrl ?? source.imageUrl
    );
    if (directUrl !== undefined) {
      return directUrl;
    }

    const uploadedKey = this.pickProfileString(
      source.profilePicKey ?? source.imageKey ?? source.s3Key ?? source.key
    );
    if (uploadedKey !== undefined && uploadedKey !== "") {
      return this.buildS3PublicUrl(uploadedKey);
    }

    return undefined;
  }

  private normalizeProfileUpdatePayload(body: any): Record<string, any> {
    const source = body?.profile || body?.updateData || body || {};
    const updatePayload: Record<string, any> = {};

    const firstName = this.pickProfileString(source.firstName ?? source.firstname);
    const lastName = this.pickProfileString(source.lastName ?? source.lastname);
    const username = this.pickProfileString(source.username);
    const phone = this.pickProfileString(source.phone);
    const country = this.pickProfileString(source.country);
    const walletAddress = this.pickProfileString(source.walletAddress);
    const profilePic = this.pickProfileImageValue(source);
    const bio = this.pickProfileString(source.bio);
    const isPhonePublic = this.pickProfileBoolean(source.isPhonePublic);
    const isEmailPublic = this.pickProfileBoolean(source.isEmailPublic);

    if (firstName !== undefined) {
      updatePayload.firstName = firstName;
    }
    if (lastName !== undefined) {
      updatePayload.lastName = lastName;
    }
    if (username !== undefined) {
      updatePayload.username = username;
    }
    if (phone !== undefined) {
      updatePayload.phone = phone;
    }
    if (country !== undefined) {
      updatePayload.country = country;
    }
    if (walletAddress !== undefined) {
      updatePayload.walletAddress = walletAddress;
    }
    if (profilePic !== undefined) {
      updatePayload.profilePic = profilePic;
    }
    if (bio !== undefined) {
      updatePayload.bio = bio;
    }
    if (isPhonePublic !== undefined) {
      updatePayload.isPhonePublic = isPhonePublic;
    }
    if (isEmailPublic !== undefined) {
      updatePayload.isEmailPublic = isEmailPublic;
    }

    return updatePayload;
  }

  private buildUserProfileResponse(user: any) {
    const plain =
      typeof user?.toObject === "function"
        ? user.toObject()
        : user?._doc
          ? { ...user._doc }
          : { ...user };

    return {
      email: plain.email,
      referralCode: plain.referralCode ?? "",
      username: plain.username ?? "",
      firstName: plain.firstName ?? "",
      lastName: plain.lastName ?? "",
      phone: plain.phone ?? "",
      country: plain.country ?? "",
      walletAddress: plain.walletAddress ?? "",
      profilePic: plain.profilePic ?? "",
      bio: plain.bio ?? "",
      isPhonePublic: plain.isPhonePublic ?? false,
      isEmailPublic: plain.isEmailPublic ?? false,
      kycStatus: plain.kycStatus ?? "",
      isKYCPass: plain.isKYCPass ?? false,
    };
  }

  async checkEmailIfAlreadyUsed(req: any, res: any, email: string) {
    try {
      let user = await uservice.findOne({ email: email });
      let walletUser = await wuserservice.findOne({ email: email });
      if (user || walletUser) {
        // Both user and walletUser were found, email is already used
        return { status: 200, data: "Email already in use", success: false };
      } else {
        // The email is not already in use
        return { status: 200, data: "Email is available", success: true };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async getUserMiningBalance(req: any, res: any) {
    try {
      let userBalance = await userMiningBalance.findOne({
        email: String(req.params.email).toLowerCase(),
        coinSymbol: req.params.coinSymbol,
      });
      if (userBalance) {
        return { status: 200, data: userBalance };
      } else {
        let createBalance = await userMiningBalance.create({
          email: String(req.params.email).toLowerCase(),
          transferableBalance: 0,
          migratedBalance: 0,
          unverifiedBalance: 0,
          createdAt: new Date(),
          coinSymbol: req.params.coinSymbol,
          coinName: req.params.coinSymbol === "BTCY" ? "Bitcoin Yay" : "",
          coinNetwork: req.params.coinSymbol === "BTCY" ? "Stellar" : "",
        });
        return { status: 200, data: createBalance };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async withdrawUserBalance(req: any, res: any) {
    try {
      let userBalance = await userMiningBalance.findOne({
        email: String(req.body.email).toLowerCase(),
        coinSymbol: req.body.coinSymbol,
      });
      const miningData = await miningService.getMiningData(String(req.body.email).toLowerCase(), req.body.coinSymbol);
      if (userBalance) {
        let withdrawableBalance = userBalance.transferableBalance + userBalance.unverifiedBalance;
        console.log("withdrawableBalance", withdrawableBalance);
        console.log("userBalance", userBalance);
        console.log("req.body.withdrawAmount", req.body.withdrawAmount);
        console.log("userBalance.transferableBalance", userBalance);
        if (withdrawableBalance > 0) {
          let updateBalance = await userMiningBalance.updatePart(
            {
              email: String(req.body.email).toLowerCase(),
              coinSymbol: req.body.coinSymbol,
            },
            {
              $inc: {
                transferableBalance: -1 * userBalance.transferableBalance,
                unverifiedBalance: -1 * userBalance.unverifiedBalance,
                migratedBalance: withdrawableBalance,
              },
            }
          );
          let updateMiningBalance = await miningService.updatePart({
            email: String(req.body.email).toLowerCase(),
            coinSymbol: req.body.coinSymbol,
          },
            {
              $inc: {
                totalMined: -1 * withdrawableBalance,
              }
            }
          );

          const normalizedEmail = String(req.body.email).toLowerCase();
          const coinSymbol = String(req.body.coinSymbol || "").toUpperCase();
          const targetNetwork = coinSymbol === "BTCY" ? "Stellar" : "";
          let getToUser = await uservice.findOne({ email: normalizedEmail });

          let findToUserCoinWallet = getToUser.userWallets.find(
            (wallet) => {
              if (coinSymbol === "BTCY") {
                return wallet.coinSymbol === coinSymbol && wallet.coinNetwork === targetNetwork;
              }
              return wallet.coinSymbol === coinSymbol;
            }
          );
          if (!findToUserCoinWallet) {
            // Create a wallet for the recipient if not exists
            await orderService.checkAndCreateUserWallet(
              normalizedEmail,
              coinSymbol,
              false,
              targetNetwork || undefined
            );
          }
          const walletQuery = coinSymbol === "BTCY"
            ? {
              email: normalizedEmail,
              userWallets: {
                $elemMatch: {
                  coinSymbol,
                  coinNetwork: targetNetwork,
                },
              },
            }
            : {
              email: normalizedEmail,
              "userWallets.coinSymbol": coinSymbol,
            };
          const walletUpdate = {
            $inc: {
              [coinSymbol === "BTCY" ? "userWallets.$[wallet].coinBalance" : "userWallets.$.coinBalance"]: withdrawableBalance,
            },
            $set: {
              [coinSymbol === "BTCY" ? "userWallets.$[wallet].coinLastUsedOn" : "userWallets.$.coinLastUsedOn"]: new Date(),
            },
          };
          let updateUser1 = coinSymbol === "BTCY"
            ? await uservice.updatePartWithOptions(
              walletQuery,
              walletUpdate,
              {
                arrayFilters: [
                  {
                    "wallet.coinSymbol": coinSymbol,
                    "wallet.coinNetwork": targetNetwork,
                  },
                ],
              }
            )
            : await uservice.updatePart(walletQuery, walletUpdate);

          if (coinSymbol === "BTCY" && !(updateUser1 as any)?.matchedCount) {
            return { status: 500, data: "BTCY Stellar wallet not found" };
          }

          await transactionService.create({
            email: normalizedEmail,
            orderId: uuidv1(),
            amount: withdrawableBalance,
            currencyRef: coinSymbol,
            transactionType: 'WITHDRAWAL',
            status: OrderStatus.Completed,
            to: normalizedEmail,
            info: "",
            walletType: "Asset Wallet",
            exchangeName: "CEX",
            txDate: new Date(),
            benificaryAddress: "",
            notes: coinSymbol === "BTCY" ? `Withdrawn to ${targetNetwork} wallet` : "",
          } as any);

          return { status: 200, data: "Withdraw successful" };
        } else {
          return { status: 400, data: "Insufficient balance" };
        }
      } else {
        return { status: 404, data: "User balance not found" };
      }

    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async getAllMiningUsers(req: any, res: any) {
    try {
      const { coinSymbol } = req.params;

      // Get all mining users with a given coinSymbol
      const miningUsers = await userMiningBalance.find({ coinSymbol });

      if (!miningUsers || miningUsers.length === 0) {
        return { status: 200, data: [] };
      }

      // Fetch user details and mining status for each user
      const enrichedUsers = await Promise.all(
        miningUsers.map(async (entry: any) => {
          const email = String(entry.email).toLowerCase().trim();
          const user = await uservice.findOne({ email });

          const miningData = await miningService.getMiningData(email, coinSymbol);

          return {
            name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
            email,
            phone: user?.phone || "N/A",
            balance: entry.unverifiedBalance || 0,
            isMining: miningData?.isMiningActive || false,
            profilePic: user?.profilePic || null,
            username: user?.username || "",
            referralCode: user?.referralCode || null
          };
        })
      );

      return {
        status: 200,
        data: enrichedUsers
      };
    } catch (err) {
      console.error("Error fetching mining users:", err);
      return {
        status: 500,
        data: "Internal server error"
      };
    }
  }

  async getUserMiningSubscriptionPlan(req: any, res: any) {
    try {
      let { email, coinSymbol } = req.params;
      const getUserSubscription = await subscriptionService.getUserSubscriptionForUi(
        email,
        coinSymbol
      );
      if (getUserSubscription) {
        return { status: getUserSubscription.status, data: getUserSubscription.data };
      } else {
        return { status: 500, data: [] };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async getUserMiningPlanWithPaymentMethod(req: any, res: any) {
    try {
      const email = String(req.params?.email || "").toLowerCase().trim();
      const coinSymbol = String(req.params?.coinSymbol || "").trim();

      if (!email || !coinSymbol) {
        return { status: 400, data: "coinSymbol and email are required" };
      }

      const subscriptionResponse = await subscriptionService.getUserSubscriptionForUi(
        email,
        coinSymbol
      );

      if (!subscriptionResponse || subscriptionResponse.status !== 200) {
        return {
          status: subscriptionResponse?.status ?? 500,
          data: subscriptionResponse?.data ?? subscriptionResponse?.message ?? "Unable to load plan",
        };
      }

      const subscriptionData = subscriptionResponse.data ?? {};
      const planName = (subscriptionData.planName || subscriptionData.plan || "Free").trim();
      const paymentMethod = (subscriptionData.paymentMethod || "").trim();
      const isPaymentMethodValid = paymentMethod
        ? VALID_MINING_PAYMENT_METHODS.has(paymentMethod.toLowerCase())
        : false;

      return {
        status: 200,
        data: {
          planName,
          paymentMethod,
          isPaymentMethodValid,
          miningRate: subscriptionData.miningRate ?? null,
          userType: subscriptionData.userType ?? null,
          coinSymbol: subscriptionData.coinSymbol || coinSymbol,
          status: subscriptionData.status ?? "Active",
          startDate: subscriptionData.startDate ?? null,
          endDate: subscriptionData.endDate ?? null,
        },
      };
    } catch (err) {
      console.error("Error fetching mining plan with payment:", err);
      return { status: 500, data: "Internal server error" };
    }
  }

  async getAllMiningSubscriptionPlan(req: any, res: any) {
    try {
      const getAllsubscriptionPlans = await subscriptionPlansService.find({});
      if (getAllsubscriptionPlans) {
        return { status: 200, data: getAllsubscriptionPlans };
      } else {
        return { status: 500, data: [] };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async checkEmailIfAlreadyUsedAndUserType0(req: any, res: any, email: string) {
    try {
      let user = await uservice.findOne({ email: email });
      let walletUser = await wuserservice.findOne({ email: email });

      if (user || walletUser) {
        let userType = await checkUserType(String(email));
        // Both user and walletUser were found, email is already used
        return {
          status: 200,
          data: "Email already in use",
          success: false,
          userType: userType,
        };
      } else {
        // The email is not already in use
        return { status: 200, data: "Email is available", success: true };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async checkEmailIfAlreadyUsedAndUserType(req: any, res: any, email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      // Fetch both user and walletUser in parallel
      const [user, walletUser] = await Promise.all([
        uservice.findOne({ email: normalizedEmail }),
        wuserservice.findOne({ email: normalizedEmail }),
      ]);

      if (user || walletUser) {
        const userType = user ? await checkUserType(normalizedEmail) : null;
        return {
          status: 200,
          data: "Email already in use",
          success: false,
          userType: userType,
        };
      }

      return { status: 200, data: "Email is available", success: true };
    } catch (err: any) {
      console.error("Error in checking email and user type: ", err.message);
      return { status: 500, data: "Failed in checking email" };
    }
  }


  async checkPhoneIfAlreadyUsedAndUserType(req: any, res: any, email: string) {
    try {
      const normalizedPhone = this.normalizePhone(email);

      // Fetch both user and walletUser in parallel
      const [user, walletUser] = await Promise.all([
        uservice.findOne({ phone: normalizedPhone }),
        wuserservice.findOne({ phone: normalizedPhone }),
      ]);

      if (user || walletUser) {
        const userType = user ? await checkUserType(user.email) : null;
        return {
          status: 200,
          data: "Phone Number already in use",
          success: false,
          userType: userType,
        };
      }

      return { status: 200, data: "Phone Number is available", success: true };
    } catch (err: any) {
      console.error("Error in checking Phone Number and user type: ", err.message);
      return { status: 500, data: "Failed in checking Phone Number" };
    }
  }

  // Helper to normalize email strings
  normalizeEmail(email: string) {
    return String(email).toLowerCase().trim();
  }

  // Helper to normalize email strings
  normalizePhone(phone: string) {
    return String(phone).toLowerCase().trim();
  }

  async checkWalletEmailIfAlreadyUsedAndUserType(
    req: any,
    res: any,
    email: string
  ) {
    try {
      let walletUser = await wuserservice.findOne({ email: email });

      if (walletUser) {
        let userType = "Web Wallet";
        // WalletUser were found, email is already used
        return {
          status: 200,
          data: "Email already in use",
          success: false,
          userType: userType,
        };
      } else {
        // The email is not already in use
        return { status: 200, data: "Email is available", success: true };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  async checkUsernameIfAlreadyUsed(req: any, res: any, username: string) {
    // Validate username
    if (!username || typeof username !== "string" || username.trim() === "") {
      return { status: 400, data: "Invalid username", success: false };
    }

    try {
      let checkUser, checkUAffiliateUser;

      try {
        checkUser = await uservice.findOne({ username: username });
      } catch (err) {
        console.error(`Error checking user service: ${err}`);
        return {
          status: 500,
          data: "Unexpected error in UserServiceError",
          success: false,
        };
      }

      try {
        checkUAffiliateUser = await affilateService.findOne({
          Username: username,
        });
      } catch (err) {
        console.error(`Error checking affiliate service: ${err}`);
        return {
          status: 500,
          data: "Unexpected error in AffiliateServiceError",
          success: false,
        };
      }

      if (checkUser || checkUAffiliateUser) {
        // Username is already used
        return { status: 200, data: "Username already in use", success: false };
      } else {
        // Username is available
        return { status: 200, data: "Username is available", success: true };
      }
    } catch (err: any) {
      console.error(`Error in checkUsernameIfAlreadyUsed: ${err}`);
      if (
        err.message === "UserServiceError" ||
        err.message === "AffiliateServiceError"
      ) {
        return {
          status: 502,
          data: "Failed to check username due to service error",
          success: false,
        };
      } else {
        return {
          status: 500,
          data: "Unexpected error occurred",
          success: false,
        };
      }
    }
  }

  async registerUser(
    req: any,
    res: any,
    email: string,
    password: string,
    username?: string,
    referralCode?: string,
    affiliateUserRegister?: boolean,
    type: string = "",
    UserCreatedFrom: string = "CEX"
  ) {
    try {
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let usernameExist;
      if (username) {
        usernameExist = await uservice.findOne({
          username: username,
        });
      }
      let usernameExistInAffiliate = undefined;
      if (!affiliateUserRegister) {
        usernameExistInAffiliate = await affilateService.findOne({
          Username: username,
        });
      }
      let walletregister = await wuserservice.findOne({
        email: email,
      });
      console.log(usernameExist);
      console.log(usernameExistInAffiliate);
      console.log(usernameExist || usernameExistInAffiliate);
      const SHORT_REFERRAL_CODE = "FREE500"; // New Short Referral Code
      const isValidReferral = referralCode === SHORT_REFERRAL_CODE;

      if (register || walletregister) {
        for (let i = 0; i < register.authProviders.length; i++) {
          if (register.authProviders[i].provider == "Local") {
            const message = MessageConstants.EmailRegistered;
            console.log("if")
            console.log(message);
            //const message = "emailRegistered";
            return { status: 500, data: message };
          }
        }
        const message = "emailRegistered";
        return { status: 500, data: message };
      } else if (usernameExist || usernameExistInAffiliate) {
        return {
          data: "Username already exists",
          status: 500,
        };
      } else {
        console.log(" i am here in main logic");
        const generateRefCode = referralCodes.generate({
          length: 8,
        });
        const newUser: User = {
          email: String(email).toLowerCase(),
          username: username,
          role: UserRoleTypes.Standard,
          authProviders: [{ provider: AuthProviders.Local }],
          verification: {
            emailVerified: true,
            emailVerifiedOn: new Date(),
          } as UserVerification,
          baseCurrency: Currency.USD,
          referralCodeUsed: referralCode,
          referralCode: generateRefCode[0],
        } as User;
        // If a valid referral is provided, activate Free Trial
        if (isValidReferral) {
          newUser.isTestFundActive = false;
          newUser.isWithdrawRestricted = true; // Prevent withdrawals until deposit
          console.log("✅ Free trial activated for:", email);
        }
        let getReferredUser;
        let getReferredUserTaskCenter;
        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          referralCode !== "FREE500"
        ) {
          getReferredUser = await uservice.findOne({
            referralCode: referralCode,
          });

          // Check if referral code is valid
          if (!getReferredUser) {
            return { status: 400, data: "Invalid referral code" };
          }

          getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
        }

        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          getReferredUser &&
          getReferredUserTaskCenter
        ) {
          console.log("inside updating the reffered user data");
          newUser.referralCodeUsed = String(referralCode);

          await taskCenterService.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $inc: { inivitedUsersCount: 1 },
              $set: {
                inivitedUsersEmail:
                  getReferredUserTaskCenter.inivitedUsersEmail.concat(
                    newUser.email
                  ),
              },
            }
          );
          let getAffiliateUser = await affilateService.findOne({
            Email: getReferredUser.email,
          });

          let getUser = await uservice.findOne({
            email: getReferredUser.email,
          });
          let existingRelationShips = getUser?.relationships || [];

          if (!existingRelationShips) {
            existingRelationShips = [];
          }

          let existingCaptainBeeRelationShips =
            getUser?.captainBeeRelationShips || [];

          if (!existingCaptainBeeRelationShips) {
            existingCaptainBeeRelationShips = [];
          }

          const defaultPermissions = {
            buy: false,
            buyApprovedOn: new Date(),
            sell: false,
            sellApprovedOn: new Date(),
            convert: false,
            convertApprovedOn: new Date(),
          };

          let existinghoneyBees = getAffiliateUser?.honeyBees || [];

          if (!existinghoneyBees) {
            existinghoneyBees = [];
          }

          let existingCaptainBees = getAffiliateUser?.captainBees || [];

          if (!existingCaptainBees) {
            existingCaptainBees = [];
          }

          console.log(
            "type === CaptainBeeRegister",
            type === "CaptainBeeRegister"
          );

          if (type === "HoneyBeeRegister") {
            existinghoneyBees.push(email);
            console.log("new bees", existinghoneyBees);

            const defaultBeeRelationship = {
              honeybeeEmail: email,
              captainBeeEmail: getReferredUser.email,
              permissions: defaultPermissions,
            };

            existingRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingRelationShips);
          } else if (type === "CaptainBeeRegister") {
            existingCaptainBees = getAffiliateUser?.captainBees;
            existingCaptainBees.push(email);
            console.log("new bees", existingCaptainBees);
            console.log("i am here captainbeeRegister");
            const defaultBeeRelationship: CaptainBeeRelationship = {
              mainCaptainBeeEmail: getReferredUser.email,
              captainBeeEmail: email,
              permissions: defaultPermissions,
            };
            existingCaptainBeeRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingCaptainBees);
          }

          await affilateService.updatePart(
            {
              Email: getReferredUser.email,
            },
            {
              $set: {
                honeyBees: existinghoneyBees,
                captainBees: existingCaptainBees,
              },
            }
          );
          await uservice.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $set: {
                relationships: existingRelationShips,
                captainBeeRelationShips: existingCaptainBeeRelationShips,
              },
            }
          );
        } else {
          newUser.referralCodeUsed = referralCode ? referralCode : "";
        }

        let pointsHistoryObj = {
          email: newUser.email,
          points: signUpPoints,
          type: "Sign Up Completed Points",
          date: new Date(),
        };
        //create a new Task center on user signUp;
        const newTaskCenter = {
          email: newUser.email,
          isTransactionCompletedInExchange: false,
          transactionPoints: 0,
          redeemPoints: 0,
          totalPoints: 10,
          inivitedUsersCount: 0,
          isInivitedThreeUsers: false,
          inivitedUserPoints: 0,
          isReportedBug: false,
          reportedBugPoints: 0,
          remainingPoints: 0,
          isParticipatedInLotto: false,
          lottoPoints: 0,
          pointsHistory: [pointsHistoryObj],
          signUpPoints: signUpPoints,
          isSignUp: true,
          isKYCPass: false,
          KYCPoints: 0,
          isBuyIndexxTokens: false,
          buyIndexxTokensPoints: 0,
        } as TaskCenter;

        //create new object for task center
        await taskCenterService.create(newTaskCenter);
        //hash Password
        let getPassword = await uservice.createPassword(password);
        const localAuthProvider = newUser.authProviders.find(p => p.provider === 'Local');
        if (localAuthProvider) {
          localAuthProvider.phash = getPassword.hash;
          localAuthProvider.psalt = getPassword.salt;
        }
        let createUser = await uservice.create(newUser);

        let checkUserOtp = await userOtpSerive.findOne({
          email: createUser.email,
          emailVerified: true,
        });
        if (!checkUserOtp?.emailVerified) {
          //const emailToken = await new JwtAuthUtil().emailToken(createUser);
          let emailOTP = Math.floor(100000 + Math.random() * 900000);
          let emailCodeExpiry = new Date();
          emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
          await uservice.updatePart(
            { _id: createUser._id, email: createUser.email },
            {
              $set: {
                "verification.emailCode": emailOTP,
                "verification.emailCodeExpiry": emailCodeExpiry,
                "verification.emailVerified": false,
              },
            }
          );
          // /* send email */
          // let res = await emailService.sendReviewEmail2(
          //   email,
          //   "User",
          //   emailOTP.toString(),
          //   type
          // );
        }
        //create a wallet user for login into wallet web
        let walletWebUser = await createUserWithEmailAndPasswordForWallet(
          email,
          password
        );
        if (walletWebUser.success) {
          let basicDetails = {};
          const newUser: User = {
            email: String(email).toLowerCase(),
            role: UserRoleTypes.Standard,
            authProviders: [
              {
                provider: AuthProviders.Local,
              },
            ],
            baseCurrency: Currency.USD,
            basic: basicDetails,
            userMnemonic: "",
            password: password,
          } as User;
          createUser = await wuserservice.create(newUser);
          email = createUser.email;

          // use the greeting card if body has a value and add it to wallet balance
          let greetingCode = req.body.gcode;
          console.log(greetingCode, "greetingCode");
          let inexAmountTobeAdded = 0;

          if (greetingCode && greetingCode !== "") {
            let getAffiliateUser = await affilateService.findOne({
              Email: getReferredUser?.email,
            });
            let getUsedGreetingCard: any = getAffiliateUser.greetingCards.find(
              (x) => x.code === greetingCode
            );

            console.log("I am here", getUsedGreetingCard);
            if (
              getUsedGreetingCard &&
              getUsedGreetingCard.receiverEmail === email
            ) {
              inexAmountTobeAdded = getUsedGreetingCard.numberOfTokens;
              let updateGreetingcard = await affilateService.updatePart(
                {
                  Email: getReferredUser?.email,
                  "greetingCards.code": greetingCode,
                },
                {
                  $set: {
                    "greetingCards.$.receiverActivatedDate": new Date(),
                  },
                }
              );
            } else {
              console.log("Greeting code is not valid");
            }
          }

          //Exchange wallet
          await createFirstTimeWallets(createUser.email, inexAmountTobeAdded);
          //await createFirstTimeWallets(createUser.email, inexAmountTobeAdded, isValidReferral);

          // Web wallets
          const walletOps: WalletOperations = new WalletOperations(req, res);
          await walletOps.createBitcoinWalletForWalletUser(email);
          await walletOps.createEthereumWalletForWalletUser(email);
          await walletOps.createBinanceWalletForWalletUser(email);
          await walletOps.createMaticWalletForWalletUser(email);
          await walletOps.createeINEXWalletForWalletUser(email);
          await walletOps.createeIN500WalletForWalletUser(email);
          await walletOps.createeINXCWalletForWalletUser(email);
          await walletOps.createeIUSDPWalletForWalletUser(email);
          await walletOps.createETHINEXWalletForWalletUser(email);
          await walletOps.createETHIN500WalletForWalletUser(email);
          await walletOps.createETHINXCWalletForWalletUser(email);
          await walletOps.createETHIUSDPWalletForWalletUser(email);
          await walletOps.createMATICINEXWalletForWalletUser(email);
        } else {
          console.log("Failed to create wallet user");
        }

        console.log("affiliateUserRegister");
        if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
          //todo backup pass academy

          // const url = `${keys.academyBaseUrl.key}/api/users/signup`;
          // let user = {
          //   email: email,
          //   first_name: req.body.first_name ?? "User",
          //   last_name: req.body.last_name ?? "User",
          //   password: req.body.password,
          //   userCreatedFrom: UserCreatedFrom,
          //   referral_code: referralCode,
          // };
          // const payload = { ...user };
          // const response = await axios.post(url, payload);
          // console.log("response", response);
          // //Free gift card for new user signup added on 30-09-2024
          // let createFreeGiftCardForUser = await createFreeGiftCard(
          //   "gift-card-50",
          //   email,
          //   50
          // );
          // await new SendEmail().sendSelfFreeGiftCardForNewSignUpNotification(
          //   email,
          //   "Gift Card $50",
          //   createFreeGiftCardForUser.currencies,
          //   50,
          //   createFreeGiftCardForUser.voucher,
          //   "",
          //   50
          // );
          // await new SendEmail().sendAcademyAccountEmail(
          //   email,
          //   response.data.newUser,
          //   keys.academyBaseUrl.key
          // );
          const message = "createdUser";
          return { status: 200, data: message };
        } else {
          // const url = `${keys.academyBaseUrl.key}/api/users/signup`;
          // let user = {
          //   email: email,
          //   first_name: req.body.first_name ?? "User",
          //   last_name: req.body.last_name ?? "User",
          //   password: req.body.password,
          //   userCreatedFrom: UserCreatedFrom,
          //   referral_code: referralCode,
          // };
          // const payload = { ...user };
          // const response = await axios.post(url, payload);
          // console.log("response", response);

          //Free gift card for new user signup added on 30-09-2024
          // let createFreeGiftCardForUser = await createFreeGiftCard(
          //   "gift-card-50",
          //   email,
          //   50
          // );
          // await new SendEmail().sendSelfFreeGiftCardNotification(
          //   email,
          //   "Gift Card $50",
          //   createFreeGiftCardForUser.currencies,
          //   50,
          //   createFreeGiftCardForUser.voucher,
          //   "",
          //   50
          // );
          // await new SendEmail().sendAcademyAccountEmail(
          //   email,
          //   response.data.newUser,
          //   keys.academyBaseUrl.key
          // );
          const message = "createdUser";
          return { status: 200, data: message };
        }
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: err };
    }
  }

  async registerUserFromApp(
    req: any,
    res: any,
    email: string,
    password: string,
    username?: string,
    referralCode?: string,
    affiliateUserRegister?: boolean,
    type: string = "",
    UserCreatedFrom: string = "Bitcoin Yay App"
  ) {
    try {
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let usernameExist;
      if (username) {
        usernameExist = await uservice.findOne({
          username: username,
        });
      }
      let usernameExistInAffiliate = undefined;
      if (!affiliateUserRegister) {
        usernameExistInAffiliate = await affilateService.findOne({
          Username: username,
        });
      }
      let walletregister = await wuserservice.findOne({
        email: email,
      });
      console.log(usernameExist);
      console.log(usernameExistInAffiliate);
      console.log(usernameExist || usernameExistInAffiliate);
      const SHORT_REFERRAL_CODE = "FREE500"; // New Short Referral Code
      const isValidReferral = referralCode === SHORT_REFERRAL_CODE;

      if (register || walletregister) {
        for (let i = 0; i < register.authProviders.length; i++) {
          if (register.authProviders[i].provider == "Local") {
            const message = MessageConstants.EmailRegistered;
            //const message = "emailRegistered";
            return { status: 500, data: message };
          }
        }
        const message = "emailRegistered";
        return { status: 500, data: message };
      } else if (usernameExist || usernameExistInAffiliate) {
        return {
          data: "Username already exists",
          status: 500,
        };
      } else {
        console.log(" i am here in main logic");
        const generateRefCode = referralCodes.generate({
          length: 8,
        });
        // Get selected language or fallback to English
        const selectedLanguage = languageMap[req.body.languageSelected] || Languages.US;
        const newUser: User = {
          email: String(email).toLowerCase(),
          username: username,
          role: UserRoleTypes.Standard,
          authProviders: [{ provider: AuthProviders.Local }],
          verification: {
            emailVerified: true,
            emailVerifiedOn: new Date(),
          } as UserVerification,
          baseCurrency: Currency.USD,
          referralCodeUsed: referralCode,
          referralCode: generateRefCode[0],
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          country: req.body.country,
          phone: req.body.phoneNumber,
          profilePic: this.pickProfileImageValue(req.body),
          language: selectedLanguage,
        } as User;
        // If a valid referral is provided, activate Free Trial
        if (isValidReferral) {
          newUser.isTestFundActive = false;
          newUser.isWithdrawRestricted = true; // Prevent withdrawals until deposit
          console.log("✅ Free trial activated for:", email);
        }
        let getReferredUser;
        let getReferredUserTaskCenter;
        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          referralCode !== "FREE500"
        ) {
          getReferredUser = await uservice.findOne({
            referralCode: referralCode,
          });

          // Check if referral code is valid
          if (!getReferredUser) {
            return { status: 400, data: "Invalid referral code" };
          }

          getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
        }

        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          getReferredUser &&
          getReferredUserTaskCenter
        ) {
          console.log("inside updating the reffered user data");
          newUser.referralCodeUsed = String(referralCode);

          await notificationService.sendNotification(
            getReferredUser,
            "referral_success",
            {}
          );

          await taskCenterService.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $inc: { inivitedUsersCount: 1 },
              $set: {
                inivitedUsersEmail:
                  getReferredUserTaskCenter.inivitedUsersEmail.concat(
                    newUser.email
                  ),
              },
            }
          );
          let getAffiliateUser = await affilateService.findOne({
            Email: getReferredUser.email,
          });

          let getUser = await uservice.findOne({
            email: getReferredUser.email,
          });
          let existingRelationShips = getUser?.relationships || [];

          if (!existingRelationShips) {
            existingRelationShips = [];
          }

          let existingCaptainBeeRelationShips =
            getUser?.captainBeeRelationShips || [];

          if (!existingCaptainBeeRelationShips) {
            existingCaptainBeeRelationShips = [];
          }

          const defaultPermissions = {
            buy: false,
            buyApprovedOn: new Date(),
            sell: false,
            sellApprovedOn: new Date(),
            convert: false,
            convertApprovedOn: new Date(),
          };

          let existinghoneyBees = getAffiliateUser?.honeyBees || [];

          if (!existinghoneyBees) {
            existinghoneyBees = [];
          }

          let existingCaptainBees = getAffiliateUser?.captainBees || [];

          if (!existingCaptainBees) {
            existingCaptainBees = [];
          }

          console.log(
            "type === CaptainBeeRegister",
            type === "CaptainBeeRegister"
          );

          if (type === "HoneyBeeRegister") {
            existinghoneyBees.push(email);
            console.log("new bees", existinghoneyBees);

            const defaultBeeRelationship = {
              honeybeeEmail: email,
              captainBeeEmail: getReferredUser.email,
              permissions: defaultPermissions,
            };

            existingRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingRelationShips);
          } else if (type === "CaptainBeeRegister") {
            existingCaptainBees = getAffiliateUser?.captainBees;
            existingCaptainBees.push(email);
            console.log("new bees", existingCaptainBees);
            console.log("i am here captainbeeRegister");
            const defaultBeeRelationship: CaptainBeeRelationship = {
              mainCaptainBeeEmail: getReferredUser.email,
              captainBeeEmail: email,
              permissions: defaultPermissions,
            };
            existingCaptainBeeRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingCaptainBees);
          }

          await affilateService.updatePart(
            {
              Email: getReferredUser.email,
            },
            {
              $set: {
                honeyBees: existinghoneyBees,
                captainBees: existingCaptainBees,
              },
            }
          );
          await uservice.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $set: {
                relationships: existingRelationShips,
                captainBeeRelationShips: existingCaptainBeeRelationShips,
              },
            }
          );
        } else {
          newUser.referralCodeUsed = referralCode ? referralCode : "";
        }

        let pointsHistoryObj = {
          email: newUser.email,
          points: signUpPoints,
          type: "Sign Up Completed Points",
          date: new Date(),
        };
        //create a new Task center on user signUp;
        const newTaskCenter = {
          email: newUser.email,
          isTransactionCompletedInExchange: false,
          transactionPoints: 0,
          redeemPoints: 0,
          totalPoints: 10,
          inivitedUsersCount: 0,
          isInivitedThreeUsers: false,
          inivitedUserPoints: 0,
          isReportedBug: false,
          reportedBugPoints: 0,
          remainingPoints: 0,
          isParticipatedInLotto: false,
          lottoPoints: 0,
          pointsHistory: [pointsHistoryObj],
          signUpPoints: signUpPoints,
          isSignUp: true,
          isKYCPass: false,
          KYCPoints: 0,
          isBuyIndexxTokens: false,
          buyIndexxTokensPoints: 0,
        } as TaskCenter;

        //create new object for task center
        await taskCenterService.create(newTaskCenter);
        //hash Password
        let getPassword = await uservice.createPassword(password);
        const localAuthProvider = newUser.authProviders.find(p => p.provider === 'Local');
        if (localAuthProvider) {
          localAuthProvider.phash = getPassword.hash;
          localAuthProvider.psalt = getPassword.salt;
        }
        let createUser = await uservice.create(newUser);
        /* disable otp for now 01-01-2026
                let checkUserOtp = await userOtpSerive.findOne({
                  email: createUser.email,
                  emailVerified: true,
                });
                if (!checkUserOtp?.emailVerified) {
                  //const emailToken = await new JwtAuthUtil().emailToken(createUser);
                  let emailOTP = Math.floor(100000 + Math.random() * 900000);
                  let emailCodeExpiry = new Date();
                  emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
                  await uservice.updatePart(
                    { _id: createUser._id, email: createUser.email },
                    {
                      $set: {
                        "verification.emailCode": emailOTP,
                        "verification.emailCodeExpiry": emailCodeExpiry,
                        "verification.emailVerified": false,
                      },
                    }
                  );
                  //
                  let res = await emailService.sendReviewEmail2(
                    email,
                    "User",
                    emailOTP.toString(),
                    type,
                    "New Register",
                    "BTCY-MOBLIE-APP"
                  );
                }*/
        // //create a wallet user for login into wallet web
        // let walletWebUser = await createUserWithEmailAndPasswordForWallet(
        //   email,
        //   password
        // );
        // if (walletWebUser.success) {
        //   let basicDetails = {};
        //   const newUser: User = {
        //     email: String(email).toLowerCase(),
        //     role: UserRoleTypes.Standard,
        //     authProviders: [
        //       {
        //         provider: AuthProviders.Local,
        //       },
        //     ],
        //     baseCurrency: Currency.USD,
        //     basic: basicDetails,
        //     userMnemonic: "",
        //     password: password,
        //   } as User;
        //   createUser = await wuserservice.create(newUser);
        //   email = createUser.email;

        //   // use the greeting card if body has a value and add it to wallet balance
        //   let greetingCode = req.body.gcode;
        //   console.log(greetingCode, "greetingCode");
        //   let inexAmountTobeAdded = 0;

        //   if (greetingCode && greetingCode !== "") {
        //     let getAffiliateUser = await affilateService.findOne({
        //       Email: getReferredUser?.email,
        //     });
        //     let getUsedGreetingCard: any = getAffiliateUser.greetingCards.find(
        //       (x) => x.code === greetingCode
        //     );

        //     console.log("I am here", getUsedGreetingCard);
        //     if (
        //       getUsedGreetingCard &&
        //       getUsedGreetingCard.receiverEmail === email
        //     ) {
        //       inexAmountTobeAdded = getUsedGreetingCard.numberOfTokens;
        //       let updateGreetingcard = await affilateService.updatePart(
        //         {
        //           Email: getReferredUser?.email,
        //           "greetingCards.code": greetingCode,
        //         },
        //         {
        //           $set: {
        //             "greetingCards.$.receiverActivatedDate": new Date(),
        //           },
        //         }
        //       );
        //     } else {
        //       console.log("Greeting code is not valid");
        //     }
        //   }

        //   //Exchange wallet
        //   await createFirstTimeWallets(createUser.email, inexAmountTobeAdded);
        //   //await createFirstTimeWallets(createUser.email, inexAmountTobeAdded, isValidReferral);

        //   // Web wallets
        //   const walletOps: WalletOperations = new WalletOperations(req, res);
        //   await walletOps.createBitcoinWalletForWalletUser(email);
        //   await walletOps.createEthereumWalletForWalletUser(email);
        //   await walletOps.createBinanceWalletForWalletUser(email);
        //   await walletOps.createMaticWalletForWalletUser(email);
        //   await walletOps.createeINEXWalletForWalletUser(email);
        //   await walletOps.createeIN500WalletForWalletUser(email);
        //   await walletOps.createeINXCWalletForWalletUser(email);
        //   await walletOps.createeIUSDPWalletForWalletUser(email);
        //   await walletOps.createETHINEXWalletForWalletUser(email);
        //   await walletOps.createETHIN500WalletForWalletUser(email);
        //   await walletOps.createETHINXCWalletForWalletUser(email);
        //   await walletOps.createETHIUSDPWalletForWalletUser(email);
        //   await walletOps.createMATICINEXWalletForWalletUser(email);
        // } else {
        //   console.log("Failed to create wallet user");
        // }

        console.log("affiliateUserRegister");
        // if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
        //   //todo backup pass academy

        //   const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //   let user = {
        //     email: email,
        //     first_name: req.body.first_name ?? "User",
        //     last_name: req.body.last_name ?? "User",
        //     password: req.body.password,
        //     userCreatedFrom: UserCreatedFrom,
        //     referral_code: referralCode,
        //   };
        //   const payload = { ...user };
        //   const response = await axios.post(url, payload);
        //   console.log("response", response);
        //   // //Free gift card for new user signup added on 30-09-2024
        //   // let createFreeGiftCardForUser = await createFreeGiftCard(
        //   //   "gift-card-50",
        //   //   email,
        //   //   50
        //   // );
        //   // await new SendEmail().sendSelfFreeGiftCardForNewSignUpNotification(
        //   //   email,
        //   //   "Gift Card $50",
        //   //   createFreeGiftCardForUser.currencies,
        //   //   50,
        //   //   createFreeGiftCardForUser.voucher,
        //   //   "",
        //   //   50
        //   // );
        //   // await new SendEmail().sendAcademyAccountEmail(
        //   //   email,
        //   //   response.data.newUser,
        //   //   keys.academyBaseUrl.key
        //   // );
        //   console.log('I am here return in if')

        //   const message = "createdUser";
        //   return { status: 200, data: message };
        // } else {
        //   const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //   let user = {
        //     email: email,
        //     first_name: req.body.first_name ?? "User",
        //     last_name: req.body.last_name ?? "User",
        //     password: req.body.password,
        //     userCreatedFrom: UserCreatedFrom,
        //     referral_code: referralCode,
        //   };
        //   const payload = { ...user };
        //   const response = await axios.post(url, payload);
        //   console.log("response", response);

        //   //Free gift card for new user signup added on 30-09-2024
        //   // let createFreeGiftCardForUser = await createFreeGiftCard(
        //   //   "gift-card-50",
        //   //   email,
        //   //   50
        //   // );
        //   // await new SendEmail().sendSelfFreeGiftCardNotification(
        //   //   email,
        //   //   "Gift Card $50",
        //   //   createFreeGiftCardForUser.currencies,
        //   //   50,
        //   //   createFreeGiftCardForUser.voucher,
        //   //   "",
        //   //   50
        //   // );
        //   // await new SendEmail().sendAcademyAccountEmail(
        //   //   email,
        //   //   response.data.newUser,
        //   //   keys.academyBaseUrl.key
        //   // );
        //   console.log('I am here return in else')
        //   const message = "createdUser";
        //   return { status: 200, data: message };
        // }
        // if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
        //   try {
        //     const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //     const user = {
        //       email,
        //       first_name: req.body.first_name ?? "User",
        //       last_name: req.body.last_name ?? "User",
        //       password: req.body.password,
        //       userCreatedFrom: UserCreatedFrom,
        //       referral_code: referralCode,
        //     };
        //     const response = await axios.post(url, user, { timeout: 15000 });
        //     console.log("✅ Academy response:", response.data);
        //     await notificationService.sendNotification(
        //       user,
        //       "welcome",
        //       {}
        //     );

        //     return { status: 200, data: "createdUser" };
        //   } catch (err: any) {
        //     console.error("❌ Error hitting academy signup:", err.message || err);
        //     return { status: 500, data: "Academy signup failed" };
        //   }
        // } else {
        //   try {
        //     const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //     const user = {
        //       email,
        //       first_name: req.body.first_name ?? "User",
        //       last_name: req.body.last_name ?? "User",
        //       password: req.body.password,
        //       userCreatedFrom: UserCreatedFrom,
        //       referral_code: referralCode,
        //     };
        //     const response = await axios.post(url, user, { timeout: 15000 });
        //     console.log("✅ Academy response:", response.data);
        //     return { status: 200, data: "createdUser" };
        //   } catch (err: any) {
        //     console.error("❌ Error hitting academy signup:", err.message || err);
        //     return { status: 500, data: "Academy signup failed" };
        //   }
        // }
        return { status: 200, data: "createdUser" };
      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: err };
    }
  }

  async registerUserFromApp0(
    req: any,
    res: any,
    email: string,
    password: string,
    username?: string,
    referralCode?: string,
    affiliateUserRegister?: boolean,
    type: string = "",
    UserCreatedFrom: string = "Bitcoin Yay App"
  ) {
    try {
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let usernameExist;
      if (username) {
        usernameExist = await uservice.findOne({
          username: username,
        });
      }
      let usernameExistInAffiliate = undefined;
      if (!affiliateUserRegister) {
        usernameExistInAffiliate = await affilateService.findOne({
          Username: username,
        });
      }
      let walletregister = await wuserservice.findOne({
        email: email,
      });
      console.log(usernameExist);
      console.log(usernameExistInAffiliate);
      console.log(usernameExist || usernameExistInAffiliate);
      const SHORT_REFERRAL_CODE = "FREE500"; // New Short Referral Code
      const isValidReferral = referralCode === SHORT_REFERRAL_CODE;

      if (register || walletregister) {
        for (let i = 0; i < register.authProviders.length; i++) {
          if (register.authProviders[i].provider == "Local") {
            const message = MessageConstants.EmailRegistered;
            //const message = "emailRegistered";
            return { status: 500, data: message };
          }
        }
        const message = "emailRegistered";
        return { status: 500, data: message };
      } else if (usernameExist || usernameExistInAffiliate) {
        return {
          data: "Username already exists",
          status: 500,
        };
      } else {
        console.log(" i am here in main logic");
        const generateRefCode = referralCodes.generate({
          length: 8,
        });
        // Get selected language or fallback to English
        const selectedLanguage = languageMap[req.body.languageSelected] || Languages.US;
        const newUser: User = {
          email: String(email).toLowerCase(),
          username: username,
          role: UserRoleTypes.Standard,
          authProviders: [{ provider: AuthProviders.Local }],
          verification: {
            emailVerified: true,
            emailVerifiedOn: new Date(),
          } as UserVerification,
          baseCurrency: Currency.USD,
          referralCodeUsed: referralCode,
          referralCode: generateRefCode[0],
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          country: req.body.country,
          phone: req.body.phoneNumber,
          language: selectedLanguage,
        } as User;
        // If a valid referral is provided, activate Free Trial
        if (isValidReferral) {
          newUser.isTestFundActive = false;
          newUser.isWithdrawRestricted = true; // Prevent withdrawals until deposit
          console.log("✅ Free trial activated for:", email);
        }
        let getReferredUser;
        let getReferredUserTaskCenter;
        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          referralCode !== "FREE500"
        ) {
          getReferredUser = await uservice.findOne({
            referralCode: referralCode,
          });

          // Check if referral code is valid
          if (!getReferredUser) {
            return { status: 400, data: "Invalid referral code" };
          }

          getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
        }

        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          getReferredUser &&
          getReferredUserTaskCenter
        ) {
          console.log("inside updating the reffered user data");
          newUser.referralCodeUsed = String(referralCode);

          await taskCenterService.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $inc: { inivitedUsersCount: 1 },
              $set: {
                inivitedUsersEmail:
                  getReferredUserTaskCenter.inivitedUsersEmail.concat(
                    newUser.email
                  ),
              },
            }
          );
          let getAffiliateUser = await affilateService.findOne({
            Email: getReferredUser.email,
          });

          let getUser = await uservice.findOne({
            email: getReferredUser.email,
          });
          let existingRelationShips = getUser?.relationships || [];

          if (!existingRelationShips) {
            existingRelationShips = [];
          }

          let existingCaptainBeeRelationShips =
            getUser?.captainBeeRelationShips || [];

          if (!existingCaptainBeeRelationShips) {
            existingCaptainBeeRelationShips = [];
          }

          const defaultPermissions = {
            buy: false,
            buyApprovedOn: new Date(),
            sell: false,
            sellApprovedOn: new Date(),
            convert: false,
            convertApprovedOn: new Date(),
          };

          let existinghoneyBees = getAffiliateUser?.honeyBees || [];

          if (!existinghoneyBees) {
            existinghoneyBees = [];
          }

          let existingCaptainBees = getAffiliateUser?.captainBees || [];

          if (!existingCaptainBees) {
            existingCaptainBees = [];
          }

          console.log(
            "type === CaptainBeeRegister",
            type === "CaptainBeeRegister"
          );

          if (type === "HoneyBeeRegister") {
            existinghoneyBees.push(email);
            console.log("new bees", existinghoneyBees);

            const defaultBeeRelationship = {
              honeybeeEmail: email,
              captainBeeEmail: getReferredUser.email,
              permissions: defaultPermissions,
            };

            existingRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingRelationShips);
          } else if (type === "CaptainBeeRegister") {
            existingCaptainBees = getAffiliateUser?.captainBees;
            existingCaptainBees.push(email);
            console.log("new bees", existingCaptainBees);
            console.log("i am here captainbeeRegister");
            const defaultBeeRelationship: CaptainBeeRelationship = {
              mainCaptainBeeEmail: getReferredUser.email,
              captainBeeEmail: email,
              permissions: defaultPermissions,
            };
            existingCaptainBeeRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingCaptainBees);
          }

          await affilateService.updatePart(
            {
              Email: getReferredUser.email,
            },
            {
              $set: {
                honeyBees: existinghoneyBees,
                captainBees: existingCaptainBees,
              },
            }
          );
          await uservice.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $set: {
                relationships: existingRelationShips,
                captainBeeRelationShips: existingCaptainBeeRelationShips,
              },
            }
          );
        } else {
          newUser.referralCodeUsed = referralCode ? referralCode : "";
        }

        let pointsHistoryObj = {
          email: newUser.email,
          points: signUpPoints,
          type: "Sign Up Completed Points",
          date: new Date(),
        };
        //create a new Task center on user signUp;
        const newTaskCenter = {
          email: newUser.email,
          isTransactionCompletedInExchange: false,
          transactionPoints: 0,
          redeemPoints: 0,
          totalPoints: 10,
          inivitedUsersCount: 0,
          isInivitedThreeUsers: false,
          inivitedUserPoints: 0,
          isReportedBug: false,
          reportedBugPoints: 0,
          remainingPoints: 0,
          isParticipatedInLotto: false,
          lottoPoints: 0,
          pointsHistory: [pointsHistoryObj],
          signUpPoints: signUpPoints,
          isSignUp: true,
          isKYCPass: false,
          KYCPoints: 0,
          isBuyIndexxTokens: false,
          buyIndexxTokensPoints: 0,
        } as TaskCenter;

        //create new object for task center
        await taskCenterService.create(newTaskCenter);
        //hash Password
        let getPassword = await uservice.createPassword(password);
        const localAuthProvider = newUser.authProviders.find(p => p.provider === 'Local');
        if (localAuthProvider) {
          localAuthProvider.phash = getPassword.hash;
          localAuthProvider.psalt = getPassword.salt;
        }
        let createUser = await uservice.create(newUser);

        let checkUserOtp = await userOtpSerive.findOne({
          email: createUser.email,
          emailVerified: true,
        });
        if (!checkUserOtp?.emailVerified) {
          //const emailToken = await new JwtAuthUtil().emailToken(createUser);
          let emailOTP = Math.floor(100000 + Math.random() * 900000);
          let emailCodeExpiry = new Date();
          emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
          await uservice.updatePart(
            { _id: createUser._id, email: createUser.email },
            {
              $set: {
                "verification.emailCode": emailOTP,
                "verification.emailCodeExpiry": emailCodeExpiry,
                "verification.emailVerified": false,
              },
            }
          );
          // /* send email */
          let res = await emailService.sendReviewEmail2(
            email,
            "User",
            emailOTP.toString(),
            type,
            "New Register",
            "BTCY-MOBLIE-APP"
          );
        }
        // //create a wallet user for login into wallet web
        // let walletWebUser = await createUserWithEmailAndPasswordForWallet(
        //   email,
        //   password
        // );
        // if (walletWebUser.success) {
        //   let basicDetails = {};
        //   const newUser: User = {
        //     email: String(email).toLowerCase(),
        //     role: UserRoleTypes.Standard,
        //     authProviders: [
        //       {
        //         provider: AuthProviders.Local,
        //       },
        //     ],
        //     baseCurrency: Currency.USD,
        //     basic: basicDetails,
        //     userMnemonic: "",
        //     password: password,
        //   } as User;
        //   createUser = await wuserservice.create(newUser);
        //   email = createUser.email;

        //   // use the greeting card if body has a value and add it to wallet balance
        //   let greetingCode = req.body.gcode;
        //   console.log(greetingCode, "greetingCode");
        //   let inexAmountTobeAdded = 0;

        //   if (greetingCode && greetingCode !== "") {
        //     let getAffiliateUser = await affilateService.findOne({
        //       Email: getReferredUser?.email,
        //     });
        //     let getUsedGreetingCard: any = getAffiliateUser.greetingCards.find(
        //       (x) => x.code === greetingCode
        //     );

        //     console.log("I am here", getUsedGreetingCard);
        //     if (
        //       getUsedGreetingCard &&
        //       getUsedGreetingCard.receiverEmail === email
        //     ) {
        //       inexAmountTobeAdded = getUsedGreetingCard.numberOfTokens;
        //       let updateGreetingcard = await affilateService.updatePart(
        //         {
        //           Email: getReferredUser?.email,
        //           "greetingCards.code": greetingCode,
        //         },
        //         {
        //           $set: {
        //             "greetingCards.$.receiverActivatedDate": new Date(),
        //           },
        //         }
        //       );
        //     } else {
        //       console.log("Greeting code is not valid");
        //     }
        //   }

        //   //Exchange wallet
        //   await createFirstTimeWallets(createUser.email, inexAmountTobeAdded);
        //   //await createFirstTimeWallets(createUser.email, inexAmountTobeAdded, isValidReferral);

        //   // Web wallets
        //   const walletOps: WalletOperations = new WalletOperations(req, res);
        //   await walletOps.createBitcoinWalletForWalletUser(email);
        //   await walletOps.createEthereumWalletForWalletUser(email);
        //   await walletOps.createBinanceWalletForWalletUser(email);
        //   await walletOps.createMaticWalletForWalletUser(email);
        //   await walletOps.createeINEXWalletForWalletUser(email);
        //   await walletOps.createeIN500WalletForWalletUser(email);
        //   await walletOps.createeINXCWalletForWalletUser(email);
        //   await walletOps.createeIUSDPWalletForWalletUser(email);
        //   await walletOps.createETHINEXWalletForWalletUser(email);
        //   await walletOps.createETHIN500WalletForWalletUser(email);
        //   await walletOps.createETHINXCWalletForWalletUser(email);
        //   await walletOps.createETHIUSDPWalletForWalletUser(email);
        //   await walletOps.createMATICINEXWalletForWalletUser(email);
        // } else {
        //   console.log("Failed to create wallet user");
        // }

        console.log("affiliateUserRegister");
        // if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
        //   //todo backup pass academy

        //   const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //   let user = {
        //     email: email,
        //     first_name: req.body.first_name ?? "User",
        //     last_name: req.body.last_name ?? "User",
        //     password: req.body.password,
        //     userCreatedFrom: UserCreatedFrom,
        //     referral_code: referralCode,
        //   };
        //   const payload = { ...user };
        //   const response = await axios.post(url, payload);
        //   console.log("response", response);
        //   // //Free gift card for new user signup added on 30-09-2024
        //   // let createFreeGiftCardForUser = await createFreeGiftCard(
        //   //   "gift-card-50",
        //   //   email,
        //   //   50
        //   // );
        //   // await new SendEmail().sendSelfFreeGiftCardForNewSignUpNotification(
        //   //   email,
        //   //   "Gift Card $50",
        //   //   createFreeGiftCardForUser.currencies,
        //   //   50,
        //   //   createFreeGiftCardForUser.voucher,
        //   //   "",
        //   //   50
        //   // );
        //   // await new SendEmail().sendAcademyAccountEmail(
        //   //   email,
        //   //   response.data.newUser,
        //   //   keys.academyBaseUrl.key
        //   // );
        //   console.log('I am here return in if')

        //   const message = "createdUser";
        //   return { status: 200, data: message };
        // } else {
        //   const url = `${keys.academyBaseUrl.key}/api/users/signup`;
        //   let user = {
        //     email: email,
        //     first_name: req.body.first_name ?? "User",
        //     last_name: req.body.last_name ?? "User",
        //     password: req.body.password,
        //     userCreatedFrom: UserCreatedFrom,
        //     referral_code: referralCode,
        //   };
        //   const payload = { ...user };
        //   const response = await axios.post(url, payload);
        //   console.log("response", response);

        //   //Free gift card for new user signup added on 30-09-2024
        //   // let createFreeGiftCardForUser = await createFreeGiftCard(
        //   //   "gift-card-50",
        //   //   email,
        //   //   50
        //   // );
        //   // await new SendEmail().sendSelfFreeGiftCardNotification(
        //   //   email,
        //   //   "Gift Card $50",
        //   //   createFreeGiftCardForUser.currencies,
        //   //   50,
        //   //   createFreeGiftCardForUser.voucher,
        //   //   "",
        //   //   50
        //   // );
        //   // await new SendEmail().sendAcademyAccountEmail(
        //   //   email,
        //   //   response.data.newUser,
        //   //   keys.academyBaseUrl.key
        //   // );
        //   console.log('I am here return in else')
        //   const message = "createdUser";
        //   return { status: 200, data: message };
        // }
        if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
          try {
            const url = `${keys.academyBaseUrl.key}/api/users/signup`;
            const user = {
              email,
              first_name: req.body.first_name ?? "User",
              last_name: req.body.last_name ?? "User",
              password: req.body.password,
              userCreatedFrom: UserCreatedFrom,
              referral_code: referralCode,
            };
            const response = await axios.post(url, user, { timeout: 15000 });
            console.log("✅ Academy response:", response.data);
            return { status: 200, data: "createdUser" };
          } catch (err: any) {
            console.error("❌ Error hitting academy signup:", err.message || err);
            return { status: 500, data: "Academy signup failed" };
          }
        } else {
          try {
            const url = `${keys.academyBaseUrl.key}/api/users/signup`;
            const user = {
              email,
              first_name: req.body.first_name ?? "User",
              last_name: req.body.last_name ?? "User",
              password: req.body.password,
              userCreatedFrom: UserCreatedFrom,
              referral_code: referralCode,
            };
            const response = await axios.post(url, user, { timeout: 15000 });
            console.log("✅ Academy response:", response.data);
            return { status: 200, data: "createdUser" };
          } catch (err: any) {
            console.error("❌ Error hitting academy signup:", err.message || err);
            return { status: 500, data: "Academy signup failed" };
          }
        }

      }
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: err };
    }
  }

  async registerUser0(
    req: any,
    res: any,
    email: string,
    password: string,
    username?: string,
    referralCode?: string,
    affiliateUserRegister?: boolean,
    type: string = "",
    UserCreatedFrom: string = "CEX"
  ) {
    try {
      // Check if user already exists in user service or wallet service
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let usernameExist;

      if (username) {
        usernameExist = await uservice.findOne({ username: username });
      }

      let usernameExistInAffiliate;
      if (!affiliateUserRegister) {
        usernameExistInAffiliate = await affilateService.findOne({
          Username: username,
        });
      }

      let walletregister = await wuserservice.findOne({ email: email });

      // Handle existing user cases
      if (register || walletregister) {
        for (let i = 0; i < register.authProviders.length; i++) {
          if (register.authProviders[i].provider === "Local") {
            let message = "Email already registered";
            return { status: 500, data: message };
          }
        }
        return { status: 500, data: "Email already registered" };
      } else if (usernameExist || usernameExistInAffiliate) {
        let message = "Username already exists";
        return { status: 500, data: message };
      } else {
        // Generate referral code and create new user object
        const generateRefCode = referralCodes.generate({ length: 8 });
        const newUser: User = {
          email: String(email).toLowerCase(),
          username: username,
          role: UserRoleTypes.Standard,
          authProviders: [{ provider: AuthProviders.Local }],
          verification: {
            emailVerified: true,
            emailVerifiedOn: new Date(),
          } as UserVerification,
          baseCurrency: Currency.USD,
          referralCodeUsed: referralCode,
          referralCode: generateRefCode[0],
        } as User;

        // Create the user immediately in the database
        const createdUser = await uservice.create(newUser);

        const message = "createdUser";

        console.log("I am here before userTaskQueue");
        // Push remaining tasks to a queue to handle in the background
        userTaskQueue
          .add({
            user: createdUser,
            password,
            referralCode,
            type,
            UserCreatedFrom,
            affiliateUserRegister,
            reqBody: req.body,
          })
          .then((userTaskJob) => {
            console.log("userTaskJob added to the queue", userTaskJob.id);
          })
          .catch((error) => {
            console.error("Error adding job to userTaskQueue:", error);
          });

        return { status: 200, data: message };
      }
    } catch (err) {
      console.log("Error during registration", err);
      return { status: 500, data: err };
    }
  }

  async registerUserWithApple(
    req: any,
    res: any,
    appleToken: string,
    referralCode?: string,
    registerFrom?: string,
    type?: string,
    languageSelected?: string
  ) {
    try {
      const appleUserInfo = await verifyAppleToken(appleToken);
      if (!appleUserInfo) {
        return { status: 400, data: "Invalid Apple token" };
      }

      const { email, username } = appleUserInfo;
      return await this.registerUserWithOAuth(
        email,
        "Apple",
        username,
        referralCode,
        registerFrom,
        type,
        languageSelected
      );
    } catch (err) {
      console.log(err, "Error in Apple signup");
      return { status: 500, data: err };
    }
  }

  async registerUserWithGoogle(
    req: any,
    res: any,
    googleToken: string,
    referralCode?: string,
    registerFrom?: string,
    type?: string,
    languageSelected?: string
  ) {
    try {
      const googleUserInfo = await verifyGoogleToken(googleToken); // You need to implement this function
      if (!googleUserInfo) {
        return { status: 400, data: "Invalid Google token" };
      }

      const { email, username } = googleUserInfo; // Assume googleUserInfo contains these fields
      console.log("googleUserInfo", googleUserInfo);
      return await this.registerUserWithOAuth(
        email,
        "Google",
        undefined,
        referralCode,
        registerFrom,
        type,
        languageSelected
      );
    } catch (err) {
      console.log(err, "Error in Google signup");
      return { status: 500, data: err };
    }
  }

  async loginWithGoogle(req: any, res: any, googleToken: string) {
    try {
      const googleUserInfo = await verifyGoogleToken(googleToken); // You need to implement this function
      if (!googleUserInfo) {
        return { status: 400, data: "Invalid Google token" };
      }

      const { email, username } = googleUserInfo; // Assume googleUserInfo contains these fields
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );

      if (register) {
        const authType: AuthProviders = AuthProviders.Google;
        /*

        // Check if user already has Google auth provider
        const hasGoogleAuth = register.authProviders.some(p => p.provider === 'Google');

        if (hasGoogleAuth) {
          // User already has Google auth - proceed with normal login
          return { status: 200, email };
        }

        // Check if user has only Local auth provider
        const hasLocalAuth = register.authProviders.some(p => p.provider === 'Local');

        if (hasLocalAuth && !hasGoogleAuth) {
          // User has Local auth but wants to login with Google
          // Add Google auth provider to their account (consistent with registration structure)

          const updateResult = await uservice.updatePart(
            { _id: register._id, email: register.email },
            {
              $push: {
                authProviders: {
                  provider: AuthProviders.Google,
                },
              },
            }
          );

          if (updateResult) {
            return { status: 200, email };
          } else {
            return { status: 500, data: "Failed to add Google authentication to your account" };
          }
        }
*/
        // User has other auth providers (not Local, not Google) - use existing validation
        const check = await validateLoginProvider(
          register.authProviders,
          authType
        );
        console.log("check", check);
        if (check.status === 200) {
          return { status: 200, email };
        }
        return { status: check.status, data: check.data };
      }

      return { status: 200, email };
    } catch (err) {
      console.log(err, "Error in Google signup");
      return { status: 500, data: err };
    }
  }



  async loginWithApple(req: any, res: any, appleToken: string) {
    try {
      console.log("appleToken", appleToken)
      const appleUserInfo = await verifyAppleToken(appleToken);

      console.log("appleUserInfo", appleUserInfo);
      if (!appleUserInfo) {
        return { status: 400, data: "Invalid Apple token" };
      }

      const { email, username } = appleUserInfo;
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );

      if (register) {
        const authType: AuthProviders = AuthProviders.Apple;
        /*
        // Check if user already has Apple auth provider
        const hasAppleAuth = register.authProviders.some(p => p.provider === 'Apple');
        
        if (hasAppleAuth) {
          // User already has Apple auth - proceed with normal login
          return { status: 200, email };
        }
        
        // Check if user has only Local auth provider
        const hasLocalAuth = register.authProviders.some(p => p.provider === 'Local');
        
        if (hasLocalAuth && !hasAppleAuth) {
          // User has Local auth but wants to login with Apple
          // Add Apple auth provider to their account (consistent with registration structure)
          console.log("Adding Apple auth provider to existing Local user:", email);
          
          const updateResult = await uservice.updatePart(
            { _id: register._id, email: register.email },
            {
              $push: {
                authProviders: {
                  provider: AuthProviders.Apple,
                },
              },
            }
          );
          
          if (updateResult) {
            console.log("Successfully added Apple auth provider to user:", email);
            return { status: 200, email };
          } else {
            console.error("Failed to add Apple auth provider to user:", email);
            return { status: 500, data: "Failed to add Apple authentication to your account" };
          }
        } */

        // User has other auth providers (not Local, not Apple) - use existing validation
        const check = await validateLoginProvider(
          register.authProviders,
          authType
        );
        console.log("check", check);
        if (check.status === 200) {
          return { status: 200, email };
        }
        return { status: check.status, data: check.data };
      }

      return { status: 200, email };
    } catch (err) {
      console.log(err, "Error in Apple Login");
      return { status: 500, data: err };
    }
  }

  private async registerUserWithOAuth(
    email: string,
    authType: string,
    username?: string,
    referralCode?: string,
    registerFrom?: string,
    type?: string,
    languageSelected?: string
  ) {
    try {
      let register = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let usernameExist;
      if (username) {
        usernameExist = await uservice.findOne({
          username: username,
        });
      }
      let usernameExistInAffiliate = undefined;
      let walletregister = await wuserservice.findOne({
        email: email,
      });
      console.log(usernameExist);
      console.log(usernameExistInAffiliate);
      console.log(usernameExist || usernameExistInAffiliate);
      if (register || walletregister) {
        console.log("register", register);
        const authTypeFlag: AuthProviders = authType === "Google" ? AuthProviders.Google : authType === "Apple" ? AuthProviders.Apple : AuthProviders.Local;
        const check = checkRegistration(register.authProviders, authTypeFlag);

        return { status: check.status, data: check.data };
      } else if (usernameExist || usernameExistInAffiliate) {
        return {
          data: "Username already exists",
          status: 500,
        };
      } else {
        console.log(" i am here in main logic");
        const generateRefCode = referralCodes.generate({
          length: 8,
        });

        const selectedLanguage = languageMap[String(languageSelected)] || Languages.US;

        const newUser: User = {
          email: String(email).toLowerCase(),
          username: username,
          role: UserRoleTypes.Standard,
          authProviders: [
            {
              provider:
                authType === "Google"
                  ? AuthProviders.Google :
                  authType === "Apple"
                    ? AuthProviders.Apple
                    : AuthProviders.Local,
            },
          ],
          verification: { emailVerified: false } as UserVerification,
          baseCurrency: Currency.USD,
          referralCodeUsed: referralCode,
          referralCode: generateRefCode[0],
          language: selectedLanguage,
        } as User;
        let getReferredUser;
        let getReferredUserTaskCenter;
        if (referralCode !== undefined && referralCode !== "") {
          getReferredUser = await uservice.findOne({
            referralCode: referralCode,
          });

          // Check if referral code is valid
          if (!getReferredUser) {
            return { status: 400, data: "Invalid referral code" };
          }

          getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
        }

        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          getReferredUser &&
          getReferredUserTaskCenter
        ) {
          console.log("inside updating the reffered user data");
          newUser.referralCodeUsed = String(referralCode);

          await taskCenterService.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $inc: { inivitedUsersCount: 1 },
              $set: {
                inivitedUsersEmail:
                  getReferredUserTaskCenter.inivitedUsersEmail.concat(
                    newUser.email
                  ),
              },
            }
          );
          let getAffiliateUser = await affilateService.findOne({
            Email: getReferredUser.email,
          });

          let getUser = await uservice.findOne({
            email: getReferredUser.email,
          });
          let existingRelationShips = getUser.relationships || [];
          let existingCaptainBeeRelationShips =
            getUser?.captainBeeRelationShips || [];
          const defaultPermissions: Permissions = {
            buy: false,
            buyApprovedOn: new Date(),
            sell: false,
            sellApprovedOn: new Date(),
            convert: false,
            convertApprovedOn: new Date(),
          };
          let existinghoneyBees = getAffiliateUser?.honeyBees;
          let existingCaptainBees = getAffiliateUser?.captainBees;
          console.log(
            "type === CaptainBeeRegister",
            type === "CaptainBeeRegister"
          );
          if (type === "HoneyBeeRegister") {
            existinghoneyBees = getAffiliateUser?.honeyBees;
            existinghoneyBees.push(email);
            console.log("new bees", existinghoneyBees);
            const defaultBeeRelationship: BeeRelationship = {
              honeybeeEmail: email,
              captainBeeEmail: getReferredUser.email,
              permissions: defaultPermissions,
            };
            existingRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingRelationShips);
          } else if (type === "CaptainBeeRegister") {
            existingCaptainBees = getAffiliateUser?.captainBees;
            existingCaptainBees.push(email);
            console.log("new bees", existingCaptainBees);
            console.log("i am here captainbeeRegister");
            const defaultBeeRelationship: CaptainBeeRelationship = {
              mainCaptainBeeEmail: getReferredUser.email,
              captainBeeEmail: email,
              permissions: defaultPermissions,
            };
            existingCaptainBeeRelationShips.push(defaultBeeRelationship);
            console.log("new relationships", existingCaptainBees);
          }

          await affilateService.updatePart(
            {
              Email: getReferredUser.email,
            },
            {
              $set: {
                honeyBees: existinghoneyBees,
                captainBees: existingCaptainBees,
              },
            }
          );
          await uservice.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $set: {
                relationships: existingRelationShips,
                captainBeeRelationShips: existingCaptainBeeRelationShips,
              },
            }
          );
        } else {
          newUser.referralCodeUsed = "";
        }

        let pointsHistoryObj = {
          email: newUser.email,
          points: signUpPoints,
          type: "Sign Up Completed Points",
          date: new Date(),
        };
        //create a new Task center on user signUp;
        const newTaskCenter = {
          email: newUser.email,
          isTransactionCompletedInExchange: false,
          transactionPoints: 0,
          redeemPoints: 0,
          totalPoints: 10,
          inivitedUsersCount: 0,
          isInivitedThreeUsers: false,
          inivitedUserPoints: 0,
          isReportedBug: false,
          reportedBugPoints: 0,
          remainingPoints: 0,
          isParticipatedInLotto: false,
          lottoPoints: 0,
          pointsHistory: [pointsHistoryObj],
          signUpPoints: signUpPoints,
          isSignUp: true,
          isKYCPass: false,
          KYCPoints: 0,
          isBuyIndexxTokens: false,
          buyIndexxTokensPoints: 0,
        } as TaskCenter;

        //Exchange wallet

        //create new object for task center
        await taskCenterService.create(newTaskCenter);
        let createUser = await uservice.create(newUser);
        await createFirstTimeWallets(createUser.email);

        const message = "createdUser";

        let query = {};
        if (email && email.trim() !== "") {
          const normalizedEmail = email.toLowerCase().trim();
          query = { email: normalizedEmail };
          console.log("query", query);
        } else {
          return { status: 400, data: { message: "Email required" } };
        }

        // Fetch user data
        const user = await uservice.findOneSelect(query, this.registerFields);

        if (!user) {
          return { status: 404, data: { message: "No user found" } };
        }

        // Set userType
        user.userType = user.referralCodeUsed ? "HoneyBee" : "Indexx Exchange";

        // Issue token and update last login
        const tokenResponse = await new JwtAuthUtil().issueToken(user);
        let dateRes = {
          message,
          email: user.email,
          role: user.role,
          userType: user.userType,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
        }
        return {
          status: 200,
          data: dateRes,
          // data: {
          //   message,
          //   access_token: tokenResponse.access_token,
          //   refresh_token: tokenResponse.refresh_token
          // }
        };
      }
    } catch (err) {
      console.log(err, "Error in OAuth signup");
      return { status: 500, data: err };
    }
  }

  async registerDEXUser(req: any, res: any) {
    try {
      let { walletAddress } = req.body;
      let user = await uservice.findOneSelect(
        { walletAddress: walletAddress },
        this.registerFields
      );
      if (user) {
        return { status: 500, data: "WalletAddress AlreadyRegistered" };
      } else {
        let createNewUser: User = {
          walletAddress: walletAddress,
          role: UserRoleTypes.Standard,
          userType: "Decentralized",
        } as User;
        let createUser = await uservice.create(createNewUser);
        return { status: 200, data: "User created" };
      }
    } catch (err) {
      return { status: 500, data: err };
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
        userBankDetails,
        metaMaskAddress,
        blockchain,
      } = req.body;
      let user = await uservice.findOneSelect(
        { walletAddress: userWalletAddress },
        this.registerFields
      );
      if (user) {
        let userLite = {
          userId: user._id,
          email: user.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          //isVerified: user.verification.activated,
          language: user.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: inCurr,
          inAmount: inAmount,
          outCurrencyName: outCurr,
          outAmount: outAmount,
        } as OrderBreakdown;
        let adminFees = 0;
        let orderOps = new OrderOperations(req, res);
        if (orderType == "Buy") {
          adminFees = await orderOps.getAdminFees(req.body.outCurr);
        } else if (orderType == "Sell") {
          adminFees = await orderOps.getAdminFees(req.body.inCurr);
        } else if (orderType == "Convert") {
          adminFees = await orderOps.getAdminFees(req.body.inCurr);
        }
        let getWallet = {} as CoreWallet;
        let transactionAccount = {};
        let CalOrderRate = {};
        console.log(orderType === "Buy");
        if (orderType === "Buy") {
          CalOrderRate = {
            rate: Number(orderRate),
            currency: String(inCurr + "/" + outCurr),
          } as Rates;
          transactionAccount = {
            referenceName: "Stripe",
            userReceiveAddress:
              outCurr === "BTC" ? userWalletAddress : userWalletAddress,
            accountType: PaymentTypes.CC,
            amount: Number(inAmount),
            currency: inCurr,
          } as TransactionAccount;
        } else {
          getWallet = await coreWalletService.getWalletAddressForExchange(
            inCurr
          );
          CalOrderRate = {
            rate: Number(orderRate),
            currency: String(inCurr + "/" + outCurr),
          } as Rates;
          transactionAccount = {
            exchangeReceiveAddress: getWallet.coinAddress,
            userReceiveAddress: userWalletAddress,
            amount: Number(inAmount),
            currency: inCurr,
            accountBankName: userBankDetails.bankName,
            accountHolderName: userBankDetails.accountHolderName,
            accountNumber: userBankDetails.accountNumber,
            accountIBAN: userBankDetails.iban,
            accountBankAddress: userBankDetails.bankAddress,
            accountType: PaymentTypes.BankDirect,
          } as TransactionAccount;
        }
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            orderType == "Buy"
              ? "Buy"
              : orderType == "Sell"
                ? "Sell"
                : "Convert",
          orderRate: CalOrderRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType: PaymentTypes.DirectCrypto,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeName: "Decentralized",
          exchangeFees: Number(adminFees),
          usdValue: Number(req.body.USDValue),
          blockchainName: String(blockchain),
        } as Order;

        let order = await orderService.create(newOrder);
        if (orderType === "Buy") {
          // let finalAmount = (
          //   Math.round(order.breakdown.inAmount * 100) / 100
          // ).toFixed(2);
          // let paypalCreateOrder = await createDEXPaypalOrder(
          //   order.breakdown.inCurrenyName,
          //   finalAmount
          // );
          // console.log(paypalCreateOrder);
          // let newPaypalOrder = {
          //   orderId: order.orderId,
          //   paypalId: paypalCreateOrder.id,
          //   status: paypalCreateOrder.status,
          //   orderAmount: finalAmount,
          //   orderCurrency: order.breakdown.inCurrenyName,
          //   links: paypalCreateOrder.links,
          // };
          // let paypalOrder = await paypalService.create(newPaypalOrder);
          // if (paypalOrder) {
          //   return { status: 200, data: paypalOrder };
          // } else {
          //   return { status: 500, data: "Something went wrong" };
          // }
          let results = {
            orderId: order.orderId,
            inAmount: inAmount,
            outAmout: outAmount,
          };
          return { status: 200, data: results };
        } else {
          //get wallet address by coin symbol
          let results = {
            orderId: order.orderId,
            walletAddress: getWallet.coinAddress,
            walletName: getWallet.coinName,
            walletSymbol: getWallet.coinSymbol,
            inAmount: inAmount,
            outAmout: outAmount,
          };
          return { status: 200, data: results };
        }
      } else {
        let createNewUser: User = {
          walletAddress: userWalletAddress,
          role: UserRoleTypes.Standard,
          userType: "Decentralized",
        } as User;
        let createUser = await uservice.create(createNewUser);
        console.log(createUser);
        let userLite = {
          userId: createNewUser?._id,
          email: createNewUser?.email,
          firstName: "",
          lastName: "",
          // role: user.role,
          //isVerified: createNewUser.verification.activated,
          language: createNewUser.language,
        } as UserLite;

        let orderBreakdown = {
          inCurrenyName: inCurr,
          inAmount: inAmount,
          outCurrencyName: outCurr,
          outAmount: outAmount,
        } as OrderBreakdown;
        let adminFees = 0;
        let orderOps = new OrderOperations(req, res);
        if (orderType == "Buy") {
          adminFees = await orderOps.getAdminFees(req.body.currencyOut);
        } else if (orderType == "Sell") {
          adminFees = await orderOps.getAdminFees(req.body.currencyIn);
        } else if (orderType == "Convert") {
          adminFees = await orderOps.getAdminFees(req.body.currencyIn);
        }

        let getWallet = {} as CoreWallet;
        let transactionAccount = {};
        let CalOrderRate = {};
        if (orderType === "Buy") {
          CalOrderRate = {
            rate: Number(orderRate),
            currency: String(inCurr + "/" + outCurr),
          } as Rates;
          transactionAccount = {
            referenceName: "Stripe", //
            userReceiveAddress: userWalletAddress,
            accountType: PaymentTypes.CC,
            amount: Number(inAmount),
            currency: inCurr,
          } as TransactionAccount;
        } else {
          getWallet = await coreWalletService.getWalletAddressForExchange(
            inCurr
          );
          CalOrderRate = {
            rate: Number(orderRate),
            currency: String(inCurr + "/" + outCurr),
          } as Rates;

          transactionAccount = {
            exchangeReceiveAddress: getWallet.coinAddress,
            userReceiveAddress: userWalletAddress,
            amount: Number(inAmount),
            currency: inCurr,
            accountBankName: userBankDetails.bankName,
            accountHolderName: userBankDetails.accountHolderName,
            accountNumber: userBankDetails.accountNumber,
            accountIBAN: userBankDetails.iban,
            accountBankAddress: userBankDetails.bankAddress,
            email: userBankDetails.email,
            accountType: PaymentTypes.BankDirect,
          } as TransactionAccount;
        }
        let orderId = Math.floor(10000000 + Math.random() * 90000000);
        let newOrder = {
          orderId: orderId.toString(),
          status: OrderStatus.Quoted,
          orderType:
            orderType == "Buy"
              ? "Buy"
              : orderType == "Sell"
                ? "Sell"
                : "Convert",
          orderRate: CalOrderRate, //Latest rate at which the order is received
          receiverAccount: transactionAccount,
          paymentType: PaymentTypes.DirectCrypto,
          usdValue: req.body.USDValue,
          breakdown: orderBreakdown as OrderBreakdown,
          user: userLite,
          created: new Date(),
          exchangeName: "Decentralized",
          exchangeFees: Number(adminFees),
          blockchainName: String(blockchain),
        } as Order;

        let order = await orderService.create(newOrder);
        if (orderType === "Buy") {
          //--Below commented code is used for Paypal
          // let finalAmount = (
          //   Math.round(order.breakdown.inAmount * 100) / 100
          // ).toFixed(2);
          // let paypalCreateOrder = await createDEXPaypalOrder(
          //   order.breakdown.inCurrenyName,
          //   finalAmount
          // );
          // console.log(paypalCreateOrder);
          // let newPaypalOrder = {
          //   orderId: order.orderId,
          //   paypalId: paypalCreateOrder.id,
          //   status: paypalCreateOrder.status,
          //   orderAmount: finalAmount,
          //   orderCurrency: order.breakdown.inCurrenyName,
          //   links: paypalCreateOrder.links,
          // };
          // let paypalOrder = await paypalService.create(newPaypalOrder);
          // if (paypalOrder) {
          //   return { status: 200, data: paypalOrder };
          // } else {
          //   return { status: 500, data: "Something went wrong" };
          // }

          let results = {
            orderId: order.orderId,
            inAmount: inAmount,
            outAmout: outAmount,
          };
          return { status: 200, data: results };
        } else {
          //get wallet address by coin symbol
          let results = {
            orderId: order.orderId,
            walletAddress: getWallet.coinAddress,
            walletName: getWallet.coinName,
            walletSymbol: getWallet.coinSymbol,
            inAmount: inAmount,
            outAmout: outAmount,
          };
          return { status: 200, data: results };
        }
      }
    } catch (err) {
      console.log("er", err);
      return { status: 500, data: err };
    }
  }

  async issueToken0(req: any, res: any) {
    let { email, password, username } = req.body;
    email = String(email).toLowerCase();

    let user: User = {} as User;

    try {
      if (email !== undefined && email !== null && email !== "") {
        // Check by email
        user = await uservice.findOneSelect(
          { email: email },
          this.registerFields
        );
      } else if (
        username !== undefined &&
        username !== null &&
        username !== ""
      ) {
        // Check by username
        console.log("I am here", username);
        user = await uservice.findOneSelect(
          { username: username },
          this.registerFields
        );
      }

      if (!user) {
        const message = "No user found";
        return { status: 500, data: message };
      }

      const localAuthProvider = user?.authProviders.find(p => p.provider === 'Local');
      if (!localAuthProvider) {
        return { status: 400, data: "No local authentication found" };
      }
      let isMatch = await uservice.comparePassword(
        password,
        localAuthProvider.phash
      );

      user.userType = user.referralCodeUsed ? "HoneyBee" : "Indexx Exchange";

      if (isMatch) {
        const tokenResponse = await new JwtAuthUtil().issueToken(user);
        await uservice.updatePart(
          { email: email },
          { $set: { lastLogin: new Date() } }
        );
        return { status: 200, data: tokenResponse };
      } else {
        const message = "Invalid Password";
        return { status: 500, data: message };
      }
    } catch (error: any) {
      return { status: 500, data: error.message };
    }
  }

  async issueToken(req: any, res: any) {
    let { email, password, username } = req.body;
    email = String(email).toLowerCase().trim();

    try {
      // Ensure MongoDB connection before querying
      const { ensureMongoConnected } = require("../db/connection");
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return { status: 503, data: { message: "Database connection unavailable. Please try again later." } };
      }

      // Build query based on email or username
      const query = this.buildUserQuery(email, username);
      if (!query) {
        return { status: 400, data: { message: "Email or username required" } };
      }

      // Fetch user data
      const user = await uservice.findOneSelect(query, this.registerFields);
      if (!user) {
        return { status: 404, data: { message: "No user found" } };
      }

      // Check if "Local" is one of the authProviders
      const hasLocalAuth = user.authProviders.some(p => p.provider === 'Local');

      if (!hasLocalAuth) {
        const providerNames = user.authProviders.map(p => p.provider).join(" or ");
        return {
          status: 403,
          data: {
            message: `This account is registered with ${providerNames}. Please login using that method and set you password so that you can login using email next time.`,
          },
        };
      }

      // Validate password
      const isMatch = await uservice.comparePassword(
        password,
        user?.authProviders.find(p => p.provider === 'Local')?.phash
      );
      if (!isMatch) {
        return { status: 401, data: { message: "Invalid Password" } };
      }

      // Set userType and issue token
      user.userType = user.referralCodeUsed ? "HoneyBee" : "Indexx Exchange";
      const tokenResponse = await new JwtAuthUtil().issueToken(user);

      // Update last login
      await uservice.updatePart(query, { $set: { lastLogin: new Date() } });

      return { status: 200, data: tokenResponse };
    } catch (error: any) {
      return { status: 500, data: { message: error.message } };
    }
  }

  async issueTokenWithPhone(req: any, res: any) {
    let { password, phone } = req.body;

    try {
      // Build query based on email or username
      const query = this.buildUserQueryPhone(phone);
      console.log("query", query)
      if (!query) {
        return { status: 400, data: { message: "Email or username required" } };
      }

      // Fetch user data
      const user = await uservice.findOneSelect(query, this.registerFields);
      if (!user) {
        return { status: 404, data: { message: "No user found" } };
      }

      // Validate password
      const localAuthProvider = user?.authProviders.find(p => p.provider === 'Local');
      if (!localAuthProvider) {
        return { status: 400, data: "No local authentication found" };
      }
      const isMatch = await uservice.comparePassword(
        password,
        localAuthProvider.phash
      );
      if (!isMatch) {
        return { status: 401, data: { message: "Invalid Password" } };
      }

      console.log("phone in user", user)
      // Set userType and issue token
      user.userType = user.referralCodeUsed ? "HoneyBee" : "Indexx Exchange";
      const tokenResponse = await new JwtAuthUtil().issueToken(user);

      // Update last login
      await uservice.updatePart(query, { $set: { lastLogin: new Date() } });

      return { status: 200, data: tokenResponse };
    } catch (error: any) {
      return { status: 500, data: { message: error.message } };
    }
  }


  async updateUserDeviceInfo(req: any, res: any) {
    try {
      let { token, type, model, osVersion, email, uniqueId, brand } = req.body;
      email = String(email).toLowerCase().trim();

      let getUser = await uservice.findOne({ email });
      if (!getUser) {
        return { status: 404, data: { message: "No user found" } };
      }

      let updatedUserDevice = await uservice.updatePart({
        email: email,
      }, {
        $set: {
          fcmToken: token,
          deviceType: type,
          deviceModel: model,
          deviceBrand: brand,
          deviceId: uniqueId,
          osVersion: osVersion,
          lastActive: new Date(),
        },
      });
      if (updatedUserDevice) {
        return { status: 200, data: "User device info updated" };
      } else {
        return { status: 500, data: "Something went wrong" };
      }
    } catch (error: any) {
      return { status: 500, data: { message: error.message } };
    }
  }
  async logout(req: any, res: any) {
    try {
      let email = req?.user?.email || req?.body?.email;
      if (!email) {
        return { status: 400, data: { message: "badRequest" } };
      }
      email = String(email).toLowerCase().trim();

      const getUser = await uservice.findOne({ email });
      if (!getUser) {
        return { status: 404, data: { message: "No user found" } };
      }

      // Clear the device push token so notifications stop after sign-out.
      // Access/refresh JWTs are stateless; the client discards them on logout.
      await uservice.updatePart(
        { email },
        { $set: { fcmToken: "", lastActive: new Date() } }
      );

      return { status: 200, data: { message: "Logged out successfully" } };
    } catch (error: any) {
      return { status: 500, data: { message: error.message } };
    }
  }

  // Helper method to build the query based on email or username
  buildUserQuery(email: string, username: string) {
    if (email && email.trim() !== "") {
      return { email: email.toLowerCase().trim() };
    } else if (username && username.trim() !== "") {
      return { username: username.trim() };
    }
    return null; // Return null if neither email nor username is provided
  }

  // Helper method to build the query based on email or username
  buildUserQueryPhone(phone: string) {
    if (phone && phone.trim() !== "") {
      return { phone: phone.trim() };
    }
    return null; // Return null if neither email nor username is provided
  }

  async issueTokenForSignInToken(req: any, res: any, email: any) {
    try {
      let query = {};
      if (email && email.trim() !== "") {
        const normalizedEmail = email.toLowerCase().trim();
        query = { email: normalizedEmail };
        console.log("query", query);
      }
      // Fetch user data
      const user = await uservice.findOneSelect(query, this.registerFields);

      let userType = await checkUserType(String(email).toLowerCase());
      console.log("userType", userType);

      // Set userType
      user.userType = userType;

      // Issue token and update last login
      const tokenResponse = await new JwtAuthUtil().issueToken(user);
      await uservice.updatePart(query, { $set: { lastLogin: new Date() } });

      return { status: 200, data: tokenResponse };
    } catch (error: any) {
      return { status: 500, data: error.message };
    }
  }

  async issueTokenWithEmail(email: string) {
    try {
      let query = {};
      if (email && email.trim() !== "") {
        const normalizedEmail = email.toLowerCase().trim();
        query = { email: normalizedEmail };
        console.log("query", query);
      } else {
        return { status: 400, data: { message: "Email required" } };
      }

      // Fetch user data
      const user = await uservice.findOneSelect(query, this.registerFields);

      if (!user) {
        return { status: 404, data: { message: "No user found" } };
      }

      // Check if user has Local auth provider set
      const hasLocalAuth = user.authProviders.some(p => p.provider === 'Local');

      // Set userType
      user.userType = user.referralCodeUsed ? "HoneyBee" : "Indexx Exchange";

      // Issue token and update last login
      const tokenResponse = await new JwtAuthUtil().issueToken(user);
      await uservice.updatePart(query, { $set: { lastLogin: new Date() } });

      // // Add isPasswordSet to the response
      // const responseWithPasswordStatus = {
      //   ...tokenResponse,
      //   isPasswordSet: hasLocalAuth
      // };

      // return { status: 200, data: responseWithPasswordStatus };
      return { status: 200, data: tokenResponse };
    } catch (error: any) {
      return { status: 500, data: { message: error.message } };
    }
  }

  async issueTokenHive0(req: any, res: any) {
    try {
      let { email, password, username } = req.body;
      email = String(email).toLowerCase();
      let user: User = {} as User;
      if (
        email !== "" &&
        email !== undefined &&
        email !== null &&
        email !== "undefined"
      ) {
        let affiliateUser = await affilateService.findOne({
          Email: email,
        });

        user = await uservice.findOneSelect(
          { email: affiliateUser.Email },
          this.registerFields
        );
        user.userType = String("CaptainBee");
        console.log(user.userType, "userType");
        user.username = affiliateUser?.Username;
        let isMatch = await uservice.normalPasswordCompare(
          password,
          affiliateUser.password
        );
        if (isMatch) {
          const tokenResponse = await new JwtAuthUtil().issueToken(user);
          let updaTLSAstLogin = await uservice.updatePart(
            {
              email: email,
            },
            {
              $set: {
                lastLogin: new Date(),
              },
            }
          );
          return { status: 200, data: tokenResponse };
        } else {
          const message = "Invalid Password";
          return { status: 500, data: message };
        }
      } else {
        console.log("Username in hive", username);
        let affiliateUser = await affilateService.findOne({
          Username: username,
        });
        console.log("affiliate", affiliateUser);
        user = await uservice.findOneSelect(
          { email: affiliateUser.Email },
          this.registerFields
        );

        let isMatch = await uservice.normalPasswordCompare(
          password,
          affiliateUser.password
        );
        user.userType = String("CaptainBee");
        user.username = affiliateUser?.Username;
        if (isMatch) {
          const tokenResponse = await new JwtAuthUtil().issueToken(user);
          let updaTLSAstLogin = await uservice.updatePart(
            {
              email: email,
            },
            {
              $set: {
                lastLogin: new Date(),
              },
            }
          );
          return { status: 200, data: tokenResponse };
        } else {
          const message = "Invalid Password";
          return { status: 500, data: message };
        }
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: err };
    }
  }

  async issueTokenHive(req: any, res: any) {
    try {
      const { email, password, username } = req.body;
      const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

      // Build query based on email or username
      const query = this.buildQuery(normalizedEmail, username);
      if (!query) {
        return { status: 400, data: { message: "Email or username required" } };
      }

      // Fetch affiliate user based on query
      const affiliateUser = await affilateService.findOne(query);
      if (!affiliateUser) {
        return { status: 404, data: { message: "Affiliate user not found" } };
      }

      // Fetch user details
      const user = await uservice.findOneSelect(
        { email: affiliateUser.Email },
        this.registerFields
      );
      user.userType = "CaptainBee"; // Set user type
      user.username = affiliateUser.Username;

      // 🔐 Check if user has Local auth provider
      const hasLocalAuth = user.authProviders?.some(p => p.provider === 'Local');
      if (!hasLocalAuth) {
        const providerNames = user.authProviders?.map(p => p.provider).join(" or ");
        return {
          status: 403,
          data: {
            message: `This account is registered with ${providerNames}. Please login using that method.`,
          },
        };
      }

      // Validate password
      const isMatch = await uservice.normalPasswordCompare(
        password,
        affiliateUser.password
      );
      if (!isMatch) {
        return { status: 401, data: { message: "Invalid Password" } };
      }

      // Issue token and update last login
      const tokenResponse = await new JwtAuthUtil().issueToken(user);
      await uservice.updatePart(
        { email: affiliateUser.Email },
        { $set: { lastLogin: new Date() } }
      );

      return { status: 200, data: tokenResponse };
    } catch (error: any) {
      console.error("Error in issueTokenHive: ", error);
      return { status: 500, data: { message: error.message } };
    }
  }

  // Helper method to build the query based on email or username
  buildQuery(email: string | null, username: string | null) {
    if (email) {
      return { Email: email };
    } else if (username) {
      return { Username: username };
    }
    return null; // Return null if neither email nor username is provided
  }

  async issueTokenAdmin(req: any, res: any) {
    let { email, password } = req.body;
    email = String(email).toLowerCase();
    let user = await uservice.findOneSelect(
      { email: email },
      this.registerFields
    );
    if (user && user.role === UserRoleTypes.Admin) {
      const localAuthProvider = user.authProviders.find(p => p.provider === 'Local');
      if (!localAuthProvider) {
        return { status: 400, data: "No local authentication found" };
      }
      let isMatch = await uservice.comparePassword(
        password,
        localAuthProvider.phash
      );
      if (isMatch) {
        const tokenResponse = await new JwtAuthUtil().issueToken(user);
        let updaTLSAstLogin = await uservice.updatePart(
          {
            email: email,
          },
          {
            $set: {
              lastLogin: new Date(),
            },
          }
        );
        return { status: 200, data: tokenResponse };
      } else {
        const message = "Invalid Password";
        return { status: 500, data: message };
      }
    } else {
      const message = "Invalid email or Email has no access";
      return { status: 500, data: message };
    }
  }

  async validateEmail(req: any, res: any) {
    try {
      let { email, code } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      if (user) {
        let endTime = new Date();
        let startTime = user.verification.emailCodeExpiry;
        var difference = endTime.getTime() - startTime.getTime();
        var resultInMinutes = Math.round(difference / 60000);
        console.log(resultInMinutes);
        if (resultInMinutes > 15) {
          const message = "emailCodeExpired";
          return { status: 500, data: message };
        } else {
          if (user.verification.emailVerified == true) {
            const message = "Email Already Verified";
            return { status: 200, data: message };
          } else {
            if (user.verification.emailCode == code) {
              user.verification.emailVerified = true;

              // update user
              let updateUser = await uservice.updatePart(
                { _id: user._id, email: user.email },
                {
                  $set: {
                    "verification.emailVerified": true,
                    "verification.emailVerifiedOn": new Date(),
                  },
                }
              );
              if (updateUser) {
                const message = "Email Verified";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileVerifyingEmail";
                return { status: 500, data: message };
              }
            } else {
              const message = "Invalid Email Code";
              return { status: 500, data: message };
            }
          }
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async sendOtpToEmail(req: any, res: any) {
    try {
      let { email, type, website } = req.body;
      email = String(email).toLowerCase();

      let checkUser = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );

      if (type === "New Register") {
        if (checkUser) {
          return { status: 500, data: "Email already registered" };
        }
      } else if (type === "Forgot Password" || type === "Login") {
        // Check if email is registered
        if (!checkUser) {
          return { status: 500, data: "Email not registered" };
        }
      }

      // Fetch user details
      let user = await userOtpSerive.findOneSelect({ email: email }, {});


      // Helper function to create and send OTP
      const createAndSendOtp = async () => {
        let emailOTP = Math.floor(100000 + Math.random() * 900000);
        let emailCodeExpiry = new Date();
        emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
        await userOtpSerive.create({
          email: email,
          emailCode: String(emailOTP),
          emailCodeExpiry: emailCodeExpiry,
          emailVerified: false,
          emailVerifiedOn: new Date(),
        });

        // Send email
        await emailService.sendReviewEmail2(email, "User", emailOTP.toString(), '', type, website);
      };

      if (user) {
        if (user.emailCodeExpiry) {
          let endTime = new Date();
          let startTime = new Date(user.emailCodeExpiry);
          var difference = endTime.getTime() - startTime.getTime();
          var resultInMinutes = Math.round(difference / 60000);
          console.log(resultInMinutes);
          if (resultInMinutes > 15) {
            await createAndSendOtp();
          } else {
            if (user.emailVerified) {
              const message = "Email Already Verified";
              return { status: 200, data: message };
            } else {
              await createAndSendOtp();
            }
          }
        } else {
          await createAndSendOtp();
        }
      } else {
        await createAndSendOtp();
      }

      const message = "OTP sent";
      return { status: 200, data: message };
    } catch (err) {
      console.error("Error: ", err);
      return { status: 500, data: err };
    }
  }

  async resendEmailCode(req: any, res: any) {
    try {
      let { email, type, website, } = req.body;
      email = String(email).toLowerCase();

      // Fetch user details
      let user = await userOtpSerive.findOneSelect({ email: email }, {});

      // Helper function to create and send OTP
      const createAndSendOtp = async () => {
        let emailOTP = Math.floor(100000 + Math.random() * 900000);
        let emailCodeExpiry = new Date();
        emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
        await userOtpSerive.create({
          email: email,
          emailCode: String(emailOTP),
          emailCodeExpiry: emailCodeExpiry,
          emailVerified: false,
          emailVerifiedOn: new Date(),
        });

        // Send email
        await emailService.sendReviewEmail2(email, "User", emailOTP.toString(), '', type, website);
      };

      if (user) {
        if (user.emailCodeExpiry) {
          let endTime = new Date();
          let startTime = new Date(user.emailCodeExpiry);
          var difference = endTime.getTime() - startTime.getTime();
          var resultInMinutes = Math.round(difference / 60000);
          console.log(resultInMinutes);
          if (resultInMinutes > 15) {
            await createAndSendOtp();
          } else {
            if (user.emailVerified) {
              const message = "Email Already Verified";
              return { status: 200, data: message };
            } else {
              await createAndSendOtp();
            }
          }
        } else {
          await createAndSendOtp();
        }
      } else {
        await createAndSendOtp();
      }
      return { status: 200, data: "Otp sent to Email successfully" };

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async sendForgotOtpToEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();

      // Find user in user collection
      let userInfo = await uservice.findOneSelect({ email: email }, {});
      if (!userInfo) {
        return { status: 500, data: { message: "User not found" } };
      }

      // Find the user by email
      let user = await userOtpSerive.findOneSelect({ email: email }, {});
      console.log(user);

      // Helper function to create and send OTP
      const createAndSendOtp = async () => {
        let emailOTP = Math.floor(100000 + Math.random() * 900000);
        let forgotPasswordCodeExpiry = new Date();
        forgotPasswordCodeExpiry.setMinutes(
          forgotPasswordCodeExpiry.getMinutes() + 15
        );

        await userOtpSerive.create({
          email: email,
          forgotPasswordCodeExpiry: forgotPasswordCodeExpiry,
          forgotPasswordCode: String(emailOTP),
        });

        // Send email
        await emailService.sendOtpForPasswordReset(email, emailOTP.toString());
      };

      if (user) {
        if (user.forgotPasswordCodeExpiry) {
          let endTime = new Date();
          let startTime = new Date(user.forgotPasswordCodeExpiry);
          var difference = endTime.getTime() - startTime.getTime();
          var resultInMinutes = Math.round(difference / 60000);
          console.log(resultInMinutes);
          if (resultInMinutes > 15) {
            await createAndSendOtp();
          } else {
            await createAndSendOtp();
          }
        } else {
          await createAndSendOtp();
        }
      } else {
        await createAndSendOtp();
      }

      const message = "otp sent";
      return { status: 200, data: message };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: err };
    }
  }

  async validateOtp(req: any, res: any) {
    try {
      let { email, code } = req.body;
      email = String(email).toLowerCase();
      let user = await userOtpSerive.findOne({ email: email, emailCode: code });
      //  // let fullUser = await uservice.findOne({
      //     email: email,
      //   });
      console.log("user", user);
      if (user) {
        let endTime = new Date();
        let startTime = user.emailCodeExpiry as Date;
        var difference = endTime.getTime() - startTime.getTime();
        var resultInMinutes = Math.round(difference / 60000);
        console.log(resultInMinutes);
        if (resultInMinutes > 15) {
          const message = "emailCodeExpired";
          return { status: 500, data: message };
        } else {
          if (user.emailVerified == true) {
            const message = "Email Already Verified";
            return { status: 200, data: message };
          } else {
            if (user.emailCode == code) {
              user.emailVerified = true;
              //fullUser.verification.emailVerified = true;
              // update user
              let updateUser = await userOtpSerive.updatePart(
                { emailCode: code, email: user.email },
                {
                  $set: {
                    emailVerified: true,
                    emailVerifiedOn: new Date(),
                  },
                }
              );
              let updateFullUser = await uservice.updatePart(
                { email: email },
                {
                  $set: {
                    "verification.emailVerified": true,
                    "verification.emailVerifiedOn": new Date(),
                  },
                }
              );
              if (updateUser) {
                const message = "Email Verified";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileVerifyingEmail";
                return { status: 500, data: message };
              }
            } else {
              const message = "Invalid Email Code";
              return { status: 500, data: message };
            }
          }
        }
      } else {
        const message = "Email Registered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async validateForgotOtp(req: any, res: any) {
    try {
      let { email, code } = req.body;
      email = String(email).toLowerCase();
      let user = await userOtpSerive.findOne({
        email: email,
        forgotPasswordCode: code,
      });
      let endTime = new Date();
      let startTime = user.forgotPasswordCodeExpiry as Date;
      var difference = endTime.getTime() - startTime.getTime();
      var resultInMinutes = Math.round(difference / 60000);
      console.log(resultInMinutes);
      if (resultInMinutes > 15) {
        const message = "emailCodeExpired";
        return { status: 500, data: message };
      } else {
        if (user.forgotPasswordCode == code) {
          const message = "Otp Verified";
          return { status: 200, data: message };
        } else {
          const message = "Invalid Email Code";
          return { status: 500, data: message };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async forgotPassword(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      if (user) {
        await emailService.forgotPassWordEmail(email, "user");
        const message = "forgotPasswordEmailSent";
        return { status: 200, data: message };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async resetPassword(req: any, res: any) {
    try {
      let { email, password } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      console.log("user", user);
      if (user) {
        let getPassword = await uservice.createPassword(password);
        // let updateUser = await uservice.updatePart(
        //   { _id: user._id, email: user.email },
        //   {
        //     $set: {
        //       "authProviders.0.phash": getPassword.hash,
        //       "authProviders.0.psalt": getPassword.salt,
        //     },
        //   }
        // );

        // Check if user has Local auth provider
        const hasLocalAuth = user.authProviders.some(p => p.provider === 'Local');
        let updateUser;

        if (hasLocalAuth) {
          // Update existing Local auth provider
          const localAuthIndex = user.authProviders.findIndex(p => p.provider === 'Local');
          updateUser = await uservice.updatePart(
            { _id: user._id, email: user.email },
            {
              $set: {
                [`authProviders.${localAuthIndex}.phash`]: getPassword.hash,
                [`authProviders.${localAuthIndex}.psalt`]: getPassword.salt,
              },
            }
          );
        } else {
          // Add new Local auth provider
          updateUser = await uservice.updatePart(
            { _id: user._id, email: user.email },
            {
              $push: {
                authProviders: {
                  provider: 'Local',
                  phash: getPassword.hash,
                  psalt: getPassword.salt,
                }
              }
            }
          );
        }
        let userType = await checkUserType(
          String(req.body.email).toLowerCase()
        );
        if (userType === "CaptainBee") {
          let updateAffiliateData = await affilateService.updatePart(
            { Email: user.email },
            {
              $set: {
                password: password,
                confirmpass: password,
              },
            }
          );
          console.log("user Type ", userType);
          console.log("updateAffiliateData", updateAffiliateData);
        }

        if (updateUser) {
          const message = "passwordReset";
          return { status: 200, data: message };
        } else {
          const message = "errorWhileResettingPassword";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: err };
    }
  }

  async resetPasswordWithPhone(req: any, res: any) {
    try {
      let { phone, password } = req.body;
      let user = await uservice.findOneSelect(
        { phone: phoneQuery(phone, req.body?.countryCode) },
        this.registerFields
      );
      console.log("user", user);
      if (user) {
        let getPassword = await uservice.createPassword(password);
        // Check if user has Local auth provider
        const hasLocalAuth = user.authProviders.some(p => p.provider === 'Local');
        let updateUser;

        if (hasLocalAuth) {
          // Update existing Local auth provider
          const localAuthIndex = user.authProviders.findIndex(p => p.provider === 'Local');
          updateUser = await uservice.updatePart(
            { _id: user._id, email: user.email },
            {
              $set: {
                [`authProviders.${localAuthIndex}.phash`]: getPassword.hash,
                [`authProviders.${localAuthIndex}.psalt`]: getPassword.salt,
              },
            }
          );
        } else {
          // Add new Local auth provider
          updateUser = await uservice.updatePart(
            { _id: user._id, email: user.email },
            {
              $push: {
                authProviders: {
                  provider: 'Local',
                  phash: getPassword.hash,
                  psalt: getPassword.salt,
                }
              }
            }
          );
        }
        let userType = await checkUserType(String(user.email).toLowerCase());
        if (userType === "CaptainBee") {
          let updateAffiliateData = await affilateService.updatePart(
            { Email: user.email },
            {
              $set: {
                password: password,
                confirmpass: password,
              },
            }
          );
          console.log("user Type ", userType);
          console.log("updateAffiliateData", updateAffiliateData);
        }

        if (updateUser) {
          const message = "passwordReset";
          return { status: 200, data: message };
        } else {
          const message = "errorWhileResettingPassword";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: err };
    }
  }

  async changePassword(req: any, res: any) {
    try {
      let { email, oldPassword, newPassword } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      if (user) {
        // Find Local auth provider for password comparison
        const localAuthProvider = user.authProviders.find(p => p.provider === 'Local');
        if (!localAuthProvider) {
          return { status: 400, data: "No local authentication found" };
        }

        let isMatch = await uservice.comparePassword(
          oldPassword,
          localAuthProvider.phash
        );
        if (isMatch) {
          let getPassword = await uservice.createPassword(newPassword);

          // Update the Local auth provider
          const localAuthIndex = user.authProviders.findIndex(p => p.provider === 'Local');
          let updateUser = await uservice.updatePart(
            { _id: user._id, email: user.email },
            {
              $set: {
                [`authProviders.${localAuthIndex}.phash`]: getPassword.hash,
                [`authProviders.${localAuthIndex}.psalt`]: getPassword.salt,
              },
            }
          );
          let userType = await checkUserType(String(email).toLowerCase());
          if (userType === "CaptainBee") {
            let updateAffiliateData = await affilateService.updatePart(
              { Email: user.email },
              {
                $set: {
                  password: newPassword,
                  confirmpass: newPassword,
                },
              }
            );
            console.log("user Type ", userType);
            console.log("updateAffiliateData", updateAffiliateData);
          }
          if (updateUser) {
            const message = "Password Changed";
            return { status: 200, data: message };
          } else {
            const message = "Error While Changing Password";
            return { status: 500, data: message };
          }
        } else {
          const message = "Invalid Old Password";
          return { status: 500, data: message };
        }
      } else {
        const message = "Email Not Registered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async setPassword(req: any, res: any) {
    try {
      let { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return { status: 400, data: { message: "Email and password are required" } };
      }

      email = String(email).toLowerCase().trim();
      // SECURITY: Get email from authenticated user JWT token
      const token = req.headers.authorization.split(' ')[1];
      const claims = jwt.decode(token) as { email: string };
      const authenticatedEmail = claims?.email;
      if (!authenticatedEmail) {
        return { status: 401, data: { message: "Authentication required. Please login first." } };
      }

      // compare email with authenticated email
      if (email !== authenticatedEmail) {
        return { status: 401, data: { message: "User not authorized to set password" } };
      }

      // Find user
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      // Check if user already has Local auth provider
      const hasLocalAuth = user.authProviders.some(p => p.provider === 'Local');
      if (hasLocalAuth) {
        return {
          status: 400,
          data: { message: "Password already set. Use changePassword to update your existing password." }
        };
      }

      // Check if user has Google or Apple auth provider (security requirement)
      const hasGoogleAuth = user.authProviders.some(p => p.provider === 'Google');
      const hasAppleAuth = user.authProviders.some(p => p.provider === 'Apple');

      if (!hasGoogleAuth && !hasAppleAuth) {
        return {
          status: 403,
          data: { message: "Password can only be set for users registered with Google or Apple" }
        };
      }

      // Create password hash
      const passwordData = await uservice.createPassword(password);

      // Add Local auth provider to the user's authProviders array
      const updateUser = await uservice.updatePart(
        { _id: user._id, email: user.email },
        {
          $push: {
            authProviders: {
              provider: "Local",
              phash: passwordData.hash,
              psalt: passwordData.salt,
            },
          },
        }
      );

      // Update affiliate data if user is CaptainBee
      const userType = await checkUserType(email);
      if (userType === "CaptainBee") {
        try {
          await affilateService.updatePart(
            { Email: user.email },
            {
              $set: {
                password: password,
                confirmpass: password,
              },
            }
          );
          console.log("Updated affiliate data for CaptainBee user");
        } catch (affiliateError) {
          console.log("Warning: Failed to update affiliate data:", affiliateError);
          // Don't fail the main operation if affiliate update fails
        }
      }

      if (updateUser) {
        return {
          status: 200,
          data: { message: "Password set successfully. You can now login using email and password." }
        };
      } else {
        return { status: 500, data: { message: "Failed to set password. Please try again." } };
      }
    } catch (error: any) {
      console.error("Error in setPassword:", error);
      return { status: 500, data: { message: "Internal server error" } };
    }
  }

  async resendEmailCode0(req: any, res: any) {
    try {
      let { email, type, website, } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      if (user) {
        let emailOTP = Math.floor(100000 + Math.random() * 900000);
        let emailCodeExpiry = new Date();
        emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);
        await uservice.updatePart(
          { _id: user._id, email: user.email },
          {
            $set: {
              "verification.emailCode": emailOTP,
              "verification.emailCodeExpiry": emailCodeExpiry,
              "verification.emailVerified": false,
            },
          }
        );
        /* send email */
        await emailService.sendReviewEmail2(email, "User", emailOTP.toString(), '', type, website);
        return { status: 200, data: "Otp sent to Email successfully" };
      } else {
        const message = "Email Not Registered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserLiteDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        return { status: 200, data: user };
      } else {
        return { status: 200, data: null, reason: "emailNotRegistered" };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getMiningLiteDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email || "").trim().toLowerCase();
      if (!email) return { status: 400, data: "Email is required" };

      // Parallel reads for lower latency
      const [user, miningData, miningPlan] = await Promise.all([
        uservice.findOneSelect({ email }, this.miningLiteFields),
        miningService.getMiningData(email, "BTCY"),
        subscriptionService.findOne({ email, status: "Active", coinSymbol: "BTCY" }),
      ]);

      if (!user) return { status: 404, data: "emailNotRegistered" };
      if (!miningData) return { status: 404, data: "Mining data not found" };

      const isActive = Boolean(miningData.isMiningActive ?? miningData.isActive ?? false);
      const lastClaimIso = miningData.lastClaimTime
        ? new Date(miningData.lastClaimTime).toISOString()
        : null;

      const payload = {
        "referralcode": user?.referralCode ?? null,
        "miningStatus": isActive ? "Active" : "Inactive",
        "teamCount": Array.isArray(user?.relationships) ? user.relationships.length : 0,
        "miningRate": Number(miningData?.miningRate ?? 0),
        "mySubscriptionPlan": miningPlan?.plan ?? null,
        "myBalance": Number(miningData?.totalMined ?? 0),
        "lastClaimTime": lastClaimIso,
      };

      return { status: 200, data: payload };
    } catch (err: any) {
      return { status: 500, data: err?.message || String(err) };
    }
  }

  async getUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        return { status: 200, data: user };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      console.log("email", email);
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        let userType = "";
        userType = await checkUserType(String(email).toLowerCase());
        user.userType = userType;
        let affilaiteData = {};
        if (userType === "CaptainBee") {
          affilaiteData = await affilateService.findOne({
            Email: email,
          });
        }

        return { status: 200, data: { user, affilaiteData } };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllUserDetailsForAdmin0(req: any, res: any) {
    try {
      let { email } = req.params;
      console.log("email", email);
      email = String(email).toLowerCase();

      // Fetch user data
      let user = await uservice.findOneSelect({ email: email }, {});
      if (!user) {
        const message = "emailNotRegistered";
        return res.status(500).json({ message });
      }

      // Determine user type
      let userType = await checkUserType(String(email).toLowerCase());
      user.userType = userType;

      // Fetch affiliate data if the user is a CaptainBee
      let affilaiteData = {};
      if (userType === "CaptainBee") {
        affilaiteData = await affilateService.findOne({ Email: email });
      }

      // Fetch order data
      const orders = await orderService.find({ "user.userId": user.id });

      // Fetch transaction history and include price for each transaction
      const transactionHistory = await transactionService.find({ email });
      const transactionHistoryWithPrices = await Promise.all(
        transactionHistory.map(async (transaction) => {
          if (transaction.currencyRef) {
            const price = await getPriceByName(String(transaction.currencyRef));
            return { ...transaction, price };
          }
          return transaction;
        })
      );

      return {
        status: 200,
        data: {
          user,
          affilaiteData,
          ordersData: orders,
          transactionHistory: transactionHistoryWithPrices,
        },
      };
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  async getAllUserDetailsForAdmin(req: any, res: any) {
    try {
      let { email } = req.params;
      console.log("email", email);
      email = String(email).toLowerCase();

      // Fetch user data
      let user = await uservice.findOneSelect({ email: email }, {});
      if (!user) {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }

      // Determine user type
      let userType = await checkUserType(String(email).toLowerCase());
      user.userType = userType;

      // Fetch affiliate data if the user is a CaptainBee
      let affiliateData = {};
      if (userType === "CaptainBee") {
        affiliateData = await affilateService.findOne({ Email: email });
      }

      // Fetch order data
      const orders = await orderService.find({ "user.userId": user.id });

      // Fetch transaction history and include price for each transaction
      const transactionHistory = await transactionService.find({ email });
      const transactionHistoryWithPrices = await Promise.all(
        transactionHistory.map(async (transaction) => {
          let price = 0;
          if (transaction.currencyRef) {
            const priceResponse = await getPriceByName(
              String(transaction.currencyRef)
            );
            price = priceResponse ? priceResponse.data : 0;
          }
          return {
            orderId: transaction.orderId,
            extRef: transaction.extRef,
            txId: transaction.txId,
            from: transaction.from,
            to: transaction.to,
            amount: transaction.amount,
            info: transaction.info,
            status: transaction.status,
            currencyRef: transaction.currencyRef,
            walletType: transaction.walletType,
            transactionType: transaction.transactionType,
            email: transaction.email,
            exchangeName: transaction.exchangeName,
            txDate: transaction.txDate,
            userWalletAddress: transaction.userWalletAddress,
            benificaryAddress: transaction.benificaryAddress,
            depositedType: transaction.depositedType,
            paymentReceiptUrl: transaction.paymentReceiptUrl,
            price: price,
          };
        })
      );

      // Fetch wallet data with prices and update into user object
      user.userWallets = await Promise.all(
        user.userWallets.map(async (wallet: any) => {
          wallet.coinPrivateKey = ""; // Removing sensitive data
          if (wallet.coinBalance > 0 || wallet?.coinStakedBalance > 0) {
            const priceResponse = await this.getPriceByNameForWallet(
              wallet.coinSymbol,
              "Buy",
              wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
            );
            wallet.coinPrice = Number(priceResponse.data);
          } else {
            wallet.coinPrice = 0;
          }
          return wallet;
        })
      );

      return {
        status: 200,
        data: {
          user,
          affiliateData,
          ordersData: orders,
          transactionHistory: transactionHistoryWithPrices,
        },
      };
    } catch (err: any) {
      console.error("Error fetching user details:", err);
      return { status: 500, data: err.message || err };
    }
  }

  async getHoneyBeeUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      let user = await uservice.findOneSelect(
        { email: String(email).toLowerCase() },
        {}
      );
      let orders = await orderService.find({
        "user.email": email,
        status: "Completed",
      });
      const timestamp = mongoose.Types.ObjectId(user._id).getTimestamp();
      console.log("Creation date:", timestamp);
      const date = new Date(timestamp);
      const options = {
        year: "numeric",
        month: "long",
        day: "numeric",
      } as any;
      const formattedDate = date.toLocaleDateString("en-US", options);
      user.accountCreationDate = formattedDate;
      const downgradeTime = await this.calculateDowngradeTime(email);

      const nextPurchaseDate = await this.getNextPurchaseDateOrDowngradeTime(
        email
      );

      let paypalSubscriptionData = await paypalSubscriptionService.findOne({
        payerEmail: email,
      });
      let getPaypalSubscriptionDetails = paypalSubscriptionData
        ? await getSubscriptionDetails(paypalSubscriptionData.subscriptionId)
        : null;

      let finalUser = {
        ...user,
        accountCreationDate: formattedDate,
        totalOrders: orders,
        remainingTimeForINEXOrder: downgradeTime,
        nextPurchaseDate: nextPurchaseDate,
        paypalSubscriptionDetails: {
          paypalSubscriptionDBData: paypalSubscriptionData,
          paypalSubscriptionDetails: getPaypalSubscriptionDetails,
        },
      };
      if (user) {
        return { status: 200, data: finalUser };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getNextPurchaseDateOrDowngradeTime(email: string): Promise<string> {
    try {
      const powerPackData = await powerPackService.findOne({ email: email });
      const inexPurchase = await orderService.findOne({
        "user.email": email,
        comments: "INEX Monthly Purchase",
        status: OrderStatus.Completed,
      });

      let nextActionDate: moment.Moment;

      if (inexPurchase && inexPurchase.orderCompletedOn) {
        nextActionDate = moment(inexPurchase.orderCompletedOn).add(30, "days");
      } else if (powerPackData && powerPackData.purchaseDate) {
        nextActionDate = moment(powerPackData.purchaseDate).add(30, "days");
      } else {
        return "";
      }

      return nextActionDate.format("YYYY-MM-DD HH:mm:ss");
    } catch (err) {
      console.log("Err in getNextPurchaseDateOrDowngradeTime", err);
      return "";
    }
  }

  async calculateDowngradeTime(email: string): Promise<number> {
    try {
      const powerPackData = await powerPackService.findOne({ email: email });
      const inexPurchase = await orderService.findOne({
        email: email,
        comments: "INEX Monthly Purchase",
        status: OrderStatus.Completed,
      });

      let purchaseDate = inexPurchase
        ? inexPurchase.orderCompletedOn
        : powerPackData?.purchaseDate;
      if (!purchaseDate) {
        console.log("No valid purchase date found");
        return 0;
      }

      const currentDate = new Date();
      const deadlineDate = moment(purchaseDate).add(30, "days");

      return deadlineDate.diff(currentDate, "days");
    } catch (err) {
      console.log("Err in calculateDowngradeTime", err);
      return 0;
    }
  }

  async getAllUsers(req: any, res: any) {
    try {
      let users = await uservice.find({});
      if (users) {
        return { status: 200, data: users };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllCaptainsUsers(
    req: Request,
    res: Response
  ): Promise<{ status: number; data: any }> {
    try {
      const getAllCaptains = await affilateService.find({});

      // First, fetch all user data in parallel
      const userDataPromises = getAllCaptains.map((element) =>
        uservice.findOne({ email: element.Email })
      );
      const allUserData = await Promise.all(userDataPromises);

      // Then, fetch other data in parallel using the user data
      const allCaptainsDataPromises = allUserData.map(
        async (userData, index) => {
          const email = getAllCaptains[index].Email;

          const [
            powerPackData,
            orders,
            stakingData,
            transactionHistory,
            commissionData,
            subscriptionData,
          ] = await Promise.all([
            powerPackService.findOne({ email }),
            orderService.find({ "user.userId": userData?.id }),
            stakingService.find({ email }),
            transactionService.find({ email }),
            commissionService.find({ mainCaptainBeeEmail: email }),
            paypalSubscriptionService.findOne({ payerEmail: email }),
          ]);

          // Fetch price for each transaction with a valid currencyRef
          const transactionHistoryWithPrices = await Promise.all(
            transactionHistory.map(async (transaction) => {
              let price = 0;
              if (transaction.currencyRef) {
                const priceResponse = await getPriceByName(
                  String(transaction.currencyRef)
                );
                price = priceResponse ? priceResponse.data : 0;
              }
              return {
                orderId: transaction.orderId,
                extRef: transaction.extRef,
                txId: transaction.txId,
                from: transaction.from,
                to: transaction.to,
                amount: transaction.amount,
                info: transaction.info,
                status: transaction.status,
                currencyRef: transaction.currencyRef,
                walletType: transaction.walletType,
                transactionType: transaction.transactionType,
                email: transaction.email,
                exchangeName: transaction.exchangeName,
                txDate: transaction.txDate,
                userWalletAddress: transaction.userWalletAddress,
                benificaryAddress: transaction.benificaryAddress,
                depositedType: transaction.depositedType,
                paymentReceiptUrl: transaction.paymentReceiptUrl,
                price: price,
              };
            })
          );

          console.log(
            "transactionHistoryWithPrices",
            transactionHistoryWithPrices
          );
          return {
            affiliateData: getAllCaptains[index],
            useFullData: userData,
            powerPackData,
            ordersData: orders,
            stakingData,
            transactionHistory: transactionHistoryWithPrices,
            commissionData,
            subscriptionData,
          };
        }
      );

      const allCaptainsData = await Promise.all(allCaptainsDataPromises);
      return { status: 200, data: allCaptainsData };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: err };
    }
  }

  async getAllUsersData(
    req: any,
    res: Response
  ): Promise<{ status: number; data: any }> {
    try {
      const { page = 1, limit = 100 } = req.query; // Default to page 1 and limit of 100
      const offset = (page - 1) * limit;

      let usersCount = await uservice.findCount({});
      // Fetch users with pagination
      let users = await uservice.findPaginatedSkip(
        limit,
        offset,
        null,
        {},
        null
      );

      console.log("user count", users.length);
      console.log("usersCount", usersCount);
      // First, fetch all user data in parallel
      const userDataPromises = users.map((element) =>
        uservice.findOne({ email: element.email })
      );
      const allUserData = await Promise.all(userDataPromises);

      // Then, fetch other data in parallel using the user data
      const allCaptainsDataPromises = allUserData.map(
        async (userData, index) => {
          const email = users[index].email;

          const [orders, transactionHistory] = await Promise.all([
            orderService.find({ "user.userId": userData.id }),
            transactionService.find({ email }),
          ]);

          // Fetch price for each transaction with a valid currencyRef
          const transactionHistoryWithPrices = await Promise.all(
            transactionHistory.map(async (transaction) => {
              let price = 0;
              if (transaction.currencyRef) {
                const priceResponse = await getPriceByName(
                  String(transaction.currencyRef)
                );
                price = priceResponse ? priceResponse.data : 0;
              }
              return {
                orderId: transaction.orderId,
                extRef: transaction.extRef,
                txId: transaction.txId,
                from: transaction.from,
                to: transaction.to,
                amount: transaction.amount,
                info: transaction.info,
                status: transaction.status,
                currencyRef: transaction.currencyRef,
                walletType: transaction.walletType,
                transactionType: transaction.transactionType,
                email: transaction.email,
                exchangeName: transaction.exchangeName,
                txDate: transaction.txDate,
                userWalletAddress: transaction.userWalletAddress,
                benificaryAddress: transaction.benificaryAddress,
                depositedType: transaction.depositedType,
                paymentReceiptUrl: transaction.paymentReceiptUrl,
                price: price,
              };
            })
          );

          return {
            useFullData: userData,
            ordersData: orders,
            transactionHistory: transactionHistoryWithPrices,
          };
        }
      );

      const allCaptainsData = await Promise.all(allCaptainsDataPromises);
      return { status: 200, data: allCaptainsData };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllAdminAuditLogs(req: any, res: any) {
    try {
      let adminAuditLogs = await adminAuditLogService.find({});
      if (adminAuditLogs) {
        return { status: 200, data: adminAuditLogs };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getSpecificCaptainUserPowerpackData(
    req: Request,
    res: Response
  ): Promise<{ status: number; data: any; message?: string }> {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      // Validate email
      if (!email || typeof email !== "string" || !email.includes("@")) {
        console.error("Invalid email:", email);
        return { status: 400, data: null, message: "Invalid email address." };
      }

      // Fetch power pack data
      const powerPackData = await powerPackService.findOne({ email });

      // Check if power pack data is found
      if (!powerPackData) {
        console.error("No power pack data found for email:", email);
        return {
          status: 404,
          data: null,
          message: "Power pack data not found.",
        };
      }

      return { status: 200, data: powerPackData };
    } catch (err) {
      console.error("Error in getSpecificCaptainUserPowerpackData:", err);
      return { status: 500, data: null, message: "Internal server error." };
    }
  }

  async getAllUsersWithdrawRequests(
    req: Request,
    res: Response
  ): Promise<{ status: number; data: any }> {
    try {
      const allCaptainsData = await transactionService.find({
        transactionType: "WITHDRAW_FIAT",
      });
      return { status: 200, data: allCaptainsData };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllUsersCryptoWithdrawRequests(
    req: Request,
    res: Response
  ): Promise<{ status: number; data: any }> {
    try {
      const allCaptainsData = await transactionService.find({
        transactionType: "WITHDRAW_CRYPTO",
      });
      return { status: 200, data: allCaptainsData };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllUsersFiatDepositRequests(
    req: Request,
    res: Response
  ): Promise<{ status: number; data: any }> {
    try {
      const allCaptainsData = await transactionService.find({
        transactionType: "DEPOSIT_FIAT",
      });

      const dataPromises = allCaptainsData.map(async (txData) => {
        let orderData = null;
        if (txData.orderId) {
          orderData = await orderService.findOne({
            orderId: txData.orderId,
          });
        }
        return { txData, orderData };
      });

      const finalData = await Promise.all(dataPromises);

      return { status: 200, data: finalData };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editUserData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();

      let editData = req.body.editData;

      if (!email) {
        return { status: 400, data: "Email is required" };
      }

      let user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: "No User found" };
      }

      let updatedUser = await uservice.updatePart(
        { email: email },
        { $set: editData }
      );

      console.log("updateUser", updatedUser);
      return { status: 200, data: "User updated successfully" };
    } catch (err) {
      console.error("Error updating user:", err);
      return { status: 500, data: "Unhandled error: " + err };
    }
  }

  async editAffiliateData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();

      let editData = req.body.editData;
      let user = await affilateService.findOne({
        Email: email,
      });
      if (user) {
        let updateUser = await affilateService.updatePart(
          {
            Email: email,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editCommissionData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();
      let id = req.body.id;
      let editData = req.body.editData;
      let user = await commissionService.findOne({
        mainCaptainBeeEmail: email,
        id: id,
      });
      if (user) {
        let updateUser = await commissionService.updatePart(
          {
            mainCaptainBeeEmail: email,
            id: id,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editStakingData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();
      let id = req.body.id;
      let editData = req.body.editData;
      let user = await stakingService.findOne({
        email: email,
        id: id,
      });
      if (user) {
        let updateUser = await stakingService.updatePart(
          {
            email: email,
            id: id,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editTransactionHistoryData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();
      let id = req.body.id;
      let editData = req.body.editData;
      let user = await transactionService.findOne({
        email: email,
        id: id,
      });
      if (user) {
        let updateUser = await transactionService.updatePart(
          {
            email: email,
            id: id,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editOrderData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();
      let id = req.body.id;
      let editData = req.body.editData;
      let user = await orderService.findOne({
        email: email,
        id: id,
      });
      if (user) {
        let updateUser = await orderService.updatePart(
          {
            email: email,
            id: id,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async editPowerPackData(req: any, res: any) {
    try {
      let email = req.body.email;
      email = String(email).toLowerCase();
      let id = req.body.id;
      let editData = req.body.editData;
      let user = await powerPackService.findOne({
        email: email,
        id: id,
      });
      if (user) {
        let updateUser = await powerPackService.updatePart(
          {
            email: email,
            id: id,
          },
          {
            $set: {
              ...editData,
            },
          }
        );
        console.log("updateUser", updateUser);
        return { status: 200, data: user };
      } else {
        const message = "No User found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createPowerpackData(req: any, res: any) {
    try {
      const InexToSent = req.body.totalInexBonus;
      const powerpackPrice = req.body.powerPackPrice;
      let affilaiteEmail = req.body.email;
      affilaiteEmail = String(affilaiteEmail).toLowerCase();
      let orderBreakdown = {
        inCurrenyName: "USD",
        inAmount: powerpackPrice,
        outCurrencyName: "INEX",
        outAmount: InexToSent,
        finalAmountAfterDiscount: powerpackPrice,
      } as OrderBreakdown;
      let userLite = {
        userId: "",
        email: affilaiteEmail,
        firstName: "",
        lastName: "",
        isVerified: true,
        language: "US",
      } as UserLite;
      let transactionAccount = {} as TransactionAccount;

      const currencyRes = await currencyService.findOne({
        currencyType: "Crypto",
        code: "INEX",
      });

      let getRate = {
        currency: currencyRes.code,
        rate: currencyRes.buyPrice,
      } as Rates;
      let orderId = Math.floor(10000000 + Math.random() * 90000000);

      let newOrder = {
        orderId: orderId.toString(),
        status: OrderStatus.Quoted,
        orderType: OrderType.PowerPack,
        orderRate: {} as Rates,
        receiverAccount: transactionAccount,
        paymentType: req.body.paymentType,
        breakdown: orderBreakdown,
        user: userLite,
        created: new Date(req.body.date),
        exchangeFees: Number(0),
        discountCode: "",
        captainBeeEmail: "",
        discountPercentage: 0, // Using optional chaining with nullish coalescing
      } as Order;

      let order = await orderService.create(newOrder);

      let powerpackData = await powerPackService.create({
        amount: req.body.powerPackPrice,
        email: affilaiteEmail,
        orderId: orderId.toString(),
        purchaseDate: new Date(req.body.date),
        type: req.body.powerPackType,
        paymentMethodUsed: req.body.paymentType,
        paymentStatus: OrderStatus.Quoted,
        notes: req.body.powerPackNotes,
      });
      console.log("powerpackData", powerpackData);

      let process = await this.updatePowerPackData(
        req,
        res,
        orderId.toString(),
        InexToSent
      );
      return { status: 200, data: process };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateUserWallet(req: any, res: any) {
    try {
      let {
        email,
        coin,
        amount,
        isStaked,
        stakingPercentage,
        type,
        txType,
        amountInvested,
        notes,
        fees,
        amountMode,
        rate,
      } = req.body;

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

        let feesAmount = (Number(amountInvested) * fees) / 100;
        let finalFeesAmount = feesAmount / tokenUsdtValue;
        console.log("finalFeesAmount", finalFeesAmount, coin);
        let profitAccountEmail = "wallet@azooca.com";
        if (
          await orderService.checkAndCreateUserWallet(profitAccountEmail, coin)
        ) {
          // Add fees to wallet@azooca.com
          let updatFeeseWallet = await uservice.updatePart(
            {
              email: profitAccountEmail,
              "userWallets.coinSymbol": coin,
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
            from: email, // From the user's email
            to: profitAccountEmail, // To the profit account
            amount: finalFeesAmount, // Amount of crypto taken as profit
            info: "Buy Fees transferred", // Information about the transaction
            status: OrderStatus.Completed, // Status of the transaction
            currencyRef: coin, // The currency in which profit is transferred (e.g., BTC)
            walletType: "Profit Account", // Indicate that this is for the profit account
            transactionType: "FEES", // Type of transaction
            exchangeName: "CEX", // Exchange name if applicable
            email: profitAccountEmail, // The email for the profit account
            txDate: new Date(), // Date of the profit transaction
            benificaryAddress: "", // Beneficiary address if applicable
            notes: `Buy Fees of ${finalFeesAmount.toFixed(
              8
            )} ${coin} taken from ${email} and transferred to profit account`,
            rate: tokenUsdtValue,
          };
          await txService.create(newProfitTransaction);
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
              await orderService.checkAndCreateUserWallet(
                getUser.email,
                String(coin)
              )
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
          } else {
            let updateWallet;
            if (
              await orderService.checkAndCreateUserWallet(
                getUser.email,
                String(coin)
              )
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
          let newWallet = await orderService.checkAndCreateUserWallet(
            email,
            coin
          );

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
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getKYCData(req: any, res: any) {
    try {
      let users = await uservice.findSelect(
        {},
        {
          email: 1,
          isKYCPass: 1,
          kycStatus: 1,
        }
      );
      if (users) {
        return { status: 200, data: users };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getPaypalOrders(req: any, res: any) {
    try {
      let getAllPaypalOrders = await paypalService.find({});
      if (getAllPaypalOrders) {
        return { status: 200, data: getAllPaypalOrders };
      } else {
        const message = "No Paypal Orders found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getInvestmentRecords(req: any, res: any) {
    try {
      let getAllInvestmentRecords = await investmentService.find({});
      if (getAllInvestmentRecords) {
        return { status: 200, data: getAllInvestmentRecords };
      } else {
        const message = "No Investments found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addNewInvestment(req: any, res: any) {
    try {
      let creatNewInvestment = req.body as InvestmentRecord;
      console.log("creatNewInvestment", creatNewInvestment);
      let addNewInvestment = await investmentService.create(creatNewInvestment);
      return { status: 200, data: addNewInvestment };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async acceptCaptainBeeRequest(req: any, res: any) {
    try {
      let captainBeeDetails = req.body.captainBeeData as Affiliate;
      let addNewInvestment;
      if (req.body.status === "Accept") {
        addNewInvestment = await affilateService.create(captainBeeDetails);
        let res = await tempAffilicateService.updatePart(
          {
            Email: captainBeeDetails.Email,
          },
          {
            adminAccepted: true,
          }
        );
        let getUser = await uservice.findOne({
          email: captainBeeDetails.Email,
        });
        let getPassword = await uservice.createPassword(
          captainBeeDetails.password
        );
        const localAuthProvider = getUser.authProviders.find(p => p.provider === 'Local');
        if (localAuthProvider) {
          localAuthProvider.phash = getPassword.hash;
          localAuthProvider.psalt = getPassword.salt;
        }
        let createUser = await uservice.updatePart(
          {
            email: req.body.Email,
          },
          {
            $set: {
              authProviders: getUser.authProviders,
            },
          }
        );
      }
      await new SendEmail().sendCaptainBeeRequestStatusNotification(
        captainBeeDetails.Email,
        captainBeeDetails?.firstname + " " + captainBeeDetails?.lastname,
        req.body.status,
        req.body.reason
      );
      return { status: 200, data: addNewInvestment };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getCaptainBeeRequest(req: any, res: any) {
    try {
      let res = await tempAffilicateService.find({
        isNormalUser: true,
      });

      return { status: 200, data: res };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateUserKYCData(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      if (user) {
        let res = await uservice.updatePart(
          {
            email: email,
          },
          {
            $set: {
              isKYCPass: true,
              kycStatus: req.body.kycStatus ? "Completed" : "",
            },
          }
        );
        let updatedUser = await uservice.findOne({ email: email });
        return { status: 200, data: updatedUser };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async inexCommissionPayout(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      let affiliateUser = await affilateService.findOne({
        Email: email,
      });
      if (user && affiliateUser) {
        let inexCommissionToBePaid = req.body.inexAmount;
        if (await orderService.checkAndCreateUserWallet(user.email, "INEX")) {
          //Update the INEX wallet
          let updateUserWallet = await uservice.updatePart(
            {
              email: email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $inc: {
                "userWallets.$.coinBalance": inexCommissionToBePaid,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        }
        // Update the INEX payout values in Affiliate table
        let updateAffiliate = await affilateService.updatePart(
          {
            Email: email,
          },
          {
            $set: {
              "totalCommissionToBePaid.amountInINEX":
                affiliateUser.totalCommissionToBePaid.amountInINEX -
                inexCommissionToBePaid,
            },
            $push: {
              payouts: {
                amount: inexCommissionToBePaid,
                date: new Date(), // Current date
                payoutType: "Captain Bee's INEX Commission Payout",
                method: "INEX",
                status: "Paid",
                notes: req.body.notes ? req.body.notes : "Commission payout",
              },
            },
          }
        );
        //Send email informing the commission payout
        let payoutDetails = {
          amount: inexCommissionToBePaid,
          date: new Date(), // Current date
          payoutType: "Captain Bee's INEX Commission Payout",
          method: "INEX",
          status: "Paid",
          notes: req.body.notes ? req.body.notes : "Commission payout",
        };
        await new SendEmail().sendCommissionPayoutEmail(
          user?.email,
          payoutDetails
        );

        let updatedUser = await affilateService.findOne({
          Email: email,
        });
        return { status: 200, data: updatedUser };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async honeyBeeInexCommissionPayout(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();

      let user = await uservice.findOne({ email: email });
      let affiliateUser = await affilateService.findOne({
        Email: email,
      });
      if (user && affiliateUser) {
        let inexCommissionToBePaid = req.body.inexAmount;
        if (await orderService.checkAndCreateUserWallet(user.email, "INEX")) {
          //Update the INEX wallet
          let updateUserWallet = await uservice.updatePart(
            {
              email: email,
              "userWallets.coinSymbol": "INEX",
            },
            {
              $inc: {
                "userWallets.$.coinBalance": inexCommissionToBePaid,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        }
        // Update the INEX payout values in Affiliate table
        let updateAffiliate = await affilateService.updatePart(
          {
            Email: email,
          },
          {
            $set: {
              "totalHoneyBeeCommissionToBePaid.amountInINEX":
                affiliateUser.totalHoneyBeeCommissionToBePaid.amountInINEX -
                inexCommissionToBePaid,
            },
            $push: {
              payouts: {
                amount: inexCommissionToBePaid,
                date: new Date(), // Current date
                payoutType: "Honey Bee's INEX Commission Payout",
                method: "INEX",
                status: "Paid",
                notes: req.body.notes ? req.body.notes : "Commission payout",
              },
            },
          }
        );
        //Send email informing the commission payout
        let payoutDetails = {
          amount: inexCommissionToBePaid,
          date: new Date(), // Current date
          payoutType: "Honey Bee's INEX Commission Payout",
          method: "INEX",
          status: "Paid",
          notes: req.body.notes ? req.body.notes : "Commission payout",
        };
        await new SendEmail().sendCommissionPayoutEmail(
          user?.email,
          payoutDetails
        );

        let updatedUser = await affilateService.findOne({
          Email: email,
        });
        return { status: 200, data: updatedUser };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async usdCommissionPayout(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();

      let user = await uservice.findOne({ email: email });
      let affiliateUser = await affilateService.findOne({
        Email: email,
      });
      if (user && affiliateUser) {
        let USDCommissionToBePaid = Number(req.body.usdAmount);

        if (await orderService.checkAndCreateUserWallet(user.email, "USD")) {
          //Update the USD wallet
          let updateUserWallet = await uservice.updatePart(
            {
              email: email,
              "userWallets.coinSymbol": "USD",
            },
            {
              $inc: {
                "userWallets.$.coinBalance": USDCommissionToBePaid,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        }
        // Update the USD payout values in Affiliate table
        let updateAffiliate = await affilateService.updatePart(
          {
            Email: email,
          },
          {
            $set: {
              "totalCommissionToBePaid.amountInUSD":
                affiliateUser.totalCommissionToBePaid.amountInUSD -
                USDCommissionToBePaid,
            },
            $push: {
              payouts: {
                amount: USDCommissionToBePaid,
                date: new Date(), // Current date
                payoutType: "Captain Bee's USD Commission Payout",
                method: "USD",
                status: "Paid",
                notes: req.body.notes ? req.body.notes : "Commission payout",
              },
            },
          }
        );
        //Send email informing the commission payout
        let payoutDetails = {
          amount: USDCommissionToBePaid,
          date: new Date(), // Current date
          payoutType: "Captain Bee's USD Commission Payout",
          method: "USD",
          status: "Paid",
          notes: req.body.notes ? req.body.notes : "Commission payout",
        };
        await new SendEmail().sendCommissionPayoutEmail(
          user?.email,
          payoutDetails
        );
        let updatedUser = await affilateService.findOne({
          Email: email,
        });
        return { status: 200, data: updatedUser };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async honeyBeeUSDCommissionPayout(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      let affiliateUser = await affilateService.findOne({
        Email: email,
      });
      if (user && affiliateUser) {
        let USDCommissionToBePaid = Number(req.body.usdAmount);

        if (await orderService.checkAndCreateUserWallet(user.email, "USD")) {
          //Update the USD wallet
          let updateUserWallet = await uservice.updatePart(
            {
              email: email,
              "userWallets.coinSymbol": "USD",
            },
            {
              $inc: {
                "userWallets.$.coinBalance": USDCommissionToBePaid,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        }
        // Update the USD payout values in Affiliate table
        let updateAffiliate = await affilateService.updatePart(
          {
            Email: email,
          },
          {
            $set: {
              "totalHoneyBeeCommissionToBePaid.amountInUSD":
                affiliateUser.totalHoneyBeeCommissionToBePaid.amountInUSD -
                USDCommissionToBePaid,
            },
            $push: {
              payouts: {
                amount: USDCommissionToBePaid,
                date: new Date(), // Current date
                payoutType: "Honey Bee's USD Commission Payout",
                method: "USD",
                status: "Paid",
                notes: req.body.notes ? req.body.notes : "Commission payout",
              },
            },
          }
        );
        //Send email informing the commission payout
        let payoutDetails = {
          amount: USDCommissionToBePaid,
          date: new Date(), // Current date
          payoutType: "Honey Bee's USD Commission Payout",
          method: "USD",
          status: "Paid",
          notes: req.body.notes ? req.body.notes : "Commission payout",
        };
        await new SendEmail().sendCommissionPayoutEmail(
          user?.email,
          payoutDetails
        );
        let updatedUser = await affilateService.findOne({
          Email: email,
        });
        return { status: 200, data: updatedUser };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserCount(req: any, res: any) {
    try {
      let users = await uservice.findCount({});
      if (users) {
        return { status: 200, data: users };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUsersLite01(req: any, res: any) {
    try {
      let usersResults = [];
      let users = await uservice.findSelect(
        {},
        {
          _id: 1,
          email: 1,
          lastLogin: 1,
          verification: 1,
        }
      );
      for (let i = 0; i < users.length; i++) {
        let user = users[i];
        let getUserOrders = await orderService.find({
          "user.userId": user._id,
        });
        let getRewards = await rewardService.findOne({
          userId: user._id,
        });

        let userRewards =
          getRewards?.totalRewards === undefined ||
            getRewards?.totalRewards === null
            ? 0
            : getRewards.totalRewards;
        let userResult = {
          _id: user._id,
          email: user.email,
          lastLogin: user?.lastLogin,
          emailVerified: user.verification?.emailVerified,
          phoneVerified: user.verification?.phoneVerified,
          totalOrders: getUserOrders.length,
          totalRewards: userRewards,
          createdDate: user._id.getTimestamp(),
        };
        usersResults.push(userResult);
      }
      if (users) {
        return { status: 200, data: usersResults };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async getUsersLite(req: any, res: any) {
    try {
      const users = await uservice.findSelect(
        {},
        {
          _id: 1,
          email: 1,
          lastLogin: 1,
          verification: 1,
          referralCode: 1,
          profilePic: 1,
        }
      );

      const userResultsPromises = users.map(async (user) => {
        const [getUserOrders, getRewards] = await Promise.all([
          orderService.find({ "user.userId": user._id }),
          rewardService.findOne({ userId: user._id }),
        ]);

        const userRewards = getRewards?.totalRewards ?? 0;
        return {
          _id: user._id,
          email: user.email,
          referralCode: user?.referralCode,
          profilePic: user?.profilePic,
          lastLogin: user?.lastLogin,
          emailVerified: user.verification?.emailVerified,
          phoneVerified: user.verification?.phoneVerified,
          totalOrders: getUserOrders.length,
          totalRewards: userRewards,
          createdDate: user._id.getTimestamp(),
        };
      });

      const usersResults = await Promise.all(userResultsPromises);

      if (users && users.length > 0) {
        return { status: 200, data: usersResults };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err: any) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async getHiveUsersLite(req: any, res: any) {
    try {
      const users = await uservice.findSelect(
        {},
        {
          _id: 1,
          email: 1,
          lastLogin: 1,
          verification: 1,
          referralCode: 1,
          profilePic: 1,
        }
      );

      const affilaiteUsers = await affilateService.findSelect(
        {},
        {
          Email: 1,
          firstname: 1,
          lastname: 1,
          photoIdFileurl: 1,
          accname: 1,
          Username: 1,
        }
      );

      // Create a map of affiliate user data keyed by email
      const affiliateUserData = new Map(
        affilaiteUsers.map((au) => [au.Email, au])
      );

      // Filter the users array to include only those in the affiliate user data
      const filteredUsers = users.filter((user) =>
        affiliateUserData.has(user.email)
      );

      const userResultsPromises = filteredUsers.map(async (user) => {
        const [getUserOrders, getRewards] = await Promise.all([
          orderService.find({ "user.userId": user._id }),
          rewardService.findOne({ userId: user._id }),
        ]);

        const userRewards = getRewards?.totalRewards ?? 0;

        // Retrieve affiliate user details
        const affiliateUserDetails = affiliateUserData.get(user.email);
        return {
          _id: user._id,
          email: user.email,
          referralCode: user?.referralCode,
          profilePic: affiliateUserDetails?.photoIdFileurl ?? user?.profilePic,
          firstname: affiliateUserDetails?.firstname,
          lastname: affiliateUserDetails?.lastname,
          Username: affiliateUserDetails?.Username,
          accname:
            affiliateUserDetails?.accname &&
              affiliateUserDetails.accname.trim() !== ""
              ? affiliateUserDetails.accname
              : affiliateUserDetails?.firstname,
          lastLogin: user?.lastLogin,
          emailVerified: user.verification?.emailVerified,
          phoneVerified: user.verification?.phoneVerified,
          totalOrders: getUserOrders.length,
          totalRewards: userRewards,
          createdDate: user._id.getTimestamp(),
        };
      });

      const usersResults = await Promise.all(userResultsPromises);

      if (users && users.length > 0) {
        return { status: 200, data: usersResults };
      } else {
        const message = "No Users";
        return { status: 500, data: message };
      }
    } catch (err: any) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async getUserOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let orders = await orderService.find({ "user.email": email });
        return { status: 200, data: orders };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserCompletedOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let orders = await orderService.find({
          "user.email": email,
          status: "Completed",
        });
        return { status: 200, data: orders };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserOrder(req: any, res: any) {
    try {
      let { email, orderId } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let order = await orderService.findOne({
          "user.email": email,
          orderId: orderId,
        });
        return { status: 200, data: order };
      } else {
        const message = "No order found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }



  async getUserMiningSubscriptionOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let order = await orderService.find({
          "user.email": email,
          orderType: "MiningSubscriptionOrder",
        });
        return { status: 200, data: order };
      } else {
        const message = "No order found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }
  async getUserRewardDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let rewards = await rewardService.findOne({ email: email });
        return { status: 200, data: rewards };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getDEXUserRewardDetails(req: any, res: any) {
    try {
      let { userWalletAddr } = req.params;

      let user = await uservice.findOneSelect(
        { walletAddress: userWalletAddr },
        this.userLiteFields
      );
      if (user) {
        let rewards = await rewardService.findOne({
          rewardTokenAddress: userWalletAddr,
        });
        return { status: 200, data: rewards };
      } else {
        const message = "user Wallet address not found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addPhone(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (user) {
        let updateUser = await uservice.updatePart(
          { _id: user._id, email: user.email },
          {
            $set: {
              phone: req.body.phone,
              "verification.phoneVerified": false,
              "verification.phoneVerifiedOn": null,
              "verficication.phoneCode": 123456,
            },
          }
        );
        if (updateUser) {
          const message = "phoneAdded";
          return { status: 200, data: message };
        } else {
          const message = "errorWhileAddingPhone";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (error) {
      return { status: 500, data: error };
    }
  }

  async verifyPhone(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      if (user) {
        if (user.verification.phoneVerified == true) {
          const message = "phoneAlreadyVerified";
          return { status: 200, data: message };
        } else {
          if (user.verification.phoneCode == req.emailCode) {
            user.verification.emailVerified = true;
            let updateUser = await uservice.updatePart(
              { _id: user._id, email: user.email },
              {
                $set: {
                  "verification.phoneVerified": true,
                  "verification.phoneVerifiedOn": new Date(),
                },
              }
            );
            if (updateUser) {
              const message = "phoneVerified";
              return { status: 200, data: message };
            } else {
              const message = "errorWhileVerifyingPhone";
              return { status: 500, data: message };
            }
          } else {
            const message = "invalidPhoneCode";
            return { status: 500, data: message };
          }
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserWallets0(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        let myArray = user.userWallets;
        for (var i = 0; i < myArray.length; i++) {
          myArray[i].coinPrivateKey = "";
          let res = await this.getPriceByNameForWallet(
            myArray[i]?.coinSymbol,
            "Buy",
            myArray[i]?.coinSymbol === "BTCY" ? myArray[i]?.coinNetwork : ""
          );
          let price = Number(res.data);
          myArray[i].coinPrice = price;
        }
        return { status: 200, data: myArray };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserWallets00(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      const user = await uservice.findOneSelect({ email: email }, {});

      if (!user) {
        return { status: 404, message: "User not found" };
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const endDate = new Date("2024-07-05"); // End date for the first date range
      const today = new Date(); // Today's date for the second date range

      let transactions = await transactionService.find({ email: email });

      const walletsWithPrices = await Promise.all(
        user.userWallets.map(async (wallet) => {
          wallet.coinPrivateKey = ""; // Removing sensitive data
          const priceResponse = await this.getPriceByNameForWallet(
            wallet.coinSymbol,
            "Buy",
            wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
          );
          wallet.coinPrice = Number(priceResponse.data);
          wallet.coinPrevPrice = 0;
          console.log("Before", wallet.coinSymbol, wallet.coinBalance);
          if (wallet.coinBalance > 0 && wallet.coinSymbol !== "USD") {
            let prevPriceData = await getPrevDayPriceByName(wallet.coinSymbol, wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : "");
            console.log("prevPriceData", prevPriceData, wallet.coinSymbol);
            wallet.coinPrevPrice = Number(prevPriceData.data);
          }
          if (
            wallet.coinSymbol === "WIBS" &&
            (wallet.coinBalance > 0 || wallet.coinStakedBalance > 0)
          ) {
            // Check for WIBS-related orders and transactions within the last month
            const orders = await orderService.find({
              created: { $gte: oneMonthAgo, $lte: today },
              "user.email": email,
              "breakdown.outCurrencyName": "WIBS",
              status: "Completed",
            });

            const transactions = await txService.find({
              txDate: { $gte: oneMonthAgo, $lte: today },
              currencyRef: "WIBS",
              email: email,
              transactionType: {
                $in: ["SALARY_COINS", "GIFT_COINS", "PURCHASED_COINS"],
              },
              status: "Completed",
            });

            // Adding notes based on the date ranges
            let notes = "";
            const ordersInFirstPeriod = orders.filter(
              (order) => new Date(order.created) <= endDate
            );
            const transactionsInFirstPeriod = transactions.filter(
              (tx) => new Date(tx.txDate) <= endDate
            );
            const ordersInSecondPeriod = orders.filter(
              (order) => new Date(order.created) > endDate
            );
            const transactionsInSecondPeriod = transactions.filter(
              (tx) => new Date(tx.txDate) > endDate
            );

            if (
              ordersInFirstPeriod.length > 0 ||
              transactionsInFirstPeriod.length > 0
            ) {
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 9 bonus coins.";
            }

            if (
              ordersInSecondPeriod.length > 0 ||
              transactionsInSecondPeriod.length > 0
            ) {
              if (notes) notes += " ";
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 7 bonus coins.";
            }

            if (notes) {
              wallet.notes = notes;
            }
          }

          // Check if there's a transaction with a matching currencyRef and notes that meet criteria
          const specialNotesTransaction = transactions.find(
            (tx) =>
              tx.currencyRef === wallet.coinSymbol &&
              tx.notes &&
              (tx.notes.startsWith("Smart Crypto Surge") ||
                tx.notes.startsWith("Smart Crypto Ripple") ||
                tx.notes.startsWith("Smart Crypto Wave") ||
                tx.notes.startsWith("Smart Crypto Monthly"))
          );

          //console.log("specialNotesTransaction", specialNotesTransaction);
          // Attach special notes if matching transaction found
          if (specialNotesTransaction) {
            wallet.specialNotes = String(specialNotesTransaction.notes);
            console.log("specialNotesTransaction wallet", wallet.specialNotes);
          }

          return wallet;
        })
      );

      return { status: 200, data: walletsWithPrices };
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async genericWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      if (
        email !== "dpar4fam@hotmail.com" &&
        email !== "fowlertrucking14@yahoo.com" &&
        email !== "dlcpmoralez@gmail.com" &&
        email !== "paul@diversifiedlandscape.com" &&
        email !== "kmonge10@yahoo.com" &&
        email !== "martinmonge@verizon.net" &&
        email !== "brownst81@yahoo.com" &&
        email !== "bmoralez12@gmail.com" &&
        email !== "malan.vicki@gmail.com" &&
        email !== "chrishumpherys@yahoo.com" &&
        email !== "fatham.llc@gmail.com" &&
        email !== "ssjriver@icloud.com" &&
        email !== "lmmecham@yahoo.com" &&
        email !== "agent@wyomingagents.com" &&
        email !== "anzojessica73@gmail.com" &&
        email !== "jflip.nst8@yahoo.com" &&
        email !== "cielinoinc@gmail.com" &&
        email !== "kathy.oglesbee@yahoo.com" &&
        email !== "pearlsblingsnthings@gmail.com" &&
        email !== "sunkuomkarsai12121@gmail.com" &&
        email !== "judybriggs1@gmail.com" &&
        email !== "bz@azooca.com" &&
        email !== "lololeveck@gmail.com" &&
        email !== "lino.gomez1@gmail.com" &&
        email !== "sj.brown@yahoo.com"
      ) {
        let result = await this.getUserWallets012(req, res);
        return { status: result.status, data: result.data };
      } else {
        console.log("kmonge10@yahoo.com", "else");
        let result2 = await this.getUserWallets(req, res);
        return { status: result2.status, data: result2.data };
      }
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async genericDemoWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      if (
        email !== "dpar4fam@hotmail.com" &&
        email !== "fowlertrucking14@yahoo.com" &&
        email !== "dlcpmoralez@gmail.com" &&
        email !== "paul@diversifiedlandscape.com" &&
        email !== "kmonge10@yahoo.com" &&
        email !== "martinmonge@verizon.net" &&
        email !== "brownst81@yahoo.com" &&
        email !== "bmoralez12@gmail.com" &&
        email !== "malan.vicki@gmail.com" &&
        email !== "chrishumpherys@yahoo.com" &&
        email !== "fatham.llc@gmail.com" &&
        email !== "lmmecham@yahoo.com" &&
        email !== "agent@wyomingagents.com" &&
        email !== "anzojessica73@gmail.com" &&
        email !== "cielinoinc@gmail.com" &&
        email !== "kathy.oglesbee@yahoo.com" &&
        email !== "pearlsblingsnthings@gmail.com" &&
        email !== "sunkuomkarsai12121@gmail.com" &&
        email !== "judybriggs1@gmail.com" &&
        email !== "bz@azooca.com" &&
        email !== "lololeveck@gmail.com" &&
        email !== "lino.gomez1@gmail.com" &&
        email !== "sj.brown@yahoo.com"
      ) {
        let result = await this.getUserDemoWallets012(req, res);
        return { status: result.status, data: result.data };
      } else {
        console.log("kmonge10@yahoo.com", "else");
        let result2 = await this.getUserDemoWallets(req, res);
        return { status: result2.status, data: result2.data };
      }
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async getUserWallets012(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      const user = await uservice.findOneSelect({ email: email }, {});

      if (!user) {
        return { status: 404, message: "User not found" };
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const endDate = new Date("2024-07-05"); // End date for the first date range
      const today = new Date(); // Today's date for the second date range

      const transactions = await transactionService.find({
        email: email,
        status: "Completed",
      });

      const walletsWithPrices = await Promise.all(
        user.userWallets.map(async (wallet) => {
          wallet.coinPrivateKey = ""; // Removing sensitive data
          const priceResponse = await this.getPriceByNameForWallet(
            wallet.coinSymbol,
            "Buy",
            wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
          );
          wallet.coinPrice = Number(priceResponse.data);
          wallet.coinPrevPrice = 0;

          if (
            (wallet.coinBalance > 0 || wallet.coinStakedBalance > 0) &&
            wallet.coinSymbol !== "USD"
            //&& wallet.coinSymbol !== "WIBS"
          ) {
            let prevPriceData = await getPrevDayPriceByName(wallet.coinSymbol, wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : "");
            wallet.coinPrevPrice = Number(prevPriceData.data);
          }

          /*
          if (
            wallet.coinSymbol === "WIBS" &&
            (wallet.coinBalance > 0 || wallet.coinStakedBalance > 0)
          ) {
            const orders = await orderService.find({
              created: { $gte: oneMonthAgo, $lte: today },
              "user.email": email,
              "breakdown.outCurrencyName": "WIBS",
            });

            const wibsTransactions = await txService.find({
              txDate: { $gte: oneMonthAgo, $lte: today },
              currencyRef: "WIBS",
              email: email,
              transactionType: {
                $in: ["SALARY_COINS", "GIFT_COINS", "PURCHASED_COINS"],
              },
            });

            let notes = "";
            const ordersInFirstPeriod = orders.filter(
              (order) => new Date(order.created) <= endDate
            );
            const transactionsInFirstPeriod = wibsTransactions.filter(
              (tx) => new Date(tx.txDate) <= endDate
            );
            const ordersInSecondPeriod = orders.filter(
              (order) => new Date(order.created) > endDate
            );
            const transactionsInSecondPeriod = wibsTransactions.filter(
              (tx) => new Date(tx.txDate) > endDate
            );

            if (
              ordersInFirstPeriod.length > 0 ||
              transactionsInFirstPeriod.length > 0
            ) {
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 9 bonus coins.";
            }

            if (
              ordersInSecondPeriod.length > 0 ||
              transactionsInSecondPeriod.length > 0
            ) {
              if (notes) notes += " ";
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 7 bonus coins.";
            }

            if (notes) {
              wallet.notes = notes;
            }
          }*/

          // Check for transactions that match wallet.coinSymbol and contain specific notes
          const specialNotesTransaction = transactions.find(
            (tx) =>
              tx.currencyRef === wallet.coinSymbol &&
              tx.notes &&
              (
                tx.notes.startsWith("xBBitcoin Bull-Run-2026") ||
                tx.notes.startsWith("Smart Crypto Surge") ||
                tx.notes.startsWith("Smart Crypto Ripple") ||
                tx.notes.startsWith("Smart Crypto Wave") ||
                tx.notes.startsWith("Smart Crypto Monthly") ||
                tx.notes.startsWith("xBitcoin Blooming") ||
                tx.notes.startsWith("xBitcoin Rush") ||
                tx.notes.startsWith("xBitcoin Bitcoin") ||
                tx.notes.startsWith("xBBitcoin Bitcoin2") ||
                tx.notes.startsWith("xBBitcoin Bull-Run-2") ||
                tx.notes.startsWith("xBBitcoin Bull-Run-3") ||
                tx.notes.startsWith("xBBBitcoin Bull-Run-2025") ||
                tx.notes.startsWith("xBBitcoin Federal Reserve") ||
                tx.notes.startsWith("Bull-Run- 2/Jul 2025-Chris 0 Package-Omkar") ||
                tx.notes.startsWith("xBitcoin Bull-Run"))
          );
          wallet.amountInvested = 0;
          // Attach special notes if a matching transaction is found
          if (specialNotesTransaction) {
            //console.log(specialNotesTransaction, "specialNotesTransaction");
            wallet.notes = String(specialNotesTransaction.notes);
            wallet.amountInvested = specialNotesTransaction.amountInvested;
          }

          return wallet;
        })
      );

      //      console.log("walletsWithPrices", walletsWithPrices);
      return { status: 200, data: walletsWithPrices };
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async getUserWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      // Fetch the user based on email
      const user = await uservice.findOneSelect({ email }, {}); // Use .lean() to ensure plain objects

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Fetch transactions for the user
      const transactions = await transactionService.find({
        email: email,
        transactionType: {
          $ne: "WITHDRAW_FIAT"
        },
        status: "Completed",
      });

      const groupedTransactions: {
        [key: string]: {
          [key: string]: {
            totalAmount: number;
            totalInvested: number;
            details: any[];
            notes: string;
          };
        };
      } = {};

      // Group transactions by currencyRef and note
      transactions.forEach((tx: any) => {
        const currencyRef = tx.currencyRef.toString();
        const note = tx.notes?.toString() || "Default";

        if (!groupedTransactions[currencyRef]) {
          groupedTransactions[currencyRef] = {};
        }
        if (!groupedTransactions[currencyRef][note]) {
          groupedTransactions[currencyRef][note] = {
            totalAmount: 0,
            totalInvested: 0,
            notes: "",
            details: [],
          };
        }

        groupedTransactions[currencyRef][note].totalAmount += tx.amount;
        groupedTransactions[currencyRef][note].totalInvested +=
          tx.amountInvested;
        groupedTransactions[currencyRef][note].notes += tx.notes;
        groupedTransactions[currencyRef][note].details.push(tx);
      });

      const walletsWithDetails: any[] = [];

      // Process each user wallet
      for (const wallet of user.userWallets) {
        wallet.coinPrivateKey = ""; // Remove private key for security purposes

        // Fetch current price
        const priceResponse = (await this.getPriceByNameForWallet(
          wallet.coinSymbol,
          "Buy",
          wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
        )) as { data: number };

        // Fetch previous day's price if applicable
        const prevPriceData =
          wallet.coinBalance > 0 && wallet.coinSymbol !== "USD"
            ? ((await getPrevDayPriceByName(wallet.coinSymbol, wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
            )) as {
              data: number;
            })
            : { data: 0 };

        // Update wallet with current and previous prices
        wallet.coinPrice = Number(priceResponse.data); // Ensure safe access
        wallet.coinPrevPrice = Number(prevPriceData.data); // Ensure safe access

        // Make a copy of the wallet (if not using Mongoose .lean() or .toObject())
        const walletCopy = JSON.parse(JSON.stringify(wallet));

        // Add transaction details to wallets if there are any matching transactions
        if (groupedTransactions[wallet.coinSymbol]) {
          for (const [note, data] of Object.entries(
            groupedTransactions[wallet.coinSymbol]
          )) {
            const newWallet = { ...walletCopy }; // Copy the wallet without Mongoose metadata
            newWallet.coinBalance =
              wallet.coinSymbol === "WIBS" ||
                wallet.coinSymbol === "INEX" ||
                wallet.coinSymbol === "IN500" ||
                wallet.coinSymbol === "INXC" ||
                wallet.coinSymbol === "Dacrazy" ||
                wallet.coinSymbol === "DaCrazy" ||
                wallet.coinSymbol === "IUSD+" ||
                wallet.coinSymbol === "daCrazy"
                ? 0
                : data.totalAmount;
            newWallet.notes = data.notes;
            newWallet.amountInvested = data.totalInvested;
            walletsWithDetails.push(newWallet);
          }
        } else {
          walletCopy.amountInvested = 0;
          walletsWithDetails.push(walletCopy); // Add wallet if no transactions found
        }
      }

      return { status: 200, data: walletsWithDetails };
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async getUserDemoWallets012(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      const user = await uservice.findOneSelect({ email: email }, {});

      if (!user) {
        return { status: 404, message: "User not found" };
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const endDate = new Date("2024-07-05"); // End date for the first date range
      const today = new Date(); // Today's date for the second date range

      const transactions = await transactionService.find({
        email: email,
        status: "Completed",
      });

      const walletsWithPrices = await Promise.all(
        user.freeTrailUserWallets.map(async (wallet) => {
          wallet.coinPrivateKey = ""; // Removing sensitive data
          const priceResponse = await this.getPriceByNameForWallet(
            wallet.coinSymbol,
            "Buy",
            wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
          );
          wallet.coinPrice = Number(priceResponse.data);
          wallet.coinPrevPrice = 0;

          if (
            (wallet.coinBalance > 0 || wallet.coinStakedBalance > 0) &&
            wallet.coinSymbol !== "USD" &&
            wallet.coinSymbol !== "WIBS"
          ) {
            let prevPriceData = await getPrevDayPriceByName(wallet.coinSymbol, wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : "");
            wallet.coinPrevPrice = Number(prevPriceData.data);
          }

          /*
          if (
            wallet.coinSymbol === "WIBS" &&
            (wallet.coinBalance > 0 || wallet.coinStakedBalance > 0)
          ) {
            const orders = await orderService.find({
              created: { $gte: oneMonthAgo, $lte: today },
              "user.email": email,
              "breakdown.outCurrencyName": "WIBS",
            });

            const wibsTransactions = await txService.find({
              txDate: { $gte: oneMonthAgo, $lte: today },
              currencyRef: "WIBS",
              email: email,
              transactionType: {
                $in: ["SALARY_COINS", "GIFT_COINS", "PURCHASED_COINS"],
              },
            });

            let notes = "";
            const ordersInFirstPeriod = orders.filter(
              (order) => new Date(order.created) <= endDate
            );
            const transactionsInFirstPeriod = wibsTransactions.filter(
              (tx) => new Date(tx.txDate) <= endDate
            );
            const ordersInSecondPeriod = orders.filter(
              (order) => new Date(order.created) > endDate
            );
            const transactionsInSecondPeriod = wibsTransactions.filter(
              (tx) => new Date(tx.txDate) > endDate
            );

            if (
              ordersInFirstPeriod.length > 0 ||
              transactionsInFirstPeriod.length > 0
            ) {
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 9 bonus coins.";
            }

            if (
              ordersInSecondPeriod.length > 0 ||
              transactionsInSecondPeriod.length > 0
            ) {
              if (notes) notes += " ";
              notes +=
                "You have WIBS coins! These were purchased during a special offer: Buy 1 WIBS coin, receive 7 bonus coins.";
            }

            if (notes) {
              wallet.notes = notes;
            }
          }*/

          // Check for transactions that match wallet.coinSymbol and contain specific notes
          const specialNotesTransaction = transactions.find(
            (tx) =>
              tx.currencyRef === wallet.coinSymbol &&
              tx.notes &&
              (tx.notes.startsWith("Smart Crypto Surge") ||
                tx.notes.startsWith("Smart Crypto Ripple") ||
                tx.notes.startsWith("Smart Crypto Wave") ||
                tx.notes.startsWith("Smart Crypto Monthly") ||
                tx.notes.startsWith("xBitcoin Blooming") ||
                tx.notes.startsWith("xBitcoin Rush") ||
                tx.notes.startsWith("xBitcoin Bitcoin") ||
                tx.notes.startsWith("xBBitcoin Bitcoin2") ||
                tx.notes.startsWith("xBBitcoin Bull-Run-2") ||
                tx.notes.startsWith("xBBitcoin Bull-Run-3") ||
                tx.notes.startsWith("xBBBitcoin Bull-Run-2025") ||
                tx.notes.startsWith("xBBitcoin Federal Reserve") ||
                tx.notes.startsWith("Bull-Run- 2/Jul 2025-Chris") ||
                tx.notes.startsWith("xBitcoin Bull-Run"))
          );
          wallet.amountInvested = 0;
          // Attach special notes if a matching transaction is found
          if (specialNotesTransaction) {
            //console.log(specialNotesTransaction, "specialNotesTransaction");
            wallet.notes = String(specialNotesTransaction.notes);
            wallet.amountInvested = specialNotesTransaction.amountInvested;
          }

          return wallet;
        })
      );

      //      console.log("walletsWithPrices", walletsWithPrices);
      return { status: 200, data: walletsWithPrices };
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  async getUserDemoWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      // Fetch the user based on email
      const user = await uservice.findOneSelect({ email }, {}); // Use .lean() to ensure plain objects

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Fetch transactions for the user
      const transactions = await transactionService.find({ email });

      const groupedTransactions: {
        [key: string]: {
          [key: string]: {
            totalAmount: number;
            totalInvested: number;
            details: any[];
            notes: string;
          };
        };
      } = {};

      // Group transactions by currencyRef and note
      transactions.forEach((tx: any) => {
        const currencyRef = tx.currencyRef.toString();
        const note = tx.notes?.toString() || "Default";

        if (!groupedTransactions[currencyRef]) {
          groupedTransactions[currencyRef] = {};
        }
        if (!groupedTransactions[currencyRef][note]) {
          groupedTransactions[currencyRef][note] = {
            totalAmount: 0,
            totalInvested: 0,
            notes: "",
            details: [],
          };
        }

        groupedTransactions[currencyRef][note].totalAmount += tx.amount;
        groupedTransactions[currencyRef][note].totalInvested +=
          tx.amountInvested;
        groupedTransactions[currencyRef][note].notes += tx.notes;
        groupedTransactions[currencyRef][note].details.push(tx);
      });

      const walletsWithDetails: any[] = [];

      // Process each user wallet
      for (const wallet of user.freeTrailUserWallets) {
        wallet.coinPrivateKey = ""; // Remove private key for security purposes

        // Fetch current price
        const priceResponse = (await this.getPriceByNameForWallet(
          wallet.coinSymbol,
          "Buy",
          wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : ""
        )) as { data: number };

        // Fetch previous day's price if applicable
        const prevPriceData =
          wallet.coinBalance > 0 && wallet.coinSymbol !== "USD"
            ? ((await getPrevDayPriceByName(wallet.coinSymbol, wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : "")) as {
              data: number;
            })
            : { data: 0 };

        // Update wallet with current and previous prices
        wallet.coinPrice = Number(priceResponse.data); // Ensure safe access
        wallet.coinPrevPrice = Number(prevPriceData.data); // Ensure safe access

        // Make a copy of the wallet (if not using Mongoose .lean() or .toObject())
        const walletCopy = JSON.parse(JSON.stringify(wallet));

        // Add transaction details to wallets if there are any matching transactions
        if (groupedTransactions[wallet.coinSymbol]) {
          for (const [note, data] of Object.entries(
            groupedTransactions[wallet.coinSymbol]
          )) {
            const newWallet = { ...walletCopy }; // Copy the wallet without Mongoose metadata
            newWallet.coinBalance =
              wallet.coinSymbol === "WIBS" ||
                wallet.coinSymbol === "INEX" ||
                wallet.coinSymbol === "IN500" ||
                wallet.coinSymbol === "INXC" ||
                wallet.coinSymbol === "Dacrazy" ||
                wallet.coinSymbol === "DaCrazy" ||
                wallet.coinSymbol === "IUSD+" ||
                wallet.coinSymbol === "daCrazy"
                ? 0
                : data.totalAmount;
            newWallet.notes = data.notes;
            newWallet.amountInvested = data.totalInvested;
            walletsWithDetails.push(newWallet);
          }
        } else {
          walletCopy.amountInvested = 0;
          walletsWithDetails.push(walletCopy); // Add wallet if no transactions found
        }
      }

      return { status: 200, data: walletsWithDetails };
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }

  // GET /api/v1/user/privacy-settings/:email
  async getPrivacySettings(req: any, res: any) {
    try {
      const email = req.params.email.toLowerCase();
      const user = await uservice.findOneSelect({ email }, { UserPrivacyBTCYAppSettings: 1 });

      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      return {
        status: 200,
        success: true,
        data: user.UserPrivacyBTCYAppSettings || {
          hideRealName: false,
          hideBalance: false,
          pushNotifications: true,
        }
      }
    } catch (err: any) {
      return { status: 500, message: err.message };
    }
  }


  async calculateTotalInvestment(req: any, res: any) {
    try {
      let { email } = req.params;

      // Fetch all user wallets
      const user = await uservice.findOneSelect({ email }, { userWallets: 1 });
      const userWallets = user.userWallets || [];

      // Fetch all transactions for the user
      const allTxs = await txService.find({
        email: email,
        transactionType: {
          $in: ["INVESTMENT", "PURCHASED_COINS"],
        },
        status: "Completed",
      });

      // Fetch all orders for the user
      const allOrders = await orderService.find({
        "user.email": email,
        orderType: ["Buy", "Convert"],
        status: "Completed",
      });

      //Fetch all staked balance for the user
      const allStaked = await stakingService.find({
        email: email,
        isActive: true,
      });
      // Helper function to find the corresponding wallet and ensure the coinBalance is available and skip staked balance
      const isWalletValid = (coinSymbol: string) => {
        const wallet = userWallets.find(
          (wallet: UserWallet) => wallet.coinSymbol === coinSymbol
        );
        // Ensure only non-zero available coinBalance is considered (excluding coinStakedBalance)
        return (
          wallet &&
          wallet.coinBalance > 0 &&
          (wallet.coinStakedBalance ?? 0) === 0
        );
      };

      // Sum up the 'amountInvested' from transactions, treating null/undefined as 0, and skip if the coinBalance is zero or staked
      const totalTransactionInvestment = allTxs.reduce((acc, tx) => {
        const coinSymbol = String(tx?.currencyRef); // Assuming 'currencyRef' contains the coin symbol in transactions
        if (!coinSymbol || !isWalletValid(coinSymbol)) return acc; // Skip if coinSymbol is not available or wallet is invalid
        console.log("tx?.amountInvested", tx?.amountInvested);
        return acc + (tx?.amountInvested || 0);
      }, 0);

      console.log("allOrders", allOrders);
      let totalOrderInvestment = 0;
      if (email !== "kathy.oglesbee@yahoo.com") {
        // Sum up the 'breakdown.inAmount' from orders, treating null/undefined as 0, and skip if the coinBalance is zero or staked
        totalOrderInvestment = allOrders.reduce((acc, order) => {
          const coinSymbol = order?.breakdown?.outCurrencyName; // Assuming breakdown contains the coin symbol in orders
          if (!coinSymbol || !isWalletValid(coinSymbol)) return acc; // Skip if coinSymbol is not available or wallet is invalid

          return acc + (order.breakdown?.inAmount || 0);
        }, 0);
      }

      let totalStakedValue = await allStaked.reduce(
        async (accPromise, stake) => {
          const acc = await accPromise; // wait for the accumulated value
          const stakedCoin = stake.coin;

          try {
            const priceResponse = await getPriceByName(String(stakedCoin));
            let price =
              stakedCoin === "INEX"
                ? 2 // considered the investments are at $2 per INEX
                : priceResponse
                  ? priceResponse.data
                  : 0;
            return acc + (stake?.stakedAmount * price || 0);
          } catch (error) {
            console.error(`Error fetching price for ${stakedCoin}`, error);
            return acc; // Return the current accumulator value in case of error
          }
        },
        Promise.resolve(0)
      ); // Initialize the accumulator with a resolved promise

      console.log("totalTransactionInvestment", totalTransactionInvestment);
      console.log("totalOrderInvestment", totalOrderInvestment);
      console.log("totalStakedValue", totalStakedValue);

      if (email === "cielinoinc@gmail.com") {
        totalStakedValue = 10000;
      } else if (email === "daniel.estrada1991@yahoo.com") {
        totalStakedValue = 76;
      } else if (email === "rey.barthelemy@gmail.com") {
        totalStakedValue = 10000;
      } else if (email === "wwrv@verizon.net") {
        totalStakedValue = 0;
      } else if (email === "martinmonge@verizon.net") {
        totalStakedValue = 0;
      } else if (email === "joel@gearboxsports.com") {
        totalStakedValue = 0;
      } else if (email === "jestebanp@icloud.com") {
        totalStakedValue = 0;
      } else if (email === "jflip.nst8@yahoo.com") {
        totalStakedValue = 7500;
      } else if (email === "kariej.smith@yahoo.com") {
        totalStakedValue = 300000;
      } else if (email === "s.clair@icloud.com") {
        totalStakedValue = 20000;
      } else if (email === "e.clairdumont@icloud.com") {
        totalStakedValue = 20000;
      }

      // if(email === "cielinoinc@gmail.com") {
      //   totalOrderInvestment += 4000;
      // }
      // Total investment
      let totalInvestment =
        totalTransactionInvestment + totalOrderInvestment + totalStakedValue;

      if (email === "banks144@yahoo.com") {
        totalInvestment = 24000;
      } else if (email === "jinelliott2013@yahoo.com") {
        totalInvestment = 4500;
      } else if (email === "lino.gomez1@gmail.com") {
        totalInvestment = 9000;
      } else if (
        email === "donpanchos4me@gmail.com"
      ) {
        totalInvestment = 40000;
      } else if (
        email === "donpanchos4mr@gmail.com"
      ) {
        totalInvestment = 20000;
      }
      else if (email === "sj.brown@yahoo.com") {
        totalInvestment = 5000;
      } else if (email === "cielinoinc@gmail.com") {
        totalInvestment = 21000;
      } else if (email === "kathy.oglesbee@yahoo.com") {
        totalInvestment = 19000;
      } else if (email === "dave@cdgmaterials.com") {
        totalInvestment = 15000;
      } else if (email === "espo66@hotmail.com") {
        totalInvestment = 5000;
      } else if (email === "fowlertrucking14@yahoo.com") {
        totalInvestment = 21000;
      } else if (email === "jinelliott2013@yahoo.com") {
        totalInvestment = 2000;
      } else if (email === "taylorfowler@icloud.com") {
        totalInvestment = 10000;
      } else if (email === "b62721209@gmail.com") {
        totalInvestment = 2000 + 3600;
      } else if (email === "dbrevolution11@gmail.com") {
        totalInvestment = 2500;
      } else if (email === "guittarslinger@gmail.com") {
        totalInvestment = 0;
      } else if (email === "k.anderson0828@yahoo.com") {
        totalInvestment = 0;
      } else if (email === "brownst81@yahoo.com") {
        totalInvestment = 15000;
      } else if (email === "kariej.smith@yahoo.com") {
        totalInvestment = 300000;
      } else if (email === "ssjriver@icloud.com") {
        totalInvestment = 5000 + 2138;
      } else if (email === "trujillolouis@icloud.com") {
        totalInvestment = 4500;
      }
      else if (email === 'riptidegal@gmail.com') {
        totalInvestment = 0;
      } else if (email == 'fatham.llc@gmail.com') {
        totalInvestment = 251500;
      } else if (email == "imnotblp@gmail.com") {
        totalInvestment = 5000;
      }

      console.log("totalInvestment", totalInvestment);

      return { status: 200, data: totalInvestment };
    } catch (error) {
      console.error("Error calculating total investment:", error);
      throw error;
    }
  }

  async calculateDemoTotalInvestment(req: any, res: any) {
    try {
      let { email } = req.params;

      // Fetch all user wallets
      const user = await uservice.findOne({ email });
      const userWallets = user.freeTrailUserWallets || [];

      // Fetch all transactions for the user
      const allTxs = await txService.find({
        email: email,
        transactionType: {
          $in: ["TRIAL_INVESTMENT", "PURCHASED_COINS"],
        },
        status: "Completed",
      });

      // Fetch all orders for the user
      const allOrders = await orderService.find({
        "user.email": email,
        orderType: ["Buy", "Convert"],
        status: "Completed",
      });

      //Fetch all staked balance for the user
      const allStaked = await stakingService.find({
        email: email,
        isActive: true,
      });
      // Helper function to find the corresponding wallet and ensure the coinBalance is available and skip staked balance
      const isWalletValid = (coinSymbol: string) => {
        const wallet = userWallets.find(
          (wallet: UserWallet) => wallet.coinSymbol === coinSymbol
        );
        // Ensure only non-zero available coinBalance is considered (excluding coinStakedBalance)
        return (
          wallet &&
          wallet.coinBalance > 0 &&
          (wallet.coinStakedBalance ?? 0) === 0
        );
      };

      // Sum up the 'amountInvested' from transactions, treating null/undefined as 0, and skip if the coinBalance is zero or staked
      const totalTransactionInvestment = allTxs.reduce((acc, tx) => {
        const coinSymbol = String(tx?.currencyRef); // Assuming 'currencyRef' contains the coin symbol in transactions
        if (!coinSymbol || !isWalletValid(coinSymbol)) return acc; // Skip if coinSymbol is not available or wallet is invalid
        console.log("tx?.amountInvested", tx?.amountInvested);
        return acc + (tx?.amountInvested || 0);
      }, 0);

      console.log("allOrders", allOrders);
      let totalOrderInvestment = 0;
      if (email !== "kathy.oglesbee@yahoo.com") {
        // Sum up the 'breakdown.inAmount' from orders, treating null/undefined as 0, and skip if the coinBalance is zero or staked
        totalOrderInvestment = allOrders.reduce((acc, order) => {
          const coinSymbol = order?.breakdown?.outCurrencyName; // Assuming breakdown contains the coin symbol in orders
          if (!coinSymbol || !isWalletValid(coinSymbol)) return acc; // Skip if coinSymbol is not available or wallet is invalid

          return acc + (order.breakdown?.inAmount || 0);
        }, 0);
      }

      let totalStakedValue = await allStaked.reduce(
        async (accPromise, stake) => {
          const acc = await accPromise; // wait for the accumulated value
          const stakedCoin = stake.coin;

          try {
            const priceResponse = await getPriceByName(String(stakedCoin));
            let price =
              stakedCoin === "INEX"
                ? 2 // considered the investments are at $2 per INEX
                : priceResponse
                  ? priceResponse.data
                  : 0;
            return acc + (stake?.stakedAmount * price || 0);
          } catch (error) {
            console.error(`Error fetching price for ${stakedCoin}`, error);
            return acc; // Return the current accumulator value in case of error
          }
        },
        Promise.resolve(0)
      ); // Initialize the accumulator with a resolved promise

      console.log(
        "totalTransactionInvestment in demo",
        totalTransactionInvestment
      );
      console.log("totalOrderInvestment", totalOrderInvestment);
      console.log("totalStakedValue", totalStakedValue);

      if (email === "cielinoinc@gmail.com") {
        totalStakedValue = 0;
      } else if (email === "daniel.estrada1991@yahoo.com") {
        totalStakedValue = 76;
      } else if (email === "rey.barthelemy@gmail.com") {
        totalStakedValue = 10000;
      } else if (email === "wwrv@verizon.net") {
        totalStakedValue = 0;
      } else if (email === "martinmonge@verizon.net") {
        totalStakedValue = 0;
      } else if (email === "joel@gearboxsports.com") {
        totalStakedValue = 0;
      }

      // if(email === "cielinoinc@gmail.com") {
      //   totalOrderInvestment += 4000;
      // }
      // Total investment
      let totalInvestment =
        totalTransactionInvestment + totalOrderInvestment + totalStakedValue;

      if (email === "banks144@yahoo.com") {
        totalInvestment = 24000;
      } else if (email === "jinelliott2013@yahoo.com") {
        totalInvestment = 4500;
      } else if (email === "lino.gomez1@gmail.com") {
        totalInvestment = 9000;
      } else if (
        email === "donpanchos4mr@gmail.com" ||
        email === "donpanchos4me@gmail.com"
      ) {
        totalInvestment = 40000;
      }

      console.log("totalInvestment", totalInvestment);

      return { status: 200, data: totalInvestment };
    } catch (error) {
      console.error("Error calculating total investment:", error);
      throw error;
    }
  }

  async getUserWallets09(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      const user = await uservice.findOneSelect({ email }, {});

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      // Parallelize all getPriceByNameForWallet calls
      const pricePromises = user.userWallets.map((wallet) =>
        this.getPriceByNameForWallet(wallet.coinSymbol, "Buy", wallet.coinSymbol === "BTCY" ? wallet.coinNetwork : "").then(
          (response) => ({
            ...wallet,
            coinPrice: Number(response.data),
            coinPrivateKey: "",
          })
        )
      );

      const walletsWithPrices = await Promise.all(pricePromises);

      return res.status(200).send({ data: walletsWithPrices });
    } catch (err: any) {
      return res.status(500).send({ message: err.message });
    }
  }

  async getTransactions(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      if (!user) {
        return { status: 500, data: "emailNotRegistered" };
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      let transactions = await transactionService.find({ email: email });

      // Fetch price for each transaction with a valid currencyRef
      const transactionsWithPrices = await Promise.all(
        transactions.map(async (transaction) => {
          let price = 0;
          if (transaction.currencyRef) {
            const priceResponse = await getPriceByName(
              String(transaction.currencyRef)
            );
            price = priceResponse ? priceResponse.data : 0;
          }

          const balance = transaction.amount * price;

          return {
            orderId: transaction.orderId,
            extRef: transaction.extRef,
            txId: transaction.txId,
            from: transaction.from,
            to: transaction.to,
            amount: transaction.amount,
            balance: balance,
            info: transaction.info,
            status: transaction.status,
            currencyRef: transaction.currencyRef,
            walletType: transaction.walletType,
            transactionType: transaction.transactionType,
            email: transaction.email,
            exchangeName: transaction.exchangeName,
            txDate: transaction.txDate,
            benificaryAddress: transaction.benificaryAddress,
            price: price,
            amountInvested: transaction?.amountInvested
              ? transaction?.amountInvested
              : 0,
            notes: transaction?.notes ? transaction.notes : "NA",
            created: transaction?.txDate,
            rate: transaction?.rate,
          };
        })
      );

      return { status: 200, data: transactionsWithPrices };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getFilteredUserOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (!user) {
        return { status: 500, data: "emailNotRegistered" };
      }

      const {
        fromDate,
        toDate,
        orderType,
        orderStatus,
        currency,
        transactionType,
      } = req.query;

      const filters: any = { "user.userId": user.id };

      // Apply date range filter if provided
      if (fromDate && toDate) {
        filters.created = {
          $gte: new Date(fromDate),
          $lte: new Date(toDate),
        };
      }

      // Apply order type filter if provided
      if (orderType) {
        filters.orderType = orderType;
      }

      if (transactionType) {
        filters["orderType"] = transactionType;
      }

      // Apply order status filter if provided
      if (orderStatus) {
        filters.status = orderStatus;
      }

      // Apply currency filter if provided
      if (currency) {
        filters["breakdown.outCurrencyName"] = currency;
      }

      console.log("filter", filters);
      let orders = await orderService.find(filters);
      return { status: 200, data: orders };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getTransactionsReport(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      if (!user) {
        return { status: 500, data: "emailNotRegistered" };
      }

      const { fromDate, toDate, assetSymbol, transactionType } = req.query;

      if (["Buy", "Sell", "Convert"].includes(transactionType)) {
        // Fetch user orders when transactionType is Buy, Sell, or Convert
        let orders = await this.getFilteredUserOrders(req, res);
        return orders;
      }

      const filters: any = { email };

      // Apply date range filter if provided
      if (fromDate && toDate) {
        filters.txDate = {
          $gte: new Date(fromDate),
          $lte: new Date(toDate),
        };
      }

      // Apply asset symbol filter if provided
      if (assetSymbol) {
        filters.currencyRef = assetSymbol;
      }

      // Apply transaction type filter if provided
      if (transactionType) {
        filters.transactionType = transactionType;
      }

      console.log("filters", filters);
      let transactions = await transactionService.find(filters);

      // Fetch price for each transaction with a valid currencyRef
      const transactionsWithPrices = await Promise.all(
        transactions.map(async (transaction) => {
          let price = 0;
          if (transaction.currencyRef) {
            const priceResponse = await getPriceByName(
              String(transaction.currencyRef)
            );
            price = priceResponse ? priceResponse.data : 0;
          }

          const balance = transaction.amount * price;

          return {
            orderId: transaction.orderId,
            extRef: transaction.extRef,
            txId: transaction.txId,
            from: transaction.from,
            to: transaction.to,
            amount: transaction.amount,
            balance: balance,
            info: transaction.info,
            status: transaction.status,
            currencyRef: transaction.currencyRef,
            walletType: transaction.walletType,
            transactionType: transaction.transactionType,
            email: transaction.email,
            exchangeName: transaction.exchangeName,
            txDate: transaction.txDate,
            benificaryAddress: transaction.benificaryAddress,
            price: price,
            amountInvested: transaction?.amountInvested
              ? transaction?.amountInvested
              : 0,
            notes: transaction?.notes ? transaction.notes : "NA",
          };
        })
      );

      return { status: 200, data: transactionsWithPrices };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBalance(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let { coin } = req.params;
      let user = await uservice.findOneSelect({ email: email }, {});
      let coinWallet: UserWallet = user.userWallets.find(
        (x) => x.coinSymbol == coin
      ) as UserWallet;
      if (user) {
        if (coinWallet) {
          let resultWallet = {
            coinSymbol: coinWallet.coinSymbol,
            coinName: coinWallet.coinName,
            balance: coinWallet.coinBalance,
            usdBalance: coinWallet.coinBalanceInBTC,
            btcBalance: coinWallet.coinBalanceInUSD,
          };
          if (resultWallet.balance != 0) {
            return { status: 200, data: resultWallet };
          } else {
            return { status: 500, data: "balance Zero" };
          }
        } else {
          return { status: 500, data: "coin Not Registered" };
        }
      } else {
        return { status: 500, data: "email Not Registered" };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBalanceByNetwork(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let { coin } = req.params;
      let { network } = req.params;
      let user = await uservice.findOneSelect({ email: email }, {});
      let coinWallet: UserWallet = user.userWallets.find(
        (x) => x.coinSymbol == coin && x.coinNetwork == network
      ) as UserWallet;
      if (user) {
        if (coinWallet) {
          let resultWallet = {
            coinSymbol: coinWallet.coinSymbol,
            coinName: coinWallet.coinName,
            balance: coinWallet.coinBalance,
            usdBalance: coinWallet.coinBalanceInBTC,
            btcBalance: coinWallet.coinBalanceInUSD,
          };
          return { status: 200, data: resultWallet };
        } else {
          return { status: 500, data: "coin Not Registered" };
        }
      } else {
        return { status: 500, data: "email Not Registered" };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async debitBtcyYingYangBalance(req: any, res: any) {
    try {
      const rawEmail = String(req.body?.email || "").toLowerCase().trim();
      const amountNum = Number(req.body?.amount);
      if (!rawEmail || !Number.isFinite(amountNum) || amountNum <= 0) {
        return { status: 400, data: { message: "badRequest" } };
      }

      const COIN = "BTCY";
      const NETWORK = "Ying Yang Chain";

      // Atomic decrement if balance is sufficient
      const updateRes: any = await uservice.updatePart(
        {
          email: rawEmail,
          userWallets: {
            $elemMatch: {
              coinSymbol: COIN,
              coinNetwork: NETWORK,
              coinBalance: { $gte: amountNum },
            },
          },
        },
        {
          $inc: { "userWallets.$.coinBalance": -amountNum },
          $set: { "userWallets.$.coinLastUsedOn": new Date() },
        }
      );

      const modified =
        updateRes?.modifiedCount ?? updateRes?.nModified ?? updateRes?.n ?? 0;

      const user = await uservice.findOneSelect(
        { email: rawEmail },
        { userWallets: 1 }
      );
      if (!user) {
        return { status: 404, data: { message: "email Not Registered" } };
      }

      const wallet: UserWallet | undefined = (user as any).userWallets?.find(
        (w: any) => w?.coinSymbol === COIN && w?.coinNetwork === NETWORK
      );
      if (!wallet) {
        return { status: 404, data: { message: "wallet Not Registered" } };
      }

      if (!modified) {
        return {
          status: 400,
          data: {
            message: "insufficientBalance",
            balance: wallet.coinBalance,
          },
        };
      }

      return {
        status: 200,
        data: {
          email: rawEmail,
          coinSymbol: COIN,
          coinNetwork: NETWORK,
          debited: amountNum,
          balance: wallet.coinBalance,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }


  async getUserWalletByNetwork(req: any, res: any) {
    try {
      let { email, coin, network } = req.params;

      const lowerEmail = String(email || "").toLowerCase();
      const coinSymbol = String(coin || "").toUpperCase();
      const coinNetwork = String(network || "").toLowerCase(); // compare case-insensitively

      const user = await uservice.findOneSelect({ email: lowerEmail }, { userWallets: 1, email: 1 });
      if (!user) {
        return { status: 404, data: "email Not Registered" };
      }

      // helper to find the wallet in a user doc
      const findWallet = (u: any) =>
        (u?.userWallets || []).find(
          (w: any) =>
            String(w?.coinSymbol || "").toUpperCase() === coinSymbol &&
            String(w?.coinNetwork || "").toLowerCase() === coinNetwork
        );

      let wallet = findWallet(user);

      // If not found and it's the special case BTCY on Stellar → create it
      if (!wallet && coinSymbol === "BTCY" && coinNetwork === "stellar") {
        try {
          // Prefer your generic creator if available; fall back to BTCY-specific
          if (typeof orderService?.checkAndCreateUserWallet === "function") {
            // some impls accept (email, coin) and ignore the 3rd arg; extra args are safe in JS
            await orderService.checkAndCreateUserWallet(lowerEmail, coinSymbol, false, "Stellar");
          } else if (typeof orderService?.createBitcoinYahWallet === "function") {
            await orderService.createBitcoinYahWallet(lowerEmail, coinSymbol);
          } else {
            return { status: 500, data: "Wallet creation function not available" };
          }

          // Re-fetch the user to read the newly created wallet
          const refreshed = await uservice.findOneSelect({ email: lowerEmail }, { userWallets: 1, email: 1 });
          wallet = findWallet(refreshed);
        } catch (e: any) {
          return { status: 500, data: `Failed to create BTCY/Stellar wallet: ${e?.message || String(e)}` };
        }
      }

      if (!wallet) {
        return { status: 404, data: "coin Not Registered" };
      }

      // Strip sensitive fields
      const cleanedWallet = JSON.parse(JSON.stringify(wallet));
      const { coinPrivateKey, privateKey, seed, secret, ...safeWalletData } = cleanedWallet;

      return { status: 200, data: safeWalletData };
    } catch (err: any) {
      return { status: 500, data: err?.message || String(err) };
    }
  }


  async getAcknowledgementStatus(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      let resDetails = {
        BTCYAcknowledgementStatus: user.BTCYAcknowledgementStatus,
        BTCYAcknowledgementDate: user.BTCYAcknowledgementDate
      };
      return {
        status: 200, data: resDetails
      }

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBTCYMigrationStatus(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      let resDetails = {
        BTCYAcknowledgementStatus: user.BTCYMigrationStatus,
        BTCYAcknowledgementDate: user.BTCYMigrationDate
      };
      return {
        status: 200, data: resDetails
      }

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateBTCYMigrationStatus(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();

      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      let updatedStatus = user.BTCYMigrationStatus || "Not Started";
      let migrationDate = user.BTCYMigrationDate || null;

      // Auto-progress: Not Started → In Queue
      if (updatedStatus === "Not Started" && user.BTCYAcknowledgementStatus) {
        updatedStatus = "In Queue";
        await uservice.updatePart({ email }, {
          $set: {
            BTCYMigrationStatus: updatedStatus,
          }
        });
      }

      // Auto-progress: In Queue → Completed
      if (updatedStatus === "In Queue") {
        // You can plug in actual logic for migration processing if needed
        updatedStatus = "Completed";
        migrationDate = new Date();

        await uservice.updatePart({ email }, {
          $set: {
            BTCYMigrationStatus: updatedStatus,
            BTCYMigrationDate: migrationDate
          }
        });

      }

      const response = {
        BTCYAcknowledgementStatus: !!user.BTCYAcknowledgementStatus,
        BTCYAcknowledgementDate: user.BTCYAcknowledgementDate || null,
        BTCYMigrationStatus: updatedStatus,
        BTCYMigrationDate: migrationDate,
      };

      return {
        status: 200, data: response
      }

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updatePrivacySettings(req: any, res: any) {
    try {
      let { email, hideRealName, hideBalance, pushNotifications } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      const updateObj: any = {};
      if (hideRealName !== undefined) {
        updateObj['UserPrivacyBTCYAppSettings.hideRealName'] = hideRealName;
      }
      if (hideBalance !== undefined) {
        updateObj['UserPrivacyBTCYAppSettings.hideBalance'] = hideBalance;
      }
      if (pushNotifications !== undefined) {
        updateObj['UserPrivacyBTCYAppSettings.pushNotifications'] = pushNotifications;
      }

      if (Object.keys(updateObj).length === 0) {

        return {
          status: 400, data: {
            success: false, message: "No settings provided to update"
          }
        }
      }

      await uservice.updatePart({ email }, { $set: updateObj });

      return {
        status: 200, data: {
          message: "Privacy settings updated"
        }
      }

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateBtcyAcknowledgementStatus(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();

      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 500, data: "email Not Registered" };
      }

      const now = new Date();

      // Update only acknowledgement status and date
      await uservice.updatePart(
        { email },
        {
          $set: {
            BTCYAcknowledgementStatus: true,
            BTCYAcknowledgementDate: now,
          },
        }
      );

      const response = {
        BTCYAcknowledgementStatus: true,
        BTCYAcknowledgementDate: now,
      };

      return {
        status: 200, data: response
      }

    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createUserWalletByNetwork(req: any, res: any) {
    try {
      let { email, coin, network } = req.body;
      email = String(email).toLowerCase();

      const user = await uservice.findOneSelect({ email }, {});
      if (!user) {
        return { status: 404, data: "Email not registered" };
      }

      const existingWallet = user.userWallets.find(
        (x) => x.coinSymbol === coin && x.coinNetwork === network
      );

      if (existingWallet) {
        return { status: 409, data: "Wallet already exists" };
      }

      const createWallet = await orderService.createBitcoinYahWallet(email, coin);
      if (!createWallet?.data) {
        return { status: 500, data: "Failed to create wallet" };
      }

      // Convert to plain object safely
      const walletData = JSON.parse(JSON.stringify(createWallet.data));

      // Remove private key and return
      const { coinPrivateKey, ...safeWalletData } = walletData;
      return { status: 201, data: safeWalletData };

    } catch (err) {
      console.error("Wallet creation error:", err);
      return {
        status: 500,
        data: "Internal server error"
      };
    }
  }

  async airDropRegister(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "INEX",
        status: "pending",
        network: "MATIC",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;
      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent =
          await airdropService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          );
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent =
          await airdropService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          );
      }

      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} airdrop ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await airdropService.create(airDropData);
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "INEX") {
          await new SendEmail().sendNewRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (
          airDropData.tokenName === "IUSD+" &&
          eventType === "SuperBall"
        ) {
          await new SendEmail().sendIUSDPSuperBallRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (
          airDropData.tokenName === "IUSD+" &&
          eventType === "SaintPatrick"
        ) {
          await new SendEmail().sendIUSDPSaintPatrickRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (airDropData.tokenName === "IUSD+") {
          await new SendEmail().sendIUSDPRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async bitcoinAirDropRegister(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: 0,
        tokenName: req.body.tokenName ? req.body.tokenName : "BTC",
        status: "pending",
        network: "Bitcoin",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      // Checking if the user is already participated in lottery
      const getAllLotteries = await lotteryService.find({});
      const participatedLotteries = getAllLotteries.filter((lottery) =>
        lottery.tickets.some(
          (ticket) =>
            String(ticket.email).toLowerCase() ===
            String(req.body.email).toLowerCase()
        )
      );

      if (!participatedLotteries || !participatedLotteries.length) {
        const message = `User has not participated in Lottery. Please participate in lottery`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }
      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await bitcoinAirdropService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await bitcoinAirdropService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} airdrop ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      if (airDropData.userType === "Indexx Exchange") {
        let getBTCPriceByName = await getPriceByName("BTC");
        let aridropAmount = getBTCPriceByName.data / 10000;
        let finalAirdropAmout = aridropAmount / getBTCPriceByName.data;
        console.log(aridropAmount, finalAirdropAmout);
        airDropData.airdropAmount =
          (Number(finalAirdropAmout) * 100000000) / 100000000;
        airDropData.coinPrice = String(getBTCPriceByName.data) + "USD";
      } else if (airDropData.userType === "Web Wallet") {
        let getBTCPriceByName = await getPriceByName("BTC");
        let aridropAmount = getBTCPriceByName.data / 10000;
        let finalAirdropAmout = aridropAmount / getBTCPriceByName.data;
        console.log(aridropAmount, finalAirdropAmout);
        airDropData.airdropAmount =
          (Number(finalAirdropAmout) * 100000000) / 100000000;
        airDropData.coinPrice = String(getBTCPriceByName.data) + "USD";
      } else if (
        airDropData.userType === "CaptainBee" ||
        airDropData.userType === "HoneyBee"
      ) {
        let getBTCPriceByName = await getPriceByName("BTC");
        let aridropAmount = (getBTCPriceByName.data * 2) / 10000;
        let finalAirdropAmout = aridropAmount / getBTCPriceByName.data;
        console.log(aridropAmount, finalAirdropAmout);
        airDropData.airdropAmount =
          (Number(finalAirdropAmout) * 100000000) / 100000000;
        airDropData.coinPrice = String(getBTCPriceByName.data) + "USD";
      }

      let createNewUser = await bitcoinAirdropService.create(airDropData);
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "INEX") {
          await new SendEmail().sendNewRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (
          airDropData.tokenName === "IUSD+" &&
          eventType === "SuperBall"
        ) {
          await new SendEmail().sendIUSDPSuperBallRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (airDropData.tokenName === "IUSD+") {
          await new SendEmail().sendIUSDPRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        } else if (airDropData.tokenName === "BTC") {
          await new SendEmail().sendBTCRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async emailSubscription(req: any, res: any) {
    try {
      let getSubscriptionData = await emailsSubscriptionService.findOne({
        email: String(req.body.email).toLowerCase(),
        website: req.body.website,
      });

      if (getSubscriptionData) {
        return {
          data: {
            message: "Email already subscribed",
          },
          status: 500,
        };
      } else {
        let subscribeData = {
          email: String(req.body.email).toLowerCase(),
          date: new Date(),
          website: req.body.website,
        };
        let createSubscriptionData = await emailsSubscriptionService.create(
          subscribeData
        );
        await new SendEmail().subscribeEmail(
          String(req.body.email).toLowerCase(),
          req.body.website
        );
        return {
          data: {
            message: "Succesfully email subscribed",
          },
          status: 201,
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async contactUs(req: any, res: any) {
    try {
      let contactUsData = {
        email: String(req.body.email).toLowerCase(),
        date: new Date(),
        website: req.body.website,
        message: req.body.message,
        subject: req.body?.subject ? req.body?.subject : "",
        name: req.body?.name ? req.body?.name : "",
      };
      await new SendEmail().contactUs(
        contactUsData?.email,
        contactUsData?.message,
        contactUsData?.website,
        contactUsData?.subject,
        contactUsData?.name
      );
      let createContactUsData = await contactUsService.create(contactUsData);

      return {
        data: {
          message: "Succesfully email subscribed",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async academyConfirmationEmail(req: any, res: any) {
    try {
      let contactUsData = {
        email: String(req.body.email).toLowerCase(),
        user: req.body.user,
        baseUrl: req.body.baseUrl,
      };

      console.log("contactUsData", contactUsData);
      await new SendEmail().sendAcademyAccountEmail(
        contactUsData?.email,
        contactUsData?.user,
        contactUsData?.baseUrl
      );

      return {
        data: {
          message: "Succesfully email sent",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async sendAcademyInstructorRequest(req: any, res: any) {
    try {
      let contactUsData = {
        email: String(req.body.email).toLowerCase(),
        user: req.body.user,
        baseUrl: req.body.baseUrl,
      };

      await new SendEmail().sendAcademyInstructorRequest(
        contactUsData?.email,
        contactUsData?.user,
        contactUsData?.baseUrl
      );

      return {
        data: {
          message: "Succesfully email sent",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllSmartCryptoPackages(req: any, res: any) {
    try {
      const rawDate = String(req?.query?.date || "").trim();
      const filter: any = { isActive: true };

      if (rawDate) {
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) {
          return { status: 400, data: { message: "Invalid date format." } };
        }

        const year = parsed.getUTCFullYear();
        const month = parsed.getUTCMonth();
        const day = parsed.getUTCDate();
        const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

        filter.$or = [
          { createdAt: { $gte: start, $lte: end } },
          { createdDate: { $gte: start, $lte: end } },
        ];
      }

      let allSmartCryptoPacks = await smartCryptoService.find(filter);

      return {
        data: allSmartCryptoPacks,
        status: 200,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getSpecificSmartCryptoPackage(req: any, res: any) {
    try {
      let title = req.params.title;
      title = String(title);
      let subTitle = req.params.subTitle;
      subTitle = String(subTitle);
      let smartCryptoPack = await smartCryptoService.findOne({
        title: title,
        subTitle: subTitle,
      });

      return {
        data: smartCryptoPack,
        status: 200,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateSpecificSmartCryptoPackage(req: any, res: any) {
    try {
      let packageData = req.body.packageData;
      // Extract and sanitize the title and subtitle
      let title = packageData.title;
      let subTitle = packageData.subTitle;

      console.log(packageData);
      // Extract the cryptocurrencies array from the request body
      let cryptoCurrencies = packageData.cryptocurrencies;

      // Find the existing SmartCrypto package by title and subtitle
      let smartCryptoPack = await smartCryptoService.findOne({
        title: title,
        subTitle: subTitle,
      });

      // If the package doesn't exist, return an error
      if (!smartCryptoPack) {
        return {
          status: 404,
          data: `SmartCrypto package with title '${title}' and subTitle '${subTitle}' not found.`,
        };
      }

      // // Iterate through the cryptocurrencies array to update individual records
      // for (let index = 0; index < cryptoCurrencies.length; index++) {
      //   const element = cryptoCurrencies[index];

      //   // Update the specific cryptocurrency in the array based on the token
      //   await smartCryptoService.updatePart(
      //     {
      //       title: title,
      //       subTitle: subTitle,
      //       "cryptocurrencies.token": element.token, // Match specific cryptocurrency by token
      //     },
      //     {
      //       $set: {
      //         "cryptocurrencies.$.name": element.name, // Update cryptocurrency fields
      //         "cryptocurrencies.$.percentage": element.percentage,
      //       },
      //       $setOnInsert: {
      //         updatedOn: new Date(), // Ensure updatedOn is set
      //       },
      //     }
      //   );
      // }

      await smartCryptoService.updatePart(
        {
          title: title,
          subTitle: subTitle,
        },
        {
          $set: {
            description: packageData.description,
            cryptocurrencies: cryptoCurrencies,
          },
          $setOnInsert: {
            updatedOn: new Date(), // Ensure updatedOn is set
          },
        }
      );

      // Return the updated SmartCrypto package
      const updatedSmartCryptoPack = await smartCryptoService.findOne({
        title: title,
        subTitle: subTitle,
      });

      return {
        data: updatedSmartCryptoPack,
        status: 200,
      };
    } catch (err: any) {
      console.error("Error updating SmartCrypto package:", err);
      return { status: 500, data: err.message };
    }
  }

  async sendAcademyContactFormEmail(req: any, res: any) {
    try {
      let contactUsData = {
        email: String(req.body.email).toLowerCase(),
        user: req.body.user,
        baseUrl: req.body.baseUrl,
      };

      await new SendEmail().sendAcademyContactFormEmail(
        contactUsData?.email,
        contactUsData?.user
      );

      return {
        data: {
          message: "Succesfully email sent",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async whoIsBitcoinSatoshiAirDropRegister(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "WIBS",
        status: "pending",
        network: "Ethereum",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      // Count how many "Indexx Exchange" type users are already registered
      const userType = "Indexx Exchange";
      const indexxExchangeCount =
        await whoIsBitcoinSatoshiAirdropService.countAirDropUsersByType(
          userType
        );

      console.log(indexxExchangeCount, "indexxExchangeCount");
      if (airDropData.userType === userType && indexxExchangeCount >= 50) {
        return {
          status: 400,
          data: {
            message: `Registration limit reached`,
          },
        };
      }

      // Checking if the user is already participated in lottery
      const getAllLotteries = await lotteryService.find({});
      const participatedLotteries = getAllLotteries.filter((lottery) =>
        lottery.tickets.some(
          (ticket) =>
            String(ticket.email).toLowerCase() ===
            String(req.body.email).toLowerCase()
        )
      );

      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await whoIsBitcoinSatoshiAirdropService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await whoIsBitcoinSatoshiAirdropService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await whoIsBitcoinSatoshiAirdropService.create(
        airDropData
      );
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "WIBS") {
          await new SendEmail().sendNewAirdropRegistrationConfirmation(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async whoIsBitcoinSatoshiAirDropRegisterMay27(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "WIBS",
        status: "pending",
        network: "Ethereum",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await whoIsBitcoinSatoshiAirdrop27MayService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await whoIsBitcoinSatoshiAirdrop27MayService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await whoIsBitcoinSatoshiAirdrop27MayService.create(
        airDropData
      );
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "WIBS") {
          await new SendEmail().sendNewAirdropRegistrationConfirmationMay27(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async whoIsBitcoinSatoshiAirDropRegisterJun16(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "WIBS",
        status: "pending",
        network: "Ethereum",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await whoIsBitcoinSatoshiAirdrop16JunService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await whoIsBitcoinSatoshiAirdrop16JunService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await whoIsBitcoinSatoshiAirdrop16JunService.create(
        airDropData
      );
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "WIBS") {
          await new SendEmail().sendNewAirdropRegistrationConfirmationJun16(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async dacrazyAirdropRegister(req: any, res: any) {
    try {
      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "DaCrazy",
        status: "pending",
        network: "Ethereum",
        eventType: req.body.eventType ? req.body.eventType : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await dacrazyAirdropService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await dacrazyAirdropService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await dacrazyAirdropService.create(airDropData);
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "DaCrazy") {
          await new SendEmail().sendNewAirdropRegistrationConfirmationForDaCrazy(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async btcyAirdropRegister(req: any, res: any) {
    try {

      const normalizedEmail = String(req.body.email).toLowerCase()

      const emailCheck = await this.checkEmailIfAlreadyUsedAndUserType(req, res, normalizedEmail);
      console.log("emailCheck", emailCheck);
      if (emailCheck.success) {
        return {
          status: 400,
          data: {
            message: "The email entered is not registered with Indexx.ai. To continue and qualify for the free airdrop, please create an account at Indexx.ai.",
          },
        };
      }

      // ✅ Check referral count
      const userDoc = await uservice.findOneSelect(
        { email: normalizedEmail },
        {
          relationships: 1,
          referralCode: 1
        }
      );
      // const refCount = userDoc?.relationships?.length || 0;

      // if (refCount < 10) {
      //   return {
      //     status: 400,
      //     data: {
      //       message:
      //         "To participate in the BTCY airdrop, you must refer at least 10 users. You currently have " +
      //         refCount +
      //         " referrals.",
      //     },
      //   };
      // }

      let airDropData = {
        userType: String(req.body.userType),
        createdDate: new Date(),
        email: req.body.email
          ? String(req.body.email).toLowerCase()
          : undefined,
        walletAddress: req.body.walletAddress
          ? String(req.body.walletAddress)
          : undefined,
        walletProvider: String(req.body.walletProvider),
        airdropAmount: req.body.airdropAmount,
        tokenName: req.body.tokenName ? req.body.tokenName : "BTCY",
        status: "pending",
        network: "Stellar",
        eventType: req.body.eventType ? req.body.eventType : "",
        referralCode: req.body.referralCode ? String(req.body.referralCode) : "",
      } as Airdrop;

      const eventType = req.body.eventType;

      let isExistUserByEmailAndEvent;
      let isExistUserByWalletAndEvent;
      if (airDropData.email) {
        // Check for existing user by email, token name, and event type
        isExistUserByEmailAndEvent = airDropData.email
          ? await whoIsBitcoinSatoshiAirdrop29SepService.isAirDropUserExistByEmailAndEvent(
            airDropData.email,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (airDropData.walletAddress) {
        // Check for existing user by wallet address, token name, and event type
        isExistUserByWalletAndEvent = airDropData.walletAddress
          ? await whoIsBitcoinSatoshiAirdrop29SepService.isAirdropUserExistsByWalletAndEvent(
            airDropData.walletAddress,
            airDropData.tokenName,
            eventType
          )
          : false;
      }
      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        const message = `User with ${existingMethod} (${isExistUserByEmailAndEvent
          ? airDropData.email
          : airDropData.walletAddress
          }) already registered for ${airDropData.tokenName} ${airDropData.eventType
            ? `with event type ${airDropData.eventType}`
            : ""
          }.`;
        return {
          status: 500,
          data: {
            message: message,
          },
        };
      }

      let createNewUser = await whoIsBitcoinSatoshiAirdrop29SepService.create(airDropData);
      if (
        typeof airDropData?.email !== "undefined" &&
        airDropData?.email !== "undefined"
      ) {
        if (airDropData.tokenName === "WIBS") {
          await new SendEmail().sendNewAirdropRegistrationConfirmationForWIBS(
            airDropData?.email,
            airDropData?.email,
            airDropData.airdropAmount,
            airDropData.userType
          );
        }
      }
      return {
        data: {
          message: "Succesfully registered for airdrop",
          referralCode: userDoc.referralCode
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async btcyNewYear2026AirdropRegister(req: any, res: any) {
    try {
      const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
      const walletAddress = String(req.body.walletAddress || "").trim();
      const referralCode = String(req.body.referralCode || "").trim();
      if (!normalizedEmail || !walletAddress) {
        return {
          status: 400,
          data: {
            message:
              "Email and TRON wallet address are required to qualify for the BTCY New Year Airdrop.",
          },
        };
      }

      const registrationDeadline = new Date(Date.UTC(2025, 11, 31, 23, 59, 59));
      if (new Date() > registrationDeadline) {
        return {
          status: 400,
          data: {
            message: "BTCY New Year Airdrop registration closed on December 31, 2025.",
          },
        };
      }

      const emailCheck = await this.checkEmailIfAlreadyUsedAndUserType(
        req,
        res,
        normalizedEmail
      );
      if (emailCheck.success) {
        return {
          status: 400,
          data: {
            message:
              "The email entered is not registered with Indexx.ai. Please create an Indexx.ai account to qualify for the BTCY New Year Airdrop.",
          },
        };
      }

      const eventType = "BTCYNewYear2026";
      const tokenName = "BTCY";

      const isExistUserByEmailAndEvent =
        await btcyNewYear2026AirdropService.isAirDropUserExistByEmailAndEvent(
          normalizedEmail,
          tokenName,
          eventType
        );
      const isExistUserByWalletAndEvent =
        walletAddress &&
        (await btcyNewYear2026AirdropService.isAirdropUserExistsByWalletAndEvent(
          walletAddress,
          tokenName,
          eventType
        ));

      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent ? "email" : "wallet address";
        return {
          status: 409,
          data: {
            message: `User with ${existingMethod} already registered for the BTCY New Year 2026 Airdrop.`,
          },
        };
      }

      const airDropData = {
        userType: String(req.body.userType || "participant"),
        createdDate: new Date(),
        email: normalizedEmail,
        walletAddress,
        walletProvider: String(req.body.walletProvider || "TRON"),
        airdropAmount: 0,
        tokenName,
        status: "pending",
        network: "TRC20",
        eventType,
        referralCode,
        notes: "New Year 2026 BTCY airdrop entry",
      } as Airdrop;

      await btcyNewYear2026AirdropService.create(airDropData);
      try {
        await new SendEmail().sendNewAirdropRegistrationConfirmationForBTCY(
          normalizedEmail,
          walletAddress,
          250,
          airDropData.userType
        );
      } catch (emailErr) {
        console.warn("Failed to send BTCY New Year 2026 registration email:", emailErr);
      }

      return {
        data: {
          message: "Successfully registered for the BTCY New Year Airdrop 2026.",
          referralCode,
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async btcyLoyaltyAirdropRegister(req: any, res: any) {
    try {
      const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
      const walletAddress = String(req.body.walletAddress || "").trim();
      const walletProvider = String(req.body.walletProvider || "TRON").trim();
      if (!normalizedEmail || !walletAddress) {
        return {
          status: 400,
          data: {
            message:
              "Email and wallet address are required to qualify for the BTCY Loyalty Airdrop.",
          },
        };
      }

      const emailCheck = await this.checkEmailIfAlreadyUsedAndUserType(
        req,
        res,
        normalizedEmail
      );
      if (emailCheck.success) {
        return {
          status: 400,
          data: {
            message:
              "The email entered is not registered with Indexx.ai. Please create an Indexx.ai account to qualify for the BTCY Loyalty Airdrop.",
          },
        };
      }

      const miningData = await miningService.getMiningData(
        normalizedEmail,
        "BTCY"
      );
      const totalMined = Number(miningData?.totalMined ?? 0);
      if (!miningData || totalMined < 100) {
        return {
          status: 400,
          data: {
            message:
              "Minimum 100 BTCY must be mined to be eligible for the BTCY Loyalty Airdrop.",
            totalMined,
          },
        };
      }

      const eventType = "BTCYLoyaltyAirdrop2026";
      const tokenName = "BTCY";
      const referralCode = String(req.body.referralCode || "").trim();

      const isExistUserByEmailAndEvent =
        await btcyLoyaltyAirdrop2026Service.isAirDropUserExistByEmailAndEvent(
          normalizedEmail,
          tokenName,
          eventType
        );
      const isExistUserByWalletAndEvent =
        await btcyLoyaltyAirdrop2026Service.isAirdropUserExistsByWalletAndEvent(
          walletAddress,
          tokenName,
          eventType
        );

      if (isExistUserByEmailAndEvent || isExistUserByWalletAndEvent) {
        const existingMethod = isExistUserByEmailAndEvent
          ? "email"
          : "wallet address";
        return {
          status: 409,
          data: {
            message:
              `User with ${existingMethod} already registered for the BTCY Loyalty Airdrop.`,
          },
        };
      }

      const airDropData = {
        userType: String(req.body.userType || "participant"),
        createdDate: new Date(),
        email: normalizedEmail,
        walletAddress,
        walletProvider,
        airdropAmount: 0,
        tokenName,
        status: "pending",
        network: "TRC20",
        eventType,
        referralCode,
        notes: "BTCY Loyalty Airdrop 2026 entry",
      } as Airdrop;

      await btcyLoyaltyAirdrop2026Service.create(airDropData);
      try {
        await new SendEmail().sendBtcyLoyaltyAirdropRegistrationConfirmation(
          normalizedEmail,
          walletAddress,
          0,
          airDropData.userType
        );
      } catch (emailErr) {
        console.warn(
          "Failed to send BTCY Loyalty airdrop registration email:",
          emailErr
        );
      }

      return {
        data: {
          message: "Successfully registered for the BTCY Loyalty Airdrop.",
          referralCode,
          totalMined,
        },
        status: 201,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  /**
   * WallStreet INEX Airdrop registration (Bitcoin Yay landing page form).
   * Requirements:
   * - Email must belong to an existing Indexx user
   * - One registration per email (no duplicates)
   */
  async wallstreetInexAirdropRegister(req: any, res: any) {
    try {
      const name = String(req.body?.name || "").trim();
      const emailRaw = String(req.body?.email || "").trim();
      const emailLower = emailRaw.toLowerCase();

      const isValidEmail = (v: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

      if (!name || name.length < 2) {
        return { status: 400, data: { message: "Name is required" } };
      }
      if (!emailRaw || !isValidEmail(emailRaw)) {
        return { status: 400, data: { message: "Valid email is required" } };
      }

      const user = await uservice.findOneSelect(
        { email: emailLower },
        { _id: 1, email: 1 }
      );
      if (!user) {
        return {
          status: 400,
          data: {
            message:
              "The email entered is not registered with Indexx.ai. Please create an Indexx.ai account to qualify for the INEX Airdrop.",
          },
        };
      }

      const existing = await wallstreetInexAirdropRegistrationService.findOne({
        _id: emailLower,
      });
      if (existing) {
        return {
          status: 409,
          data: { message: "Email already registered for the INEX Airdrop." },
        };
      }

      await wallstreetInexAirdropRegistrationService.create({
        _id: emailLower,
        email: emailLower,
        emailLower,
        name,
        userId: (user as any)._id,
        createdAt: new Date(),
      } as any);

      return {
        status: 201,
        data: { message: "Successfully registered for the INEX Airdrop." },
      };
    } catch (err: any) {
      // `_id=emailLower` guarantees uniqueness; duplicate inserts bubble as E11000
      if (err?.code === 11000) {
        return {
          status: 409,
          data: { message: "Email already registered for the INEX Airdrop." },
        };
      }
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  /**
   * BTCY Social Post Airdrop registration.
   * Required fields: name, email, postLink, walletAddress (USDT on Ethereum).
   * Allows repeated email/wallet registrations, but post link must be unique.
   */
  async btcySocialPostAirdropRegister(req: any, res: any) {
    try {
      const name = String(req.body?.name || "").trim();
      const emailRaw = String(req.body?.email || "").trim();
      const emailLower = emailRaw.toLowerCase();
      const postLink = String(req.body?.postLink || "").trim();
      const walletAddress = String(req.body?.walletAddress || "").trim();
      const walletAddressLower = walletAddress.toLowerCase();

      const isValidEmail = (v: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
      const isValidHttpUrl = (v: string) =>
        /^https?:\/\/\S+$/i.test(String(v || "").trim());
      const isValidEthAddress = (v: string) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(v || "").trim());
      const normalizePostLink = (v: string) => {
        const raw = String(v || "").trim();
        if (!raw) {
          return "";
        }

        try {
          const parsed = new URL(raw);
          const protocol = parsed.protocol.toLowerCase();
          const host = parsed.hostname.toLowerCase();
          const pathname = parsed.pathname.replace(/\/+$/, "");
          const search = parsed.search || "";
          return `${protocol}//${host}${pathname}${search}`.toLowerCase();
        } catch {
          return raw.toLowerCase();
        }
      };

      if (!name || name.length < 2) {
        return { status: 400, data: { message: "Name is required" } };
      }
      if (!emailRaw || !isValidEmail(emailRaw)) {
        return { status: 400, data: { message: "Valid email is required" } };
      }
      if (!postLink || !isValidHttpUrl(postLink)) {
        return { status: 400, data: { message: "Valid post link is required" } };
      }
      const postLinkNormalized = normalizePostLink(postLink);
      if (!walletAddress || !isValidEthAddress(walletAddress)) {
        return {
          status: 400,
          data: { message: "Valid Ethereum wallet address is required" },
        };
      }

      // Keep DB indexes aligned with schema so email/wallet duplicates remain allowed.
      await btcySocialPostAirdropService.ensureIndexesSynced();

      const user = await uservice.findOneSelect(
        { email: emailLower },
        { _id: 1, email: 1 }
      );
      if (!user) {
        return {
          status: 400,
          data: {
            message:
              "The email entered is not registered with Indexx.ai. Please create an Indexx.ai account to qualify for the BTCY Airdrop.",
          },
        };
      }

      const existingByPostLink = await btcySocialPostAirdropService.findOne({
        postLinkNormalized,
      });
      if (existingByPostLink) {
        return {
          status: 409,
          data: {
            message: "This post link is already used.",
          },
        };
      }

      const now = new Date();
      await btcySocialPostAirdropService.create({
        name,
        email: emailLower,
        emailLower,
        postLink,
        postLinkNormalized,
        walletAddress,
        walletAddressLower,
        userId: (user as any)._id,
        tokenName: "BTCY",
        eventType: "BTCYSocialPostAirdrop2026",
        network: "Ethereum",
        walletToken: "USDT",
        status: "Registered",
        createdAt: now,
        updatedAt: now,
      } as any);

      try {
        await new SendEmail().sendBtcySocialPostAirdropRegistrationConfirmation(
          emailLower,
          name,
          postLink,
          walletAddress
        );
      } catch (emailErr) {
        console.warn(
          "Failed to send BTCY social post airdrop registration email:",
          emailErr
        );
      }

      return {
        status: 201,
        data: {
          message: "Successfully registered for the BTCY Social Post Airdrop.",
        },
      };
    } catch (err: any) {
      if (err?.code === 11000) {
        if (err?.keyPattern?.postLinkNormalized || err?.keyValue?.postLinkNormalized) {
          return {
            status: 409,
            data: {
              message: "This post link is already used.",
            },
          };
        }
        return {
          status: 409,
          data: {
            message: "Duplicate registration data detected.",
          },
        };
      }
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async allBtcySocialPostAirdropRegisterData(req: any, res: any) {
    try {
      const rawLimit = Number(req?.query?.limit ?? 1000);
      const rawSkip = Number(req?.query?.skip ?? 0);

      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 5000)
        : 1000;
      const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;

      const emailFilter =
        typeof req?.query?.email === "string" && req.query.email.trim()
          ? String(req.query.email).trim().toLowerCase()
          : "";

      const filters: any = {};
      if (emailFilter) {
        filters.emailLower = emailFilter;
      }

      const [rows, total] = await Promise.all([
        btcySocialPostAirdropService.findPaginatedSkip(
          limit,
          skip,
          { createdAt: -1 },
          filters,
          {}
        ),
        btcySocialPostAirdropService.findCount(filters),
      ]);

      return {
        status: 200,
        data: rows,
        pagination: {
          limit,
          skip,
          total,
          hasNext: skip + rows.length < total,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async downloadBtcySocialPostAirdropRegistrations(req: any, res: any) {
    try {
      const rawBatchSize = Number(req?.query?.batchSize ?? 2000);
      const batchSize = Number.isFinite(rawBatchSize)
        ? Math.min(Math.max(Math.floor(rawBatchSize), 100), 10000)
        : 2000;

      const emailFilter =
        typeof req?.query?.email === "string" && req.query.email.trim()
          ? String(req.query.email).trim().toLowerCase()
          : "";

      const statusFilter =
        typeof req?.query?.status === "string" && req.query.status.trim()
          ? String(req.query.status).trim()
          : "";

      const fromStr =
        typeof req?.query?.from === "string" && req.query.from.trim()
          ? String(req.query.from).trim()
          : "";

      const toStr =
        typeof req?.query?.to === "string" && req.query.to.trim()
          ? String(req.query.to).trim()
          : "";

      const filters: any = {};
      if (emailFilter) {
        filters.emailLower = emailFilter;
      }
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (fromStr || toStr) {
        filters.createdAt = {};
        if (fromStr) {
          const fromDate = new Date(fromStr);
          if (!Number.isNaN(fromDate.getTime())) {
            filters.createdAt.$gte = fromDate;
          }
        }
        if (toStr) {
          const toDate = new Date(toStr);
          if (!Number.isNaN(toDate.getTime())) {
            filters.createdAt.$lte = toDate;
          }
        }
        if (!Object.keys(filters.createdAt).length) {
          delete filters.createdAt;
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `btcy_social_post_airdrop_registrations_${timestamp}.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");

      const csvHeaders = [
        "_id",
        "name",
        "email",
        "emailLower",
        "postLink",
        "postLinkNormalized",
        "walletAddress",
        "walletAddressLower",
        "userId",
        "tokenName",
        "eventType",
        "network",
        "walletToken",
        "status",
        "createdAt",
        "updatedAt",
      ];

      const csvStream = format({ headers: csvHeaders });
      csvStream.pipe(res);

      let skip = 0;
      let exportedCount = 0;

      while (true) {
        const rows = await btcySocialPostAirdropService.findPaginatedSkip(
          batchSize,
          skip,
          { createdAt: -1 },
          filters,
          {}
        );

        if (!rows.length) {
          break;
        }

        for (const row of rows) {
          csvStream.write({
            _id: row?._id ? String(row._id) : "",
            name: row?.name || "",
            email: row?.email || "",
            emailLower: row?.emailLower || "",
            postLink: row?.postLink || "",
            postLinkNormalized: row?.postLinkNormalized || "",
            walletAddress: row?.walletAddress || "",
            walletAddressLower: row?.walletAddressLower || "",
            userId: row?.userId ? String(row.userId) : "",
            tokenName: row?.tokenName || "",
            eventType: row?.eventType || "",
            network: row?.network || "",
            walletToken: row?.walletToken || "",
            status: row?.status || "",
            createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : "",
            updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : "",
          });
          exportedCount += 1;
        }

        skip += rows.length;
        if (rows.length < batchSize) {
          break;
        }
      }

      csvStream.end();
      console.log(
        `[AdminExport] Exported ${exportedCount} BTCY social post airdrop registrations`
      );
      return;
    } catch (err) {
      console.error("downloadBtcySocialPostAirdropRegistrations error:", err);
      if (!res.headersSent) {
        return res.status(500).json({
          status: 500,
          data: { message: "Failed to export BTCY social post airdrop registrations" },
        });
      }
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async allBtcyAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await btcyAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allBtcyLoyaltyAirdropRegisterData(req: any, res: any) {
    try {
      const rawLimit = Number(req?.query?.limit ?? 1000);
      const rawSkip = Number(req?.query?.skip ?? 0);

      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 5000)
        : 1000;
      const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;

      const pageSize = limit + 1;
      const rows = await btcyLoyaltyAirdrop2026Service.findPaginatedSkip(
        pageSize,
        skip,
        { _id: 1 },
        {},
        {}
      );

      const hasNext = rows.length > limit;
      const data = hasNext ? rows.slice(0, limit) : rows;

      return {
        status: 200,
        data,
        limit,
        skip,
        hasNext,
        nextSkip: hasNext ? skip + limit : null,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getWallstreetUsdBalance(req: any, res: any) {
    try {
      const rawEmail = String(req.body?.email || "").toLowerCase().trim();
      if (!rawEmail) {
        return { status: 400, data: { message: "email is required" } };
      }

      const user = await uservice.findOneSelect({ email: rawEmail }, {});
      if (!user) {
        return { status: 404, data: { message: "email Not Registered" } };
      }

      const wallet = (user.userWallets || []).find(
        (x) => x.coinSymbol === "USD" && x.coinNetwork === "USD"
      ) as UserWallet | undefined;

      const balance = wallet?.coinBalance ?? 0;
      const result = {
        email: rawEmail,
        coinSymbol: "USD",
        coinNetwork: "USD",
        walletExists: !!wallet,
        hasBalance: Number(balance) > 0,
        balance,
      };
      return { status: 200, data: result };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateWallstreetUsdBalance(req: any, res: any) {
    try {
      const rawEmail = String(req.body?.email || "").toLowerCase().trim();
      const mode = String(req.body?.mode || req.body?.action || "set")
        .toLowerCase()
        .trim();
      const amountRaw =
        req.body?.amount ?? req.body?.balance ?? req.body?.delta;
      const amountNum = Number(amountRaw);

      if (!rawEmail || !Number.isFinite(amountNum)) {
        return { status: 400, data: { message: "badRequest" } };
      }

      const COIN = "USD";
      const NETWORK = "USD";

      const user = await uservice.findOneSelect(
        { email: rawEmail },
        { userWallets: 1 }
      );
      if (!user) {
        return { status: 404, data: { message: "email Not Registered" } };
      }

      const hasWallet = (user.userWallets || []).some(
        (w: any) => w?.coinSymbol === COIN && w?.coinNetwork === NETWORK
      );
      if (!hasWallet && typeof orderService?.checkAndCreateUserWallet === "function") {
        const created = await orderService.checkAndCreateUserWallet(
          rawEmail,
          COIN
        );
        if (!created) {
          return { status: 500, data: { message: "Failed to create wallet" } };
        }
      }

      if (mode === "inc" || mode === "increase") {
        if (amountNum <= 0) {
          return { status: 400, data: { message: "badRequest" } };
        }
        await uservice.updatePart(
          {
            email: rawEmail,
            "userWallets.coinSymbol": COIN,
            "userWallets.coinNetwork": NETWORK,
          },
          {
            $inc: { "userWallets.$.coinBalance": amountNum },
            $set: { "userWallets.$.coinLastUsedOn": new Date() },
          }
        );
      } else if (mode === "dec" || mode === "decrease") {
        if (amountNum <= 0) {
          return { status: 400, data: { message: "badRequest" } };
        }
        const updateRes: any = await uservice.updatePart(
          {
            email: rawEmail,
            userWallets: {
              $elemMatch: {
                coinSymbol: COIN,
                coinNetwork: NETWORK,
                coinBalance: { $gte: amountNum },
              },
            },
          },
          {
            $inc: { "userWallets.$.coinBalance": -amountNum },
            $set: { "userWallets.$.coinLastUsedOn": new Date() },
          }
        );

        const modified =
          updateRes?.modifiedCount ?? updateRes?.nModified ?? updateRes?.n ?? 0;
        if (!modified) {
          const current = await uservice.findOneSelect(
            { email: rawEmail },
            { userWallets: 1 }
          );
          const wallet: UserWallet | undefined = (current as any)?.userWallets?.find(
            (w: any) => w?.coinSymbol === COIN && w?.coinNetwork === NETWORK
          );
          return {
            status: 400,
            data: {
              message: "insufficientBalance",
              balance: wallet?.coinBalance ?? 0,
            },
          };
        }
      } else {
        return { status: 400, data: { message: "badRequest" } };
      }

      const updated = await uservice.findOneSelect(
        { email: rawEmail },
        { userWallets: 1 }
      );
      const wallet: UserWallet | undefined = (updated as any)?.userWallets?.find(
        (w: any) => w?.coinSymbol === COIN && w?.coinNetwork === NETWORK
      );

      return {
        status: 200,
        data: {
          email: rawEmail,
          coinSymbol: COIN,
          coinNetwork: NETWORK,
          mode,
          amount: amountNum,
          balance: wallet?.coinBalance ?? 0,
        },
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allBtcyNewYear2026AirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await btcyNewYear2026AirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allBtcy4thJlyAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await btcy4thJlyAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allWIBSAirdropSep29RegisterData(req: any, res: any) {
    try {
      let allAirdropData = await whoIsBitcoinSatoshiAirdrop29SepService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getbtcyLottoAirdropRegister(req: any, res: any) {
    try {
      let allAirdropData = await btcyLottoAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }


  async allAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await airdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allBitcoinAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await bitcoinAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allWIBSAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await whoIsBitcoinSatoshiAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allMayWIBSAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await whoIsBitcoinSatoshiAirdrop27MayService.find(
        {}
      );
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allJunWIBSAirdropRegisterData(req: any, res: any) {
    try {
      let allAirdropData = await whoIsBitcoinSatoshiAirdrop16JunService.find(
        {}
      );
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async allDacrazyAirdropRegisterUsers(req: any, res: any) {
    try {
      let allAirdropData = await dacrazyAirdropService.find({});
      if (allAirdropData.length > 0) {
        return { data: allAirdropData, status: 200 };
      } else {
        return { data: [], status: 200 };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addRewards(req: any, res: any) {
    try {
      let { email, orderId } = req.body;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      let order = await orderService.findOne({ orderId: orderId });
      let appSettings = await appSettingsService.getSettingsBykey(
        "TradeToEarnPercentage"
      );
      if (user && order) {
        if (order.status == "Completed") {
          let orderAmountInUSD = 0;
          if (order.orderType == "Buy" || order.orderType == "Sell") {
            orderAmountInUSD =
              order.orderType == "Buy"
                ? order.breakdown.inAmount
                : order.breakdown.inAmount *
                order.orderRate.rate *
                order.breakdown.inAmount;
          } else if (order.orderType == "Convert") {
            let converOrderAmount = await this.getConvertOrderAmountINUSD(
              order
            );
            orderAmountInUSD = converOrderAmount;
          }
          if (orderAmountInUSD > 50) {
            return {
              status: 200,
              data: {
                message:
                  "No rewards added to this order as order amount is less 50 USD",
                rewardAmount: 0,
              },
            };
          } else {
            let rewardAmountToAdd =
              order.breakdown.inAmount *
              orderAmountInUSD *
              appSettings.data.value;
            let getUserRewards = await rewardService.findOne({ email: email });
            if (getUserRewards) {
              let updateReward = await rewardService.updatePart(
                { "user.email": email },
                {
                  $set: {
                    totalRewards: rewardAmountToAdd,
                  },
                }
              );
              if (updateReward) {
                const message = "rewardAdded";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileAddingReward";
                return { status: 500, data: message };
              }
            } else {
              let newReward = {
                userId: user._id,
                email: user.email,
                referralCode: "Reward for order",
                totalRewards: rewardAmountToAdd,
                rewardCurrency: "Indexx Exchange Token",
                rewardTokenBalanceInUSD: rewardAmountToAdd * 0.1,
                rewardUpdatedOn: new Date(),
                rewardTokenPrice: 0.1,
                rewardCurrencySymbol: "INEX",
                rewardCurrencyDecimals: 18,
                rewardTokenAddress: "",
              };
              let addReward = await rewardService.create(newReward);
              if (addReward) {
                const message = "rewardAdded";
                return { status: 200, data: message };
              } else {
                const message = "errorWhileAddingReward";
                return { status: 500, data: message };
              }
            }
          }
        } else {
          const message = "No order or user found";
          return { status: 500, data: message };
        }
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async fundWallet(req: any, res: any) {
    try {
      const { email, amount, currency = "USD" } = req.body;
      const userEmail = String(email).toLowerCase();

      // Find user
      const user = await uservice.findOneSelect(
        { email: userEmail },
        this.registerFields
      );

      if (!user) {
        return { status: 404, data: "User not found" };
      }

      // Check if user has the currency wallet, create if not
      const hasWallet = user.userWallets?.some(
        (wallet: any) => wallet.coinSymbol === currency
      );

      if (!hasWallet) {
        // Create wallet for the currency
        const createWallet = await orderService.checkAndCreateUserWallet(userEmail, currency);
        if (!createWallet) {
          return { status: 500, data: "Failed to create wallet" };
        }
      }

      // Add balance to user wallet
      const updateResult = await uservice.updatePart(
        {
          email: userEmail,
          "userWallets.coinSymbol": currency
        },
        {
          $inc: { "userWallets.$.coinBalance": amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      if (!updateResult) {
        return { status: 500, data: "Failed to update wallet balance" };
      }

      // Create transaction record
      const transaction = {
        orderId: `FUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        extRef: "",
        txId: "",
        from: "system",
        to: userEmail,
        amount: amount,
        info: `Test funding - ${amount} ${currency} added to wallet`,
        status: "Completed",
        currencyRef: currency,
        walletType: "Exchange",
        transactionType: "Deposit",
        exchangeName: "Indexx",
        email: userEmail,
        txDate: new Date(),
        benificaryAddress: ""
      };

      await transactionService.create(transaction as any);

      return {
        status: 200,
        data: {
          message: `Successfully funded ${amount} ${currency} to ${userEmail}`,
          newBalance: amount,
          currency: currency,
          transactionId: transaction.orderId
        }
      };

    } catch (err) {
      console.error("Error funding wallet:", err);
      return { status: 500, data: err };
    }
  }

  async addRewardsForCoursePurchase(req: any, res: any) {
    try {
      let { email, price, orderId, courseId } = req.body;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );

      if (user) {
        let latestINEXRate = await currencyService.findOne({
          code: "INEX",
        });
        let rewardINEX = 50 / latestINEXRate.buyPrice; //50 USD worth of INEX

        let updateUser1 = await uservice.updatePart(
          {
            email: user.email,
            "userWallets.coinSymbol": "INEX",
            "userWallets.coinNetwork": "Binance Smart Chain",
          },
          {
            $inc: {
              "userWallets.$.coinBalance": rewardINEX,
            },
            $set: {
              "userWallets.$coinLastUsedOn": new Date(),
            },
          }
        );

        //create transaction
        let transaction = {
          orderId: uuidv1(),
          extRef: "",
          txId: "",
          from: "",
          to: user.email,
          amount: rewardINEX,
          info: "Adding INEX for purchasing course",
          status: OrderStatus.Completed,
          currencyRef: "INEX",
          walletType: "Asset Wallet",
          transactionType: "Bonus Token",
          exchangeName: "CEX",
          email: user.email,
          txDate: new Date(),
          benificaryAddress: "",
          notes: "Adding INEX tokens as bonus for purchasing course",
        } as Transaction;
        let createTx = await transactionService.create(transaction);

        let latestWIBSRate = await currencyService.findOne({
          code: "WIBS",
        });
        let rewardWIBS = 50 / latestWIBSRate.buyPrice; //50 USD worth of INEX

        let updateUser2 = await uservice.updatePart(
          {
            email: user.email,
            "userWallets.coinSymbol": "WIBS",
          },
          {
            $inc: {
              "userWallets.$.coinBalance": rewardWIBS,
            },
            $set: {
              "userWallets.$coinLastUsedOn": new Date(),
            },
          }
        );
        console.log("updateUser2", updateUser2);
        //create transaction
        let transaction1 = {
          orderId: uuidv1(),
          extRef: "",
          txId: "",
          from: "",
          to: user.email,
          amount: rewardWIBS,
          info: "Adding WIBS for purchasing course",
          status: OrderStatus.Completed,
          currencyRef: "WIBS",
          walletType: "Asset Wallet",
          transactionType: "Bonus Token",
          exchangeName: "CEX",
          email: user.email,
          txDate: new Date(),
          benificaryAddress: "",
          notes: "Adding WIBS tokens as bonus for purchasing course",
        } as Transaction;
        let createTx1 = await transactionService.create(transaction1);
        const message = "Added free bonus tokens";

        //Checking and adding referral bouns
        let userReferralCode = user.referralCodeUsed;

        if (userReferralCode) {
          try {
            let referredUser = await uservice.findOne({
              referralCode: userReferralCode,
            });

            if (referredUser) {
              let getUserReferralData = await referralEarningService.findOne({
                referrerEmail: referredUser.email,
              });

              if (getUserReferralData) {
                let existingOrders = getUserReferralData.orders || [];
                let commissionValue = price; // USD value
                let latestBaseRate = await currencyService.findOne({
                  code: "INEX",
                });

                if (latestBaseRate && latestBaseRate.buyPrice) {
                  let finalCommission =
                    ((commissionValue / latestBaseRate.buyPrice) * 5) / 100;

                  let addNewOrder = {
                    email: user.email,
                    amount: price,
                    currency: "Academy course Price",
                    type: `Academy course Price, courseId: ${courseId}, orderId: ${orderId}`,
                    date: new Date(),
                    commissionValue: finalCommission,
                  };

                  existingOrders.push(addNewOrder);

                  // Add the referral commission
                  let updateCommissionData =
                    await referralEarningService.updatePart(
                      {
                        referrerEmail: referredUser.email,
                      },
                      {
                        $set: {
                          commissionCurrency: "INEX",
                          commissionPercentage: 5,
                          orders: existingOrders,
                          totalEarned:
                            (getUserReferralData.totalEarned || 0) +
                            finalCommission,
                        },
                      }
                    );

                  if (updateCommissionData) {
                    console.log("Referral commission updated successfully.");
                  } else {
                    console.error("Failed to update referral commission.");
                  }
                } else {
                  console.error("Invalid base rate data.");
                }
              } else {
                console.error("Referral data not found for the referrer.");
              }
            } else {
              console.error("Referred user not found.");
            }
          } catch (error) {
            console.error("Error processing referral commission:", error);
          }
        }
        return { status: 200, data: message };
      } else {
        const message = "No order or user found";
        return { status: 500, data: message };
      }
    } catch (err) {
      console.log("err in add reward", err);
      return { status: 500, data: err };
    }
  }

  async getAllReferredUsers(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();

      let getEmailUser = await uservice.findOne({ email: email });
      if (getEmailUser) {
        let referrerCode = getEmailUser.referralCode;
        let getReferredUsers = await uservice.findSelect(
          { referralCodeUsed: referrerCode },
          { email: 1, _id: 0 }
        );

        let referredUsers = [];

        for (let index = 0; index < getReferredUsers.length; index++) {
          const element = getReferredUsers[index];
          const getAllOrders = await orderService.find({
            "user.email": element.email,
          });
          referredUsers.push({
            email: element.email,
            orders: getAllOrders,
          });
        }

        let referralData = await referralEarningService.findOne({
          referrerEmail: email,
        });
        if (referredUsers.length > 0) {
          return { status: 200, data: { referredUsers, referralData } };
        } else {
          return { status: 200, data: [] };
        }
      } else {
        let message = "Email not found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async withdrawRewards(req: any, res: any) {
    try {
      let { email, amount } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect({ email: email }, {});
      let getUserRewards = await rewardService.findOne({ email: email });
      if (user && getUserRewards) {
        let rewardAmount = getUserRewards.totalRewards;
        if (amount <= rewardAmount) {
          console.log("amount", amount * 0.1);
          let tokenWithdraw =
            await indexxTokenService.transferIndexxExchangebyAdmin(
              getUserRewards.rewardTokenAddress,
              amount * 0.1, //0.1 is the price of token in usd, ui gives value in usd
              email,
              "Withdraw rewards from trade to earn",
              "Withdraw_Rewards"
            );
          if (tokenWithdraw) {
            console.log("currenct reward", rewardAmount);
            let updateReward = await rewardService.updatePart(
              { "user.email": email },
              {
                $set: {
                  totalRewards: rewardAmount - amount * 0.1,
                  rewardTokenBalanceInUSD: rewardAmount * 0.1 - amount,
                },
              }
            );
            if (updateReward) {
              const message = "rewardWithdrawn";
              return {
                status: 200,
                data: { message: message, txData: tokenWithdraw },
              };
            } else {
              const message = "errorWhileWithdrawingReward";
              return { status: 500, data: message };
            }
          } else {
            return { status: 500, data: "Failed to withdraw" };
          }
        } else {
          const message = "insufficientReward";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Or Reward Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getAllGiftCards(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();
      let giftCards = await newGiftCardService.find({
        createdBy: email,
      });

      if (giftCards.length > 0) {
        const priceCache: Record<string, number> = {};

        for (let i = 0; i < giftCards.length; i++) {
          const type = giftCards[i]?.type;
          if (type !== "USD" && type) {
            if (!(type in priceCache)) {
              const res = await this.getPriceByNameForWallet(type, "Buy");
              priceCache[type] = Number(res.data); // Store fetched price in cache
            }
            giftCards[i].price = priceCache[type]; // Assign cached price
          } else {
            giftCards[i].price = 0; // Default price for "USD" or undefined type
          }
        }

        return {
          status: 200,
          data: giftCards,
        };
      } else {
        return {
          status: 200,
          data: [],
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getLeaderboard(req: any, res: any, coin: string, nextToken: number) {
    try {
      const LIMIT = 50;

      let allUsers = await uservice.find({
        skip: nextToken,
        limit: LIMIT + 1, // Fetch one extra to check if there are more users
      });

      let daCrazyUsers = [];
      let hasMore = false;

      if (allUsers.length > 0) {
        if (allUsers.length > LIMIT) {
          hasMore = true;
          allUsers = allUsers.slice(0, LIMIT); // Only keep the first 50
        }

        for (let index = 0; index < allUsers.length; index++) {
          const element = allUsers[index];
          let userWallets = element.userWallets;
          let daCrazyUserWallet = userWallets.find(
            (x) => x.coinSymbol === coin
          );
          if (
            Number(daCrazyUserWallet?.coinBalance) > 0 ||
            Number(daCrazyUserWallet?.coinStakedBalance) > 0
          ) {
            daCrazyUsers.push({
              email: element.email,
              coinBalance: daCrazyUserWallet?.coinBalance,
              coinStakedBalance: daCrazyUserWallet?.coinStakedBalance,
            });
          }
        }

        return {
          status: 200,
          data: daCrazyUsers,
          nextToken: hasMore ? nextToken + LIMIT : null,
        };
      } else {
        return {
          status: 200,
          data: [],
          nextToken: null,
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createNewGiftCard(req: any, res: any) {
    try {
      const { amount, email, currency, giftCardUrl, cardType } = req.body;

      let user = await uservice.findOne({
        email: String(email).toLowerCase(),
      });
      let getRequiredCoinWallet;
      if (currency === "INEX") {
        getRequiredCoinWallet = user.userWallets.find(
          (x) =>
            (x.coinSymbol === currency &&
              x.coinNetwork == "Binance Smart Chain") ||
            (x.coinSymbol === currency && x.coinNetwork == "Polygon")
        ) as UserWallet;
      } else {
        getRequiredCoinWallet = user.userWallets.find(
          (x) => x.coinSymbol === currency
        ) as UserWallet;
      }
      console.log(getRequiredCoinWallet?.coinBalance);
      if (getRequiredCoinWallet?.coinBalance >= amount) {
        // update 2 for user decrement crypto value
        if (currency === "INEX") {
          let updateUserWallet = await uservice.updatePart(
            {
              email: user.email,
              "userWallets.coinSymbol": currency,
              "userWallets.coinNetwork": getRequiredCoinWallet.coinNetwork,
            },
            {
              $inc: {
                "userWallets.$.coinBalance": -1 * amount,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        } else {
          let updateUserWallet = await uservice.updatePart(
            {
              email: user.email,
              "userWallets.coinSymbol": currency,
            },
            {
              $inc: {
                "userWallets.$.coinBalance": -1 * amount,
              },
              $set: {
                coinLastUsedOn: new Date(),
              },
            }
          );
        }
        const voucherCode = Array.from({ length: 4 }, () =>
          Math.random().toString(36).toUpperCase().substring(2, 6)
        ).join("-");
        let userGiftCard = {
          voucher: voucherCode,
          amount: amount,
          dateOfGeneration: new Date(),
          isUsed: false,
          type: currency,
          createdBy: String(email).toLowerCase(),
          createdOn: new Date(),
          giftCardImgUrl: giftCardUrl,
          cardType: cardType,
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
          amount: amount,
          info: "Created Gift Card",
          notes: `Gift Card (${voucherCode})`,
          status: OrderStatus.Completed,
          currencyRef: currency,
          walletType: "ASSET_WALLET",
          transactionType: "Create Gift",
          exchangeName: "CEX",
          txDate: new Date(),
          benificaryAddress: "",
        });

        let message = "Successfully created gift card";
        return { status: 200, data: { message, giftCardDetails } };
      } else {
        let message = "Failed to create gift card";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async validateTokenSell(req: any, res: any) {
    try {
      let { amount, currency, email } = req.body;
      email = String(email).toLowerCase();

      // Fetch user details and transactions
      const user = await uservice.findOneSelect({ email: email }, {});
      const transactions = await transactionService.find({
        email: email,
        currencyRef: currency,
        status: OrderStatus.Completed,
        transactionType: "INVESTMENT",
      });

      // Get available balance in the wallet
      let walletBalance =
        user.userWallets.find((x) => x.coinSymbol === currency)?.coinBalance ||
        0;

      // Calculate total investment amount in the currency
      let totalInvestment = transactions.reduce(
        (sum, txn) => sum + txn.amount,
        0
      );

      // Ensure the amount to be sold is not part of the investment
      if (amount > walletBalance) {
        return {
          status: 400,
          message: "Insufficient balance in the wallet.",
        };
      }

      if (amount > walletBalance - totalInvestment) {
        return {
          status: 400,
          message: `Cannot sell ${amount} ${currency} as it overlaps with your investment balance (${totalInvestment} ${currency}).`,
        };
      }

      return {
        status: 200,
        message: `Transaction allowed. ${amount} ${currency} can be sold.`,
        availableBalance: walletBalance,
        investmentBalance: totalInvestment,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addPersonalInfo(req: any, res: any) {
    try {
      let user = await uservice.findOneSelect(
        {
          email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (user) {
        let updateUser = await uservice.updatePart(
          { _id: user._id, email: user.email },
          {
            $set: {
              country: req.body.country,
              personalIdNumber: req.body.personalIdNumber,
            },
          }
        );
        if (updateUser) {
          const message = "Country and Personal Id number added";
          return { status: 200, data: message };
        } else {
          const message = "error while adding Country and Personal Id number";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (error) {
      return { status: 500, data: error };
    }
  }

  async sendGiftCard(req: any, res: any) {
    try {
      const {
        giftcardVoucher,
        senderEmail,
        recevierEmail,
        senderMessage,
        senderName,
        selectedImgUrl,
      } = req.body;

      let validateGiftCard = await newGiftCardService.findOne({
        voucher: giftcardVoucher,
      });
      if (!validateGiftCard.isUsed) {
        let user = await uservice.findOne({
          email: String(senderEmail).toLowerCase(),
        });
        const getSenderName = (user: any) => {
          const { firstName, lastName, email } = user;
          if (
            firstName &&
            lastName &&
            firstName.trim() !== "" &&
            lastName.trim() !== ""
          ) {
            return `${firstName} ${lastName}`;
          }
          return email;
        };
        const email = String(senderEmail).toLowerCase();
        const toEmail = String(recevierEmail).toLowerCase();
        const giftcardType = `${validateGiftCard.cardType}`;
        const senderFullName = senderName ? senderName : getSenderName(user);
        const giftToken = validateGiftCard.type;
        const giftTokenAmount = validateGiftCard.amount;
        const messageFromSender = senderMessage;
        const redeemCode = validateGiftCard.voucher;
        const usdRate = await getPriceByName(validateGiftCard.type);
        let amountInUsd = usdRate.data * giftTokenAmount;
        await new SendEmail().sendGiftCardNotification(
          email,
          toEmail,
          giftcardType,
          senderFullName,
          giftToken,
          giftTokenAmount,
          messageFromSender,
          redeemCode,
          String(selectedImgUrl),
          amountInUsd
        );

        let updateGiftCard = await newGiftCardService.updatePart(
          {
            voucher: giftcardVoucher,
          },
          {
            $set: {
              assignedToUser: toEmail,
            },
          }
        );

        let message = "Successfully created gift card";
        return { status: 200, data: { message } };
      } else {
        let message = "Failed to send gift card it is already used";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async withdrawDEXRewards(req: any, res: any) {
    try {
      let { userWallerAddress, amount } = req.body;
      let user = await uservice.findOneSelect(
        { walletAddress: userWallerAddress },
        this.userLiteFields
      );
      let getUserRewards = await rewardService.findOne({
        rewardTokenAddress: userWallerAddress,
      });
      if (user && getUserRewards) {
        let rewardAmount = getUserRewards.totalRewards;
        if (amount <= rewardAmount) {
          console.log("amount", amount * 0.1);
          let tokenWithdraw =
            await indexxTokenService.transferIndexxExchangebyAdmin(
              getUserRewards.rewardTokenAddress,
              amount * 0.1, //0.1 is the price of token in usd, ui gives value in usd
              "dex-user-email",
              "Withdraw rewards from trade to earn",
              "Withdraw_Rewards",
              "DEX"
            );
          if (tokenWithdraw) {
            console.log("currenct reward", rewardAmount);
            let updateReward = await rewardService.updatePart(
              { rewardTokenAddress: userWallerAddress },
              {
                $set: {
                  totalRewards: rewardAmount - amount * 0.1,
                  rewardTokenBalanceInUSD: rewardAmount * 0.1 - amount,
                },
              }
            );
            if (updateReward) {
              const message = "rewardWithdrawn";
              return {
                status: 200,
                data: { message: message, txData: tokenWithdraw },
              };
            } else {
              const message = "errorWhileWithdrawingReward";
              return { status: 500, data: message };
            }
          } else {
            return { status: 500, data: "Failed to withdraw" };
          }
        } else {
          const message = "insufficientReward";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Or Reward Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateFavCurrencies(req: any, res: any) {
    try {
      let { email, favCurrencies } = req.body;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      //udpate fav currencies
      let existingFavCurrecies = user.favouriteCurrencies;
      if (user) {
        let updateFavCurrencies = await uservice.updatePart(
          { email: email },
          {
            $set: {
              favouriteCurrencies: existingFavCurrecies.push(favCurrencies),
            },
          }
        );
        if (updateFavCurrencies) {
          const message = "favCurrenciesUpdated";
          return { status: 200, data: message };
        } else {
          const message = "errorWhileUpdatingFavCurrencies";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateReward(req: any, res: any) {
    try {
      let { email, rewardAmount } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOneSelect(
        { email: email },
        this.registerFields
      );
      if (user) {
        let getUserRewards = await rewardService.findOne({ email: email });
        if (getUserRewards) {
          let updateReward = await rewardService.updatePart(
            { "user.email": email },
            {
              $set: {
                totalRewards: rewardAmount,
              },
            }
          );
          if (updateReward) {
            const message = "rewardAdded";
            return { status: 200, data: message };
          } else {
            const message = "errorWhileAddingReward";
            return { status: 500, data: message };
          }
        } else {
          let newReward = {
            userId: user._id,
            email: user.email,
            referralCode: "Reward for order",
            totalRewards: rewardAmount,
            rewardCurrency: "Indexx Exchange Token",
            rewardTokenBalanceInUSD: rewardAmount * 0.1,
            rewardUpdatedOn: new Date(),
            rewardTokenPrice: 0.1,
            rewardCurrencySymbol: "INEX",
            rewardCurrencyDecimals: 18,
            rewardTokenAddress: "",
          };
          let addReward = await rewardService.create(newReward);
          if (addReward) {
            const message = "rewardAdded";
            return { status: 200, data: message };
          } else {
            const message = "errorWhileAddingReward";
            return { status: 500, data: message };
          }
        }
      } else {
        const message = "No user found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateRewardWalletAddress(req: any, res: any) {
    try {
      let { email, rewardWalletAddress } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      let userWallet = await rewardService.findOne({ email: email });
      if (userWallet) {
        let updateReward = await rewardService.updatePart(
          { "user.email": email },
          {
            $set: {
              rewardTokenAddress: rewardWalletAddress,
            },
          }
        );
        if (updateReward) {
          const message = "Reward Wallet Address Updated";
          return { status: 200, data: message };
        } else {
          const message = "Error While Updating Reward Wallet Address";
          return { status: 500, data: message };
        }
      } else {
        let createNewRewardWallet = {
          userId: user._id,
          email: user.email,
          referralCode: "Reward for order",
          totalRewards: 0,
          rewardCurrency: "Indexx Exchange Token",
          rewardTokenBalanceInUSD: 0,
          rewardUpdatedOn: new Date(),
          rewardTokenPrice: 0.1,
          rewardCurrencySymbol: "INEX",
          rewardCurrencyDecimals: 18,
          rewardTokenAddress: rewardWalletAddress,
        };
        let addReward = await rewardService.create(createNewRewardWallet);
        const message = "Wallet created and updated the wallet address";
        return { status: 200, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createBug(req: any, res: any) {
    try {
      let { email, description, bugfiles } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOne({
        email: email,
      });
      if (user) {
        let bugFilesArray = [];
        for (let i = 0; i < bugfiles.length; i++) {
          let bugfile = {
            fileType: bugfiles[i].type,
            fileMode: "Standard",
            title: bugfiles[i].name,
            uniqueName: bugfiles[i].uid,
            original:
              "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-user-bugs-list/" +
              bugfiles[i].name,
          };
          console.log("created", bugfile);
          bugFilesArray.push(bugfile);
        }

        let newBug: UserBugs = {
          userId: user._id,
          email: user.email,
          bugDescription: description,
          bugTitle: "User Created Bug",
          bugDate: new Date(),
          bugStatus: "Created",
          bugComments: "",
          bugFile: bugFilesArray,
        } as UserBugs;

        let addBug = await bugService.create(newBug);
        if (addBug) {
          return { status: 200, data: addBug };
        } else {
          const message = "Error While Creating Bug";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBugs(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOne({
        email: email,
      });
      if (user) {
        let getBugs = await bugService.find({
          email: email,
        });
        if (getBugs.length > 0) {
          return { status: 200, data: getBugs };
        } else {
          const message = "No Bugs Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateBug(req: any, res: any) {
    try {
      let { adminEmail, bugId, bugStatus, bugComments } = req.body;
      adminEmail = String(adminEmail).toLowerCase();

      let getBug = await bugService.findOne({
        _id: bugId,
      });
      if (adminEmail !== getBug.email) {
        if (getBug) {
          let updateBug = await bugService.updatePart(
            { _id: bugId },
            {
              $set: {
                bugStatus: bugStatus,
                adminComments: bugComments,
              },
            }
          );
          return { status: 200, data: updateBug };
        } else {
          const message = "No Bug Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "You are not allowed to update the bug";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getTaskCenterDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOne({
        email: email,
      });
      if (user) {
        let getTaskCenterDetails = await taskCenterService.findOne({
          email: email,
        });
        if (getTaskCenterDetails !== undefined) {
          return { status: 200, data: getTaskCenterDetails };
        } else {
          const message = "No Task Center Details Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async enableTradeToEarn(req: any, res: any) {
    try {
      let { email } = req.body;
      email = String(email).toLowerCase();

      let user = await uservice.findOne({
        email: email,
      });
      if (user) {
        let getTaskCenterDetails = await taskCenterService.findOne({
          email: email,
        });
        if (getTaskCenterDetails !== undefined) {
          let pointHistoryObj = {
            email: email,
            type: "Unlocked Trade To Earn",
            points: 100 * -1,
            date: new Date(),
          };
          let updateTaskCenterDetails = await taskCenterService.updatePart(
            { email: email },
            {
              $set: {
                tradeToEarnPercentage: tradeToEarnPercentage,
                totalPoints: getTaskCenterDetails.totalPoints - 100,
              },
              $push: {
                pointsHistory: pointHistoryObj,
              },
            }
          );
          return { status: 200, data: updateTaskCenterDetails };
        } else {
          const message = "No Task Center Details Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "No User Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getPaypalOrder(req: any, res: any) {
    try {
      let { token } = req.params;
      let getPaypalOrder = await paypalService.findOne({
        paypalId: token,
      });
      if (getPaypalOrder) {
        let getOrder = await orderService.findOne({
          orderId: getPaypalOrder.orderId,
        });
        if (getOrder) {
          return { status: 200, data: getOrder };
        } else {
          const message = "No Order Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "No Paypal Order Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }


  async getReferralsByUser(req: any, res: any) {
    try {
      const email = String(req.params.email).toLowerCase().trim();

      // Get user
      const user = await uservice.findOneSelect(
        { email },
        { referralCode: 1 }
      );

      if (!user?.referralCode) {
        return { status: 404, data: "User not found or no referral code" };
      }

      // Get referred users (only needed fields)
      const referredUsers = await uservice.findSelect(
        { referralCodeUsed: user.referralCode },
        {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          username: 1,
          referralCode: 1,
          profilePic: 1,
          kycStatus: 1,
          isKYCPass: 1,
        }
      );

      if (!referredUsers.length) {
        return { status: 200, data: { userDetails: [], count: 0 } };
      }

      // Batch balances
      const emails = referredUsers.map(u => u.email.toLowerCase());
      const balances = await userMiningBalance.find({
        email: { $in: emails },
        coinSymbol: "BTCY"
      });
      const balanceMap = Object.fromEntries(balances.map(b => [b.email, b]));

      // Batch mining data (if supported)
      const miningDataAll = await miningService.getMiningDataBulk(emails, "BTCY");
      const miningMap = Object.fromEntries(miningDataAll.map((d: any) => [d.email, d]));

      // Merge results
      const userDetails = referredUsers.map(u => ({
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        phone: u.phone || "N/A",
        balance: balanceMap[u.email.toLowerCase()]?.unverifiedBalance || 0,
        isMining: miningMap[u.email]?.isMiningActive || false,
        profilePic: u.profilePic || null,
        username: u.username || "",
        referralCode: u.referralCode,
        kycStatus: u.kycStatus || "",
        isKYCPass: Boolean(u.isKYCPass),
      }));

      return {
        status: 200,
        data: { userDetails, count: userDetails.length }
      };
    } catch (err) {
      console.error("Error fetching referrals:", err);
      return { status: 500, data: "Internal server error" };
    }
  }

  async validateReferralCode(req: any, res: any) {
    try {
      const referralCode = String(req.params.referralCode).trim();

      if (!referralCode) {
        return {
          message: "Referral code is required",
        };
      }

      // Find the user who owns this referral code
      const referrer = await uservice.findOne({ referralCode });

      if (!referrer) {
        return {
          message: "Referral code is required",
        };
      }

      // **Fetch mining status for referrer**
      let miningData = null;
      try {
        miningData = await miningService.getMiningData(referrer.email, "BTCY");
      } catch (err) {
        console.error("Error fetching mining data:", err);
      }

      // Find users who used this referral code
      const referredUsers = await uservice.find({ referralCodeUsed: referralCode });

      return {
        message: "Valid referral code",
        referrer: {
          id: referrer._id,
          name: referrer?.firstName + " " + referrer?.lastName,
          email: referrer.email,
          isMining: miningData?.isMiningActive || false,
        },
        totalReferred: referredUsers.length,
      }
    } catch (error) {
      console.error("Error validating referral code:", error);
      return { status: 500, data: error };
    }
  }


  async getPaypalSubscription(req: any, res: any) {
    try {
      let { subscriptionId } = req.params;

      let getMySubscription = await getSubscriptionDetails(subscriptionId);

      let getSubscriptionDetailsFromDB =
        await paypalSubscriptionService.findOne({
          subscriptionId: subscriptionId,
        });

      if (getMySubscription && getSubscriptionDetailsFromDB) {
        let paypalSubscriptionData = {
          paypalSubscriptionData: getMySubscription,
          paypalSubscriptionDataFromDb: getSubscriptionDetailsFromDB,
        };
        return { status: 200, data: paypalSubscriptionData };
      } else {
        const message = "No Paypal Order Found";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getPermissions(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();

      console.log("update permission", email);
      let getEmailUser = await uservice.findOne({
        email: email,
      });
      if (getEmailUser) {
        let referrerCode = getEmailUser.referralCodeUsed;
        let getReferredUser = await uservice.findOne({
          referralCode: referrerCode,
        });

        let userPermissions = getReferredUser.relationships.find(
          (rel) => rel.honeybeeEmail === email
        );
        console.log("oldPermission", userPermissions);
        if (getReferredUser && userPermissions) {
          console.log("userPermissions", userPermissions);
          return {
            status: 200,
            data: userPermissions,
          };
        } else {
          return {
            status: 500,
            data: "Could not Fetch Permissions for you email.",
          };
        }
      } else {
        return {
          status: 500,
          data: "Email not Found",
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updatePermissions(req: any, res: any) {
    try {
      //convertPermission,
      //buyPermission,
      //sellPermission
      let email = String(req.body.email).toLowerCase();
      let sellPermission = req.body.sellPermission;
      let buyPermission = req.body.buyPermission;
      let convertPermission = req.body.convertPermission;

      console.log(
        "update permission",
        email,
        buyPermission,
        sellPermission,
        convertPermission
      );
      let getEmailUser = await uservice.findOne({
        email: email,
      });
      if (getEmailUser) {
        let referrerCode = getEmailUser.referralCodeUsed;
        let getReferredUser = await uservice.findOne({
          referralCode: referrerCode,
        });
        let isCaptainPermissions = true;
        let oldPermission = getReferredUser.captainBeeRelationShips.find(
          (rel) => rel.captainBeeEmail === email
        ) as any;

        if (!oldPermission) {
          isCaptainPermissions = false;
          oldPermission = getReferredUser.relationships.find(
            (rel) => rel.honeybeeEmail === email
          );
        }
        console.log("oldPermission", oldPermission, isCaptainPermissions);
        if (getReferredUser) {
          if (!isCaptainPermissions) {
            console.log("updating the honeybee perimsionss");
            let updateCaptainBeePermissions = await uservice.updatePart(
              {
                email: getReferredUser.email,
                "relationships.captainBeeEmail": getReferredUser.email,
                "relationships.honeybeeEmail": email,
              },
              {
                $set: {
                  "relationships.$.permissions.buy":
                    buyPermission !== undefined
                      ? buyPermission
                      : oldPermission?.permissions.buy,
                  "relationships.$.permissions.buyApprovedOn":
                    buyPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.buyApprovedOn,
                  "relationships.$.permissions.sell":
                    sellPermission !== undefined
                      ? sellPermission
                      : oldPermission?.permissions.sell,
                  "relationships.$.permissions.sellApprovedOn":
                    sellPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.sellApprovedOn,
                  "relationships.$.permissions.convert":
                    convertPermission !== undefined
                      ? convertPermission
                      : oldPermission?.permissions.convert,
                  "relationships.$.permissions.convertApprovedOn":
                    convertPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.convertApprovedOn,
                },
              }
            );

            console.log(
              "updateCaptainBeePermissions",
              updateCaptainBeePermissions
            );
          } else {
            console.log("updating the captainbee perimsionss");

            let updateCaptainBeePermissions = await uservice.updatePart(
              {
                email: getReferredUser.email,
                "captainBeeRelationShips.mainCaptainBeeEmail":
                  getReferredUser.email,
                "captainBeeRelationShips.captainBeeEmail": email,
              },
              {
                $set: {
                  "captainBeeRelationShips.$.permissions.buy":
                    buyPermission !== undefined
                      ? buyPermission
                      : oldPermission?.permissions.buy,
                  "captainBeeRelationShips.$.permissions.buyApprovedOn":
                    buyPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.buyApprovedOn,
                  "captainBeeRelationShips.$.permissions.sell":
                    sellPermission !== undefined
                      ? sellPermission
                      : oldPermission?.permissions.sell,
                  "captainBeeRelationShips.$.permissions.sellApprovedOn":
                    sellPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.sellApprovedOn,
                  "captainBeeRelationShips.$.permissions.convert":
                    convertPermission !== undefined
                      ? convertPermission
                      : oldPermission?.permissions.convert,
                  "captainBeeRelationShips.$.permissions.convertApprovedOn":
                    convertPermission !== undefined
                      ? new Date().toISOString()
                      : oldPermission?.permissions.convertApprovedOn,
                },
              }
            );

            console.log(
              "updateCaptainBeePermissions",
              updateCaptainBeePermissions
            );
            let findUpdated = await uservice.findOne({
              email: getReferredUser.email,
              "captainBeeRelationShips.mainCaptainBeeEmail":
                getReferredUser.email,
              "captainBeeRelationShips.captainBeeEmail": email,
            });
            console.log("find updated", findUpdated.captainBeeRelationShips);
          }
          return {
            status: 200,
            data: "Updated the permissions successfully",
          };
        } else {
          return {
            status: 500,
            data: "Could not Fetch Captain bee for your email.",
          };
        }
      } else {
        return {
          status: 500,
          data: "Email not Found",
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async saveUserProfile(req: any, res: any) {
    try {
      const resolvedEmail = this.resolveProfileEmail(req);
      if (!resolvedEmail.email) {
        return {
          status: resolvedEmail.status || 400,
          message: resolvedEmail.message || "Email is required",
          data: null,
        };
      }

      const email = resolvedEmail.email;
      const user = await uservice.findOne({ email });
      if (!user) {
        return {
          status: 404,
          message: "User not found",
          data: null,
        };
      }

      const updatePayload = this.normalizeProfileUpdatePayload(req.body);
      if (Object.keys(updatePayload).length === 0) {
        return {
          status: 400,
          message: "No profile fields provided to update",
          data: null,
        };
      }

      await uservice.updatePart(
        { _id: user._id, email },
        {
          $set: updatePayload,
        }
      );

      const updatedUser = await uservice.findOneSelect(
        { email },
        {
          email: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          phone: 1,
          country: 1,
          walletAddress: 1,
          profilePic: 1,
          bio: 1,
          isPhonePublic: 1,
          isEmailPublic: 1,
        }
      );

      return {
        message: "User profile saved successfully",
        status: 200,
        data: this.buildUserProfileResponse(updatedUser),
      };
    } catch (err) {
      return { status: 500, message: "Error saving user profile", data: err };
    }
  }

  async updateUserProfile(req: any, res: any) {
    return this.saveUserProfile(req, res);
  }

  async getUserProfile(req: any, res: any) {
    try {
      let email = String(req.params?.email).trim().toLowerCase();
      if (!email) {
        return { status: 400, message: "Email is required", data: null };
      }

      const projection = {
        email: 1,
        referralCode: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        phone: 1,
        country: 1,
        walletAddress: 1,
        profilePic: 1,
        bio: 1,
        isPhonePublic: 1,
        isEmailPublic: 1,
        kycStatus: 1,
        isKYCPass: 1,
      };

      const user = await uservice.findOneSelect({ email }, projection);

      if (!user) {
        return { status: 404, message: "User not found", data: null };
      }

      return {
        status: 200,
        message: "OK",
        data: this.buildUserProfileResponse(user),
      };
    } catch (err) {
      return { status: 500, message: "Error fetching user profile", data: err };
    }
  }


  async updateUserLanguage(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      const selectedLanguage = languageMap[req.body.languageSelected] || Languages.US;

      let getUserByEmail = await uservice.findOne({ email: email });

      if (!getUserByEmail) {
        return {
          message: "No user exists with this email",
          status: 404,
          data: null
        };
      }

      let updateUser = await uservice.updatePart(
        { email: email },
        { $set: { language: selectedLanguage } }
      );

      let updatedUser = await uservice.findOne({ email: email });

      return {
        message: "Language updated successfully",
        status: 200,
        data: updatedUser
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addPhoneNumber(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      const phoneNumber = req.body.phoneNumber;

      let getUserByEmail = await uservice.findOne({ email: email });

      if (!getUserByEmail) {
        return {
          message: "No user exists with this email",
          status: 404,
          data: null
        };
      }

      let updateUser = await uservice.updatePart(
        { email: email },
        { $set: { phone: phoneNumber } }
      );

      let updatedUser = await uservice.findOne({ email: email });

      return {
        message: "Phone number added successfully",
        status: 200,
        data: updatedUser
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async reportCompromisedAccount(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      const additionalDetails = req.body.additionalDetails || '';

      let getUserByEmail = await uservice.findOne({ email: email });

      if (!getUserByEmail) {
        return {
          message: "No user exists with this email",
          status: 404,
          data: null
        };
      }

      // Send email notification
      const emailResult = await new SendEmail().sendCompromisedAccountReport(
        email,
        getUserByEmail.firstName || 'User',
        additionalDetails,
        req.body.website
      );

      if (emailResult.status !== 200) {
        return { status: 500, message: "Failed to send email notification", data: null }
      }

      return {
        message: "Compromised account reported successfully. Our team will contact you shortly.",
        status: 200,
        data: null
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async selfReportFakeAccount(req: any, res: any) {
    try {
      const { email, currentUsername, realUsername, website } = req.body;

      // Get user by email
      const user = await uservice.findOne({ email });
      if (!user) {
        return {
          message: "User not found",
          status: 404,
          data: null
        };
      }

      // Send email notification
      const emailResult = await new SendEmail().sendFakeAccountReport(
        email,
        user.firstName || 'User',
        currentUsername,
        realUsername,
        website
      );

      if (emailResult.status !== 200) {
        throw new Error("Failed to send notification email");
      }

      // Optionally mark account as reported
      await uservice.updatePart(
        { email },
        { $set: { isReported: true, reportReason: 'self-reported-fake' } }
      );

      return {
        message: "Fake account reported successfully. Our team will investigate.",
        status: 200,
        data: null
      }

    } catch (err: any) {
      console.error("Self report error:", err);
      return { status: 500, data: err };
    }
  }

  async deleteAccount(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      const token = req.headers.authorization.split(' ')[1];
      const claims = jwt.decode(token) as { email: string };
      const authenticatedEmail = claims?.email;
      if (!authenticatedEmail) {
        return { status: 401, data: { message: "Authentication required. Please login first." } };
      }

      if (email !== authenticatedEmail) {
        return { status: 401, data: { message: "Unauthorized. You can only delete your own account." } };
      }

      let deleteResult = await uservice.deleteOne({ email: email });
      if (deleteResult.deletedCount === 0) {
        return {
          message: "No user exists with this email",
          status: 404,
          data: null
        };
      }

      let deleteResults = await wuserservice.deleteOne({ email: email });
      let deleteResults0 = await miningService.deleteOne({ email: email });
      let deleteResults1 = await userMiningBalance.deleteOne({
        email: email,
      });
      try {
        // delete from academy
        const deleteAcademyResult = await axios.delete("https://academy.indexx.ai/api/users/delete", {
          data: {
            email: email
          }
        });
      } catch (err) {
        console.log("=====>>>>>>>err- Academy", err);
      }

      return {
        message: "Account deleted successfully",
        status: 200,
        data: null
      };
    } catch (err) {
      console.log("=====>>>>>>>err", err);
      return { status: 500, data: err };
    }
  }


  async deleteAccountWithEmail(req: any, res: any) {
    try {
      let email = String(req.params.email).toLowerCase();

      let deleteResult = await uservice.deleteOne({ email: email });

      console.log(deleteResult, email);
      if (deleteResult.deletedCount === 0) {
        return {
          message: "No user exists with this email",
          status: 200,
          data: null
        };
      }

      return {
        message: "Account deleted successfully",
        status: 200,
        data: null
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getReferredUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await uservice.findOneSelect({ email: email }, {});
      const timestamp = mongoose.Types.ObjectId(user._id).getTimestamp();
      console.log("Creation date:", timestamp);
      const date = new Date(timestamp);
      const options = {
        year: "numeric",
        month: "long",
        day: "numeric",
      } as any;
      const formattedDate = date.toLocaleDateString("en-US", options);
      user.accountCreationDate = formattedDate;

      let refferedUserFullData;
      if (user?.referralCodeUsed) {
        let referredUserData = await uservice.findOne({
          referralCode: user.referralCodeUsed,
        });
        let refferedUserAffilateData = await affilateService.findOne({
          Email: referredUserData.email,
        });
        let getPowerPackData = await powerPackService.findOne({
          email: referredUserData.email,
        });
        let affiliateUsersCount = refferedUserAffilateData?.honeyBees?.length;
        let captainBeeUsersCount =
          refferedUserAffilateData?.captainBees?.length;
        let affiliateUserManagedOrders =
          refferedUserAffilateData?.orderCount === undefined
            ? 0
            : refferedUserAffilateData?.orderCount;
        refferedUserFullData = {
          userData: user,
          referredUserData: referredUserData,
          refferedUserAffilateData: refferedUserAffilateData,
          accountCreationDate: formattedDate,
          totalOrder: affiliateUserManagedOrders,
          honeyBeesCount: affiliateUsersCount,
          captainBeeCount: captainBeeUsersCount,
          powerPackData:
            getPowerPackData === undefined ? undefined : getPowerPackData,
        };
      }
      if (user) {
        return { status: 200, data: refferedUserFullData };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserDashboardData(req: any, res: any, username: string) {
    try {
      console.log(username);
      let getUserByUsername1 = await uservice.findOne({
        username: username,
      });
      let getUserByUsername2 = await affilateService.findOne({
        Username: username,
      });
      if (getUserByUsername1) {
        let getUserFullData = await uservice.findOne({
          email: getUserByUsername1.email,
        });
        console.log(
          "getAffilatedUserFullData : ",
          getUserFullData.relationships
        );

        const timestamp = mongoose.Types.ObjectId(
          getUserFullData._id
        ).getTimestamp();
        console.log("Creation date:", timestamp);
        getUserByUsername1.accountCreationDate = timestamp;

        const date = new Date(timestamp);
        const userOrdersCount = await orderService.find({
          "user.email": getUserByUsername1.email,
          status: "Completed",
        });
        const options = {
          year: "numeric",
          month: "long",
          day: "numeric",
        } as any;
        const formattedDate = date.toLocaleDateString("en-US", options);
        let referredUserData = await uservice.findOneSelect(
          {
            referralCode: getUserFullData.referralCodeUsed,
          },
          {
            userWallets: 0,
          }
        );
        let referredAffiliateUserData = await affilateService.findOne({
          Email: referredUserData.email,
        });
        console.log("referredUserData", referredUserData);
        let refferedFullUserData = {
          data: referredUserData,
          data2: referredAffiliateUserData,
        };
        let userData = {
          ordersCount: userOrdersCount.length,
          accountCreationDate: timestamp,
          formatedAccountCreationDate: formattedDate,
          userFullData: getUserFullData,
          referredUserData: refferedFullUserData,
        };

        return {
          message: "User Data",
          status: 200,
          data: userData,
        };
      } else if (getUserByUsername2) {
        console.log("getUserByUsername2.Email", getUserByUsername2.Email);
        let getUserFullData = await uservice.findOne({
          email: getUserByUsername2.Email,
        });
        console.log(
          "getAffilatedUserFullData : ",
          getUserFullData.relationships
        );

        const timestamp = mongoose.Types.ObjectId(
          getUserFullData._id
        ).getTimestamp();
        console.log("Creation date:", timestamp);
        getUserByUsername2.accountCreationDate = timestamp;

        const date = new Date(timestamp);
        const userOrdersCount = await orderService.find({
          "user.email": getUserByUsername2.Email,
          status: "Completed",
        });
        const options = {
          year: "numeric",
          month: "long",
          day: "numeric",
        } as any;
        const formattedDate = date.toLocaleDateString("en-US", options);
        let referredUserData = await uservice.findOneSelect(
          {
            referralCode: getUserFullData.referralCodeUsed,
          },
          {
            userWallets: 0,
          }
        );
        let referredAffiliateUserData = await affilateService.findOne({
          Email: referredUserData.email,
        });
        console.log(
          "referredUserData referralCodeUsed",
          getUserFullData.referralCodeUsed
        );
        console.log("referredUserData", referredUserData);
        let refferedFullUserData = {
          data: referredUserData,
          data2: referredAffiliateUserData,
        };
        let userData = {
          ordersCount: userOrdersCount.length,
          accountCreationDate: timestamp,
          formatedAccountCreationDate: formattedDate,
          userFullData: getUserFullData,
          referredUserData: refferedFullUserData,
        };

        return {
          message: "User Data",
          status: 200,
          data: userData,
        };
      } else {
        const data = {
          message: "No Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async requestPermissions(req: any, res: any) {
    try {
      console.log(req.body.captainBeeEmail);
      let getCaptainBeeByEmail = await uservice.findOne({
        email: String(req.body.captainBeeEmail).toLowerCase(),
      });

      let getHoneyBeeByEmail = await uservice.findOne({
        email: String(req.body.honeyBeeEmail).toLowerCase(),
      });

      if (getCaptainBeeByEmail && getHoneyBeeByEmail) {
        // send email to user after completion
        let res = await new SendEmail().getPermissionsFromHoneyBee(
          req.body.captainBeeEmail,
          getCaptainBeeByEmail?.firstName,
          req.body.honeyBeeEmail,
          getHoneyBeeByEmail.firstName,
          req.body.requestType
        );
        console.log(res);
        if (res.status === 200) {
          return {
            message: `Email sent to Honey Bee successfully to ${req.body.requestType} order permission.`,
            status: 200,
            data: res,
          };
        } else {
          return {
            message: `Failed to send email to Honey Bee to ${req.body.requestType} order permission.`,
            status: 500,
            data: res,
          };
        }
      } else if (getCaptainBeeByEmail) {
        return {
          message: "No Honey Bee exists with email " + req.body.honeyBeeEmail,
          status: 404, // Changed status to 404 (Not Found)
          data: null,
        };
      } else if (getHoneyBeeByEmail) {
        return {
          message: "No Captain exists with email " + req.body.captainBeeEmail,
          status: 404, // Changed status to 404 (Not Found)
          data: null,
        };
      } else {
        return {
          message: "No Captain or Honey Bee exists with the provided emails",
          status: 404, // Changed status to 404 (Not Found)
          data: null,
        };
      }
    } catch (err) {
      const data = {
        message: "Failed to get captain bee and honey bee details",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async updatePowerPackData(
    req: any,
    res: any,
    orderId: string,
    inexValue: number = 0
  ) {
    try {
      console.log("orderId", orderId);
      let getPowerPackData = await powerPackService.findOne({
        orderId: orderId,
      });
      let { email, type, paymentMethodUsed } = getPowerPackData;
      console.log(
        "Here in updatePowerpackdata",
        email,
        type,
        paymentMethodUsed
      );
      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        const currencyRes = await currencyService.findOne({
          currencyType: "Crypto",
          code: "INEX",
        });

        let getRate = {
          currency: currencyRes.code,
          rate: currencyRes.buyPrice,
        } as Rates;

        const packFeesPercentage: { [key: string]: number } = {
          "Starter Pack": 33.33,
          "Excel Pack": 40.0,
          "Pro Pack": 35.71,
          "Captain Pack": 33.33,
          "Copper Pack": 12.86,
          "Gold Pack": 9.09,
          "Platinum Pack": 5.56,
          "Royal Pack": 3.33,
        };

        const packPrices: { [key: string]: number } = {
          "Starter Pack": 300,
          "Excel Pack": 500,
          "Pro Pack": 700,
          "Captain Pack": 1500,
          "Copper Pack": 3500,
          "Gold Pack": 5500,
          "Platinum Pack": 9000,
          "Royal Pack": 15000,
        };

        const purchasedProduct: string = req.body.purchasedProduct;
        const packPrice: number = packPrices[purchasedProduct];
        const feesPercentage: number = packFeesPercentage[purchasedProduct];
        const feesAmount: number = (feesPercentage / 100) * packPrice;
        const remainingValue: number = packPrice - feesAmount;
        let inexToSent = Math.round(remainingValue / getRate.rate);

        //insert into powerpack table
        let updatePowerPackData = await powerPackService.updatePart(
          {
            email: email,
            orderId: orderId,
          },
          {
            $set: {
              purchaseDate: new Date(),
              paymentMethodUsed: paymentMethodUsed,
              paymentStatus: OrderStatus.Completed,
            },
          }
        );

        console.log("updatePowerPackData", updatePowerPackData);
        //update user wallet, add INEX tokens based on product purchased
        let userAddress = getUser.userWallets.find(
          (x) => x.coinSymbol == "INEX"
        );

        let orderDetails = await orderService.findOne({
          orderId: orderId,
        });
        console.log("userAddress", userAddress);

        //update Order
        let updateOrder = await orderService.updatePart(
          {
            _id: orderDetails._id,
          },
          {
            $set: {
              status: "Completed",
              orderCompletedOn: new Date(),
            },
          }
        );
        console.log("updateOrder", updateOrder);

        //update User Wallet
        let updateUserWallet0 = await uservice.updatePart(
          {
            email: getUser.email,
            "userWallets.coinSymbol": "INEX",
          },
          {
            $set: {
              "userWallets.$.coinBalance":
                inexToSent + Number(userAddress?.coinBalance),
              "userWallets.$.coinLastUsedOn": new Date(),
            },
          }
        );
        console.log("updateUserWallet", updateUserWallet0);

        //Staking is started here for powerpack purchase orders which is 1 year staking automatically
        let stakingPercentage = 15 / 100; //APR for INEX 15%

        const tokenPercentageReward = Number(inexToSent) * stakingPercentage;
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
          stakedAmount: Number(inexToSent), // How much the user is staking
          rewardAmount: inexReward, // how reward is gained
          finalAmount: finalAmount, // Final amount the user gets staked + reward
          coin: "INEX",
          rewardCoin: "INEX",
          email: getUser.email,
          percentage: stakingPercentage,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          type: "Long", // Short or Long
          duration: "1 year", // 6 months or 1 year
        } as Staking;

        let createStaking = await stakingService.create(stakeData);

        console.log("createStaking", createStaking);

        // Update the user balance
        let updateUserWallet = await uservice.updatePart(
          {
            email: getUser.email,
            "userWallets.coinSymbol": "INEX",
          },
          {
            // $set: {
            //   coinLastUsedOn: new Date(),
            //   "userWallets.$.coinBalance":
            //     Number(userAddress?.coinBalance) - Number(InexToSent),
            //   "userWallets.$.coinStakedBalance": userAddress?.coinStakedBalance
            //     ? userAddress.coinStakedBalance + Number(InexToSent)
            //     : Number(InexToSent),
            // },
            $set: {
              coinLastUsedOn: new Date(),
              "userWallets.$.coinBalance": Math.max(
                0,
                Number(userAddress?.coinBalance) - Number(inexToSent)
              ),
              "userWallets.$.coinStakedBalance":
                (userAddress?.coinStakedBalance
                  ? Number(userAddress.coinStakedBalance)
                  : 0) + Number(inexToSent),
            },
          }
        );

        console.log("updateUserWallet", updateUserWallet);

        const userName = getUser?.lastName || getUser?.email.split("@")[0];
        let userData = await uservice.findOne({
          email: orderDetails.user.email,
        });
        let maincaptainBeeData = await uservice.findOne({
          referralCode: userData.referralCodeUsed,
        });

        //Update rank based on purchase
        let update = await orderService.UpdateDBForOrderCommission(
          orderDetails.user.email,
          maincaptainBeeData
            ? maincaptainBeeData.email
            : orderDetails.captainBeeEmail,
          orderDetails
        );
        //send email based on the powerpack purchased
        const sentEmail = await new SendEmail().sendCourseAttachmentToUser(
          getUser?.email,
          userName,
          type,
          inexToSent
        );

        // add course to user account on academy
        //todo backup pass academy
        /*
        const url = `${keys.academyBaseUrl.key}/api/powerpackpurchase`;
        let user = {
          buyer_email: getUser?.email,
          purchased_product: type,
        };
        const payload = { ...user };
        const response = await axios.post(url, payload);
        console.log("response", response);
        */
        const emailJob = await emailQueue.add({
          email: getUser?.email,
          userName: userName,
          purchasedProduct: type,
          InexToSent: inexToSent,
        });
        console.log("sentEmail", emailJob);
      } else {
        const data = {
          message: "No Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      console.log("Err", err);
      return data;
    }
  }

  async updateSubscriptionOrder(req: any, res: any, orderId: string) {
    try {
      let orderDetails = await orderService.findOne({
        orderId: orderId,
      });

      //update Order
      let updateOrder = await orderService.updatePart(
        {
          _id: orderDetails._id,
        },
        {
          $set: {
            status: "Completed",
            orderCompletedOn: new Date(),
          },
        }
      );
      console.log("updateOrder", updateOrder);
      let userData = await uservice.findOne({
        email: orderDetails.user.email,
      });
      let maincaptainBeeData = await uservice.findOne({
        referralCode: userData.referralCodeUsed,
      });
      // Check if the referral code is valid and main captain data exists
      if (userData.referralCodeUsed && maincaptainBeeData) {
        // Update rank based on purchase
        const update = await orderService.UpdateDBForOrderCommission(
          orderDetails.user.email,
          maincaptainBeeData.email || orderDetails.captainBeeEmail,
          orderDetails
        );
      }
      return;
    } catch (err: any) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      console.log("Err", err);
      return data;
    }
  }

  async updatePowerPackDataWithOutInex(req: any, res: any, orderId: string) {
    try {
      console.log("orderId", orderId);
      let getPowerPackData = await powerPackService.findOne({
        orderId: orderId,
      });
      let { email, type, paymentMethodUsed } = getPowerPackData;
      console.log(
        "Here in updatePowerpackdata",
        email,
        type,
        paymentMethodUsed
      );
      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        //insert into powerpack table
        let updatePowerPackData = await powerPackService.updatePart(
          {
            email: email,
            orderId: orderId,
          },
          {
            $set: {
              purchaseDate: new Date(),
              paymentMethodUsed: paymentMethodUsed,
              paymentStatus: OrderStatus.Completed,
            },
          }
        );

        console.log("updatePowerPackData", updatePowerPackData);

        let orderDetails = await orderService.findOne({
          orderId: orderId,
        });

        //update Order
        let updateOrder = await orderService.updatePart(
          {
            _id: orderDetails._id,
          },
          {
            $set: {
              status: "Completed",
              orderCompletedOn: new Date(),
            },
          }
        );
        console.log("updateOrder", updateOrder);

        const userName = getUser?.lastName || getUser?.email.split("@")[0];
        let userData = await uservice.findOne({
          email: orderDetails.user.email,
        });
        let maincaptainBeeData = await uservice.findOne({
          referralCode: userData.referralCodeUsed,
        });

        //Update rank based on purchase
        let update = await orderService.UpdateDBForOrderCommission(
          orderDetails.user.email,
          maincaptainBeeData
            ? maincaptainBeeData.email
            : orderDetails.captainBeeEmail,
          orderDetails
        );
        // add course to user account on academy
        // const url = `${keys.academyBaseUrl.key}/api/powerpackpurchase`;
        // let user = {
        //   buyer_email: getUser?.email,
        //   purchased_product: type,
        // };
        // const payload = { ...user };
        // const response = await axios.post(url, payload);
        // console.log("response", response);

        // const emailJob = await emailQueue.add({
        //   email: getUser?.email,
        //   userName: userName,
        //   purchasedProduct: type,
        //   InexToSent: InexToSent,
        // });
        // console.log("sentEmail", emailJob);
      } else {
        const data = {
          message: "No Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      console.log("Err", err);
      return data;
    }
  }

  async postPublicMessages(req: any, res: any) {
    try {
      let getUser = await uservice.findOne({
        email: String(req.body.email).toLowerCase(),
      });
      if (getUser) {
        const createPublicMessage = await publicMessageService.create({
          publicMessage: req.body.message,
          createdData: new Date(),
          createdUsername: getUser.firstName,
          createdUserEmail: getUser.email,
          isActive: true,
          createdFrom: req.body.createdFrom,
        });
        console.log(createPublicMessage);
        return {
          message: "Created a public message successfully",
          status: 200,
          data: null,
        };
      } else {
        return {
          message:
            "No Captain exists with email " +
            String(req.body.email).toLowerCase(),
          status: 404, // Changed status to 404 (Not Found)
          data: null,
        };
      }
    } catch (err) {
      const data = {
        message: "Failed to post public messages",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async getPublicMessages(req: any, res: any) {
    try {
      let email = String(req.params.email).toLowerCase();
      console.log("email", email);
      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        const getAllPublicMessages = await publicMessageService.find({
          email: email,
        });
        console.log(getAllPublicMessages);
        return {
          message: "Public messages fetched",
          status: 200,
          data: getAllPublicMessages,
        };
      } else {
        return {
          message:
            "No Captain exists with email " +
            String(req.params.email).toLowerCase(),
          status: 404, // Changed status to 404 (Not Found)
          data: [],
        };
      }
    } catch (err) {
      return {
        message: "Failed to get public messages",
        status: 500,
        data: [],
      };
    }
  }

  async getPublicMessagesByName(req: any, res: any) {
    try {
      let username = req.params.name;
      console.log("email", username);
      let getUser = await affilateService.findOne({
        Username: username,
      });
      if (getUser) {
        const getAllPublicMessages = await publicMessageService.find({
          createdUserEmail: getUser.Email,
        });
        console.log(getAllPublicMessages);
        return {
          message: "Public messages fetched",
          status: 200,
          data: getAllPublicMessages,
        };
      } else {
        return {
          message:
            "No Captain exists with username " +
            String(req.params.name).toLowerCase(),
          status: 404, // Changed status to 404 (Not Found)
          data: [],
        };
      }
    } catch (err) {
      return {
        message: "Failed to get public messages",
        status: 500,
        data: [],
      };
    }
  }

  async stakeCoin(req: any, res: any) {
    try {
      let { email, coin, type, amount, percentage } = req.body;
      email = String(email).toLowerCase();
      let getUser = await uservice.findOne({ email: email });

      if (!getUser) {
        return {
          message: "User not found",
          status: 404,
          data: {},
        };
      }

      let chain =
        coin === "INEX"
          ? "Binance Smart Chain"
          : coin === "INEX-POLYGON"
            ? "POLYGON"
            : "ETHEREUM";
      let getStakingWallet;

      if (
        coin === "INEX" ||
        coin === "INEX-POLYGON" ||
        coin === "INEX-ETHEREUM"
      ) {
        getStakingWallet = getUser.userWallets.find(
          (x) => x.coinSymbol === coin && x.coinNetwork === chain
        );
      } else {
        getStakingWallet = getUser.userWallets.find(
          (x) => x.coinSymbol === coin
        );
      }

      if (!getStakingWallet) {
        return {
          message: "Coin not found in the user's wallet",
          status: 400,
          data: {},
        };
      }

      if (getStakingWallet.coinBalance < Number(amount)) {
        return {
          message: "Insufficient balance for staking",
          status: 400,
          data: {},
        };
      }

      const specialTokens = ["BTC", "LTC", "ETH", "BCH", "BNB"];
      const minimumRequired = specialTokens.includes(coin) ? 0.01 : 50;

      if (Number(amount) < minimumRequired) {
        return {
          message: `Minimum staking amount must be at least ${minimumRequired}.`,
          status: 400,
          data: {},
        };
      }

      let stakingPercentage = percentage / 100;
      let duration =
        type === "Short" ? "6 months" : type === "Long" ? "1 year" : "1 day";

      if (duration === "1 day") {
        stakingPercentage = 0.00273973; // Approximate daily percentage for a 1-day duration
      }

      const isIndexxToken = (coin: string) =>
        ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);

      const tokenPercentageReward = Number(amount) * stakingPercentage;
      let tokenUsdtValue;

      if (coin === "INEX") {
        tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
      } else if (isIndexxToken(coin)) {
        console.log("indexx tokens");
        const latestBaseRate = await currencyService.findOne({ code: coin });
        tokenUsdtValue = latestBaseRate.buyPrice;
      } else {
        const getCoinPrice = await getPriceByName(coin);
        tokenUsdtValue = getCoinPrice.data;
      }
      const inexReward = tokenPercentageReward * tokenUsdtValue;

      let finalAmount = inexReward;
      // Calculate the endDate based on the duration
      let startDate = new Date();
      let endDate = new Date(startDate);

      if (duration === "1 day") {
        endDate.setDate(startDate.getDate() + 1); // Add 1 day
      } else if (duration === "6 months") {
        endDate.setMonth(startDate.getMonth() + 6);
      } else if (duration === "1 year") {
        endDate.setFullYear(startDate.getFullYear() + 1);
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
        startDate: startDate,
        endDate: endDate,
        isActive: true,
        type: type, // Short or Long
        duration: duration, // 6 months or 1 year
      } as Staking;

      let createStaking = await stakingService.create(stakeData);

      console.log("createStaking", createStaking);

      // Update the user balance
      let updateUserWallet = await uservice.updatePart(
        {
          email: getUser.email,
          "userWallets.coinSymbol": coin,
          ...(coin === "INEX" ||
            coin === "INEX-POLYGON" ||
            coin === "INEX-ETHEREUM"
            ? { "userWallets.coinNetwork": chain }
            : {}),
        },
        {
          $set: {
            coinLastUsedOn: new Date(),
            "userWallets.$.coinBalance":
              getStakingWallet.coinBalance - Number(amount),
            "userWallets.$.coinStakedBalance":
              getStakingWallet?.coinStakedBalance
                ? getStakingWallet.coinStakedBalance + Number(amount)
                : Number(amount),
          },
        }
      );

      console.log("updateUserWallet", updateUserWallet);

      const data = {
        message: `Successfully staked ${coin}`,
        status: 200,
        data: createStaking,
      };
      return data;
    } catch (err) {
      console.error("Error:", err);
      return {
        message: "Internal server error",
        status: 500,
        data: {},
      };
    }
  }

  async smartApyInvest(req: any, res: any) {
    try {
      let { email, coin, duration, amount, percentage, paymentMethod } = req.body;
      if (paymentMethod === "CreditCard" || paymentMethod === "Paypal") {
        console.log("req.body", req.body);
        email = String(email).toLowerCase();
        let getUser = await uservice.findOne({ email: email });

        if (!getUser) {
          return {
            message: "User not found",
            status: 404,
            data: {},
          };
        }

        let chain =
          coin === "INEX"
            ? "Binance Smart Chain"
            : coin === "INEX-POLYGON"
              ? "POLYGON"
              : "ETHEREUM";
        let getStakingWallet;

        if (
          coin === "INEX" ||
          coin === "INEX-POLYGON" ||
          coin === "INEX-ETHEREUM"
        ) {
          getStakingWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === coin && x.coinNetwork === chain
          );
        } else {
          getStakingWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === coin
          );
        }

        if (!getStakingWallet) {
          return {
            message: "Coin not found in the user's wallet",
            status: 400,
            data: {},
          };
        }


        const specialTokens = ["BTC", "LTC", "ETH", "BCH", "BNB"];
        const minimumRequired = specialTokens.includes(coin) ? 0.01 : 50;

        if (Number(amount) < minimumRequired) {
          return {
            message: `Minimum staking amount must be at least ${minimumRequired}.`,
            status: 400,
            data: {},
          };
        }

        let stakingPercentage = percentage / 100;

        const isIndexxToken = (coin: string) =>
          ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);

        const tokenPercentageReward = Number(amount) * stakingPercentage;
        let tokenUsdtValue;

        if (coin === "INEX") {
          tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
        } else if (isIndexxToken(coin)) {
          console.log("indexx tokens");
          const latestBaseRate = await currencyService.findOne({ code: coin });
          tokenUsdtValue = latestBaseRate.buyPrice;
        } else {
          const getCoinPrice = await getPriceByName(coin);
          tokenUsdtValue = getCoinPrice.data;
        }
        const finalReward = tokenPercentageReward;

        let finalAmount = finalReward;
        // Calculate the endDate based on the duration
        let startDate = new Date();
        let endDate = new Date(startDate);

        if (duration === "1 day") {
          endDate.setDate(startDate.getDate() + 1); // Add 1 day
        } else if (duration === "6 months") {
          endDate.setMonth(startDate.getMonth() + 6);
        } else if (duration === "1 year") {
          endDate.setFullYear(startDate.getFullYear() + 1);
        } else if (duration === "12 months") {
          endDate.setMonth(startDate.getMonth() + 12);
        } else if (duration === "18 months") {
          endDate.setFullYear(startDate.getMonth() + 18);
        }

        let stakeData = {
          smartApyId: uuidv1(),
          stakedAmount: Number(amount), // How much the user is staking
          rewardAmount: finalReward, // how much reward is gained
          finalAmount: finalAmount + Number(amount), // Final amount the user gets staked + reward
          coin: coin,
          rewardCoin: coin,
          email: getUser.email,
          percentage: stakingPercentage,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          duration: duration, // 6 months or 1 year
        } as SmartApy;

        let createStaking = await smartAPYService.create(stakeData);

        console.log("createStaking", createStaking);
        console.log("finalAmount + Number(amount)", finalAmount + Number(amount))
        let txType = "Smart APY Investment";
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
          amountInvested: tokenUsdtValue,
          notes: `Smart APY Investment for ${duration} with percentage ${percentage}% start data: ${startDate}, end date:${endDate}`,
          rate: tokenUsdtValue,
        } as Transaction;
        let createTx = await transactionService.create(transaction);

        // Update the user balance
        let updateUserWallet = await uservice.updatePart(
          {
            email: getUser.email,
            "userWallets.coinSymbol": coin,
            ...(coin === "INEX" ||
              coin === "INEX-POLYGON" ||
              coin === "INEX-ETHEREUM"
              ? { "userWallets.coinNetwork": chain }
              : {}),
          },
          {
            $set: {
              coinLastUsedOn: new Date(),
              "userWallets.$.coinStakedBalance":
                Number(amount),
            },
          }
        );

        console.log("updateUserWallet", updateUserWallet);

        const data = {
          message: `Successfully staked ${coin}`,
          status: 200,
          data: createStaking,
        };
        return data;
      } else {
        console.log("req.body", req.body);
        email = String(email).toLowerCase();
        let getUser = await uservice.findOne({ email: email });

        if (!getUser) {
          return {
            message: "User not found",
            status: 404,
            data: {},
          };
        }

        let chain =
          coin === "INEX"
            ? "Binance Smart Chain"
            : coin === "INEX-POLYGON"
              ? "POLYGON"
              : "ETHEREUM";
        let getStakingWallet;

        if (
          coin === "INEX" ||
          coin === "INEX-POLYGON" ||
          coin === "INEX-ETHEREUM"
        ) {
          getStakingWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === coin && x.coinNetwork === chain
          );
        } else {
          getStakingWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === coin
          );
        }

        if (!getStakingWallet) {
          return {
            message: "Coin not found in the user's wallet",
            status: 400,
            data: {},
          };
        }

        if (getStakingWallet.coinBalance < Number(amount)) {
          return {
            message: "Insufficient balance for staking in Smart Apy",
            status: 400,
            data: {},
          };
        }

        const specialTokens = ["BTC", "LTC", "ETH", "BCH", "BNB"];
        const minimumRequired = specialTokens.includes(coin) ? 0.01 : 50;

        if (Number(amount) < minimumRequired) {
          return {
            message: `Minimum staking amount must be at least ${minimumRequired}.`,
            status: 400,
            data: {},
          };
        }

        let stakingPercentage = percentage / 100;

        const isIndexxToken = (coin: string) =>
          ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);

        const tokenPercentageReward = Number(amount) * stakingPercentage;
        let tokenUsdtValue;

        if (coin === "INEX") {
          tokenUsdtValue = 1; // Assuming INEX value as 1 since you're not fetching its price
        } else if (isIndexxToken(coin)) {
          console.log("indexx tokens");
          const latestBaseRate = await currencyService.findOne({ code: coin });
          tokenUsdtValue = latestBaseRate.buyPrice;
        } else {
          const getCoinPrice = await getPriceByName(coin);
          tokenUsdtValue = getCoinPrice.data;
        }
        const finalReward = tokenPercentageReward;

        let finalAmount = finalReward;
        // Calculate the endDate based on the duration
        let startDate = new Date();
        let endDate = new Date(startDate);

        if (duration === "1 day") {
          endDate.setDate(startDate.getDate() + 1); // Add 1 day
        } else if (duration === "6 months") {
          endDate.setMonth(startDate.getMonth() + 6);
        } else if (duration === "1 year") {
          endDate.setFullYear(startDate.getFullYear() + 1);
        } else if (duration === "12 months") {
          endDate.setMonth(startDate.getMonth() + 12);
        } else if (duration === "18 months") {
          endDate.setFullYear(startDate.getMonth() + 18);
        }

        let stakeData = {
          smartApyId: uuidv1(),
          stakedAmount: Number(amount), // How much the user is staking
          rewardAmount: finalReward, // how much reward is gained
          finalAmount: finalAmount + Number(amount), // Final amount the user gets staked + reward
          coin: coin,
          rewardCoin: coin,
          email: getUser.email,
          percentage: stakingPercentage,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          duration: duration, // 6 months or 1 year
        } as SmartApy;

        let createStaking = await smartAPYService.create(stakeData);

        console.log("createStaking", createStaking);

        let txType = "Smart APY Investment";
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
          amountInvested: tokenUsdtValue,
          notes: `Smart APY Investment for ${duration} with percentage ${percentage}% start data: ${startDate}, end date:${endDate}`,
          rate: tokenUsdtValue,
        } as Transaction;
        let createTx = await transactionService.create(transaction);

        // Update the user balance
        let updateUserWallet = await uservice.updatePart(
          {
            email: getUser.email,
            "userWallets.coinSymbol": coin,
            ...(coin === "INEX" ||
              coin === "INEX-POLYGON" ||
              coin === "INEX-ETHEREUM"
              ? { "userWallets.coinNetwork": chain }
              : {}),
          },
          {
            $set: {
              coinLastUsedOn: new Date(),
              "userWallets.$.coinBalance":
                getStakingWallet.coinBalance - Number(amount),
              "userWallets.$.coinStakedBalance":
                getStakingWallet?.coinStakedBalance
                  ? getStakingWallet.coinStakedBalance + Number(amount)
                  : Number(amount),
            },
          }
        );

        console.log("updateUserWallet", updateUserWallet);

        const data = {
          message: `Successfully staked ${coin}`,
          status: 200,
          data: createStaking,
        };
        return data;
      }
    } catch (err) {
      console.error("Error:", err);
      return {
        message: "Internal server error",
        status: 500,
        data: {},
      };
    }
  }

  async calculateReward(
    amount: number,
    coin: string,
    type: string,
    percentage: number
  ) {
    try {
      // Set the staking percentage and duration based on the type
      let stakingPercentage = percentage / 100;
      let duration =
        type === "Short" ? "6 months" : type === "Long" ? "1 year" : "1 day";

      if (duration === "1 day") {
        stakingPercentage = 0.00273973; // Approximate daily percentage for a 1-day duration
      }

      // Calculate the token percentage reward based on the staked amount
      const tokenPercentageReward = amount * stakingPercentage;
      let tokenUsdtValue: number;

      // Determine if the coin is an Indexx token
      const isIndexxToken = (coin: string) =>
        ["IN500", "IUSD+", "INXC", "INEX", "WIBS", "DaCrazy"].includes(coin);

      // Fetch the USDT value of the coin (or set a default for INEX)
      if (coin === "INEX") {
        tokenUsdtValue = 1; // Assuming INEX value is 1 USD
      } else if (isIndexxToken(coin)) {
        const latestBaseRate = await currencyService.findOne({ code: coin });
        tokenUsdtValue = latestBaseRate.buyPrice;
      } else {
        const getCoinPrice = await getPriceByName(coin);
        tokenUsdtValue = getCoinPrice.data;
      }

      // Calculate the final reward in INEX
      const inexReward = tokenPercentageReward * tokenUsdtValue;
      const finalAmount = inexReward;

      const calculatedValues = {
        rewardAmount: inexReward, // The calculated reward based on the staking percentage
        finalAmount: finalAmount, // The final amount the user will receive (reward)
        duration: duration, // The staking duration (6 months, 1 year, or 1 day)
        percentage: stakingPercentage, // The staking percentage used for calculation
      };

      const data = {
        message: `Successfully staked ${coin}`,
        status: 200,
        data: calculatedValues,
      };
      return data;
    } catch (err) {
      console.error("Error calculating reward:", err);
      return {
        message: "Error calculating reward:" + err,
        status: 500,
        data: {},
      };
    }
  }

  async getStakedCoinsByEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        let getAllStakedRecords = await stakingService.find({
          email: email,
        });
        if (getAllStakedRecords) {
          const data = {
            message: "Staked coins data",
            status: 200,
            data: getAllStakedRecords,
          };
          return data;
        } else {
          const data = {
            message: "No Staked coins data available",
            status: 500,
            data: {},
          };
          return data;
        }
      } else {
        const data = {
          message: "No user found",
          status: 500,
          data: {},
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: {},
      };
      console.log("Err", err);
      return data;
    }
  }

  async getSmartAPYInvestmentByEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        let getAllSmartAPYRecords = await smartAPYService.find({
          email: email,
        });
        if (getAllSmartAPYRecords) {
          const data = {
            message: "Smart Apy Investment data",
            status: 200,
            data: getAllSmartAPYRecords,
          };
          return data;
        } else {
          const data = {
            message: "No Smart Apy Investment data available",
            status: 500,
            data: {},
          };
          return data;
        }
      } else {
        const data = {
          message: "No user found",
          status: 500,
          data: {},
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: {},
      };
      console.log("Err", err);
      return data;
    }
  }

  async getCommissionHistoryByEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let getUser = await uservice.findOne({
        email: email,
      });
      if (getUser) {
        let getAllCommissionRecords = await commissionService.find({
          mainCaptainBeeEmail: email,
        });
        if (getAllCommissionRecords) {
          let getAllCommissionRecordsData = [];

          for (let index = 0; index < getAllCommissionRecords.length; index++) {
            const mongooseDocument = getAllCommissionRecords[index];
            const originalElement = mongooseDocument?._doc; // Extract _doc from Mongoose document
            let element = { ...originalElement }; // Clone the object

            let captainBeeEmail;
            console.log(
              "originalElement?.honeyBeeEmail",
              originalElement?.honeyBeeEmail
            );
            if (originalElement?.honeyBeeEmail !== "") {
              captainBeeEmail = await uservice.findOne({
                email: originalElement.honeyBeeEmail,
              });

              element.rank = "NA";
              element.name =
                captainBeeEmail?.firstName && captainBeeEmail?.lastName
                  ? `${captainBeeEmail.firstName} ${captainBeeEmail.lastName}`
                  : captainBeeEmail?.email.split("@")[0];
              element.beeType = originalElement.honeyBeeEmail
                ? "HoneyBee"
                : " CaptainBee";
              getAllCommissionRecordsData.push(element);
            } else if (originalElement?.captainBeeEmail !== "") {
              captainBeeEmail = await affilateService.findOne({
                Email: originalElement.captainBeeEmail,
              });

              element.rank = captainBeeEmail?.rank
                ? captainBeeEmail.rank
                : "Bronze";
              element.name = originalElement.honeyBeeEmail
                ? originalElement
                : captainBeeEmail?.firstname + " " + captainBeeEmail?.lastname;
              element.beeType = originalElement.honeyBeeEmail
                ? "HoneyBee"
                : " CaptainBee";
              getAllCommissionRecordsData.push(element);
            }

            // Append rank and name to the element
          }

          let commissionPaidAndDueData = await affilateService.findOneSelect(
            {
              Email: email,
            },
            {
              rank: 1,
              familyRank: 1,
              commissionPercentage: 1,
              totalCommissionEarned: 1,
              totalCommissionToBePaid: 1,
              totalHoneyBeeCommissionEarned: 1,
              totalHoneyBeeCommissionToBePaid: 1,
            }
          );

          const data = {
            message: "Commission History",
            status: 200,
            data: {
              getAllCommissionRecordsData,
              commissionPaidAndDueData: [commissionPaidAndDueData],
            },
          };
          return data;
        } else {
          const data = {
            message: "No Commission History data available",
            status: 500,
            data: {},
          };
          return data;
        }
      } else {
        const data = {
          message: "No user found",
          status: 500,
          data: {},
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: {},
      };
      console.log("Err", err);
      return data;
    }
  }

  async getUserByUserName(req: any, res: any) {
    try {
      let username = req.params.username;

      if (!username) {
        // If username is not provided, return an error
        return {
          message: "Username is required",
          status: 400,
          data: {},
        };
      }

      // Check in the primary user service
      let usernameExist = await uservice.findOneSelect(
        {
          username: username,
        },
        {
          basic: 1,
          authProviders: 1,
          email: 1,
          verification: 1,
        }
      );

      if (usernameExist) {
        // User found in the primary service
        return {
          status: 200,
          data: usernameExist,
          message: "User found by username",
        };
      } else {
        // If not found, check in the affiliate service
        let usernameExistInAffiliate = await affilateService.findOneSelect(
          {
            Username: username,
          },
          {
            firstname: 1,
            lastname: 1,
            Username: 1,
            Email: 1,
            photoIdFileurl: 1,
          }
        );

        if (usernameExistInAffiliate) {
          // User found in the affiliate service
          return {
            status: 200,
            data: usernameExistInAffiliate,
            message: "User found by username",
          };
        } else {
          // User not found in both services
          return {
            message: "No User found by username",
            status: 404,
            data: {},
          };
        }
      }
    } catch (err) {
      // Handle any unexpected errors
      return {
        message: "Failed to get user by username",
        status: 500,
        data: {},
      };
    }
  }

  async getUserByEmail(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();

      let emailExist;

      emailExist = await uservice.findOneSelect(
        {
          email: email,
        },
        { basic: 1, authProviders: 1, email: 1, verification: 1 }
      );

      let emailExistOnAffiliate = await affilateService.findOneSelect(
        {
          Email: email,
        },
        {
          firstname: 1,
          lastname: 1,
          Username: 1,
          Email: 1,
          photoIdFileurl: 1,
        }
      );
      console.log(emailExistOnAffiliate.photoIdFileurl);
      emailExist.profilePic = emailExist?.profilePic
        ? emailExist?.profilePic
        : emailExistOnAffiliate.photoIdFileurl;
      if (emailExist) {
        return {
          status: 200,
          data: emailExist as any,
          message: "User found by email",
        };
      } else {
        return {
          status: 500,
          data: {} as any,
          message: "No User found by email",
        };
      }
    } catch (err) {
      const data = {
        message: "Failed to get user by email",
        status: 500,
        data: {} as any,
      };
      return data;
    }
  }

  async getUserByEmail1(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();

      // First, check if the email exists in the primary user service
      let emailExist = await uservice.findOneSelect(
        {
          email: email,
        },
        {
          basic: 1,
          authProviders: 1,
          email: 1,
          verification: 1,
          profilePic: 1,
          isKYCPass: 1,
          kycStatus: 1,
          personalIdNumber: 1,
          country: 1,
        }
      );

      // If the email exists in the primary user service
      if (emailExist) {
        // Then check in the affiliate service for additional details
        let emailExistOnAffiliate = await affilateService.findOneSelect(
          {
            Email: email,
          },
          {
            firstname: 1,
            lastname: 1,
            Username: 1,
            Email: 1,
            photoIdFileurl: 1,
          }
        );

        // If a profile picture URL exists in the affiliate service, update the profilePic in emailExist
        if (emailExistOnAffiliate && emailExistOnAffiliate.photoIdFileurl) {
          emailExist.profilePic = emailExistOnAffiliate.photoIdFileurl;
        }

        // Return the user details from the primary service
        return {
          status: 200,
          data: emailExist,
          message: "User found by email",
        };
      } else {
        // If no user is found in the primary user service
        return {
          status: 500,
          data: {},
          message: "No User found by email",
        };
      }
    } catch (err) {
      // Handle any unexpected errors
      return {
        message: "Failed to get user by email",
        status: 500,
        data: {},
      };
    }
  }

  async RunstakedCoins(req: any, res: any) {
    try {
      console.log("----------------Started unstaking job-----------------");
      logToFile("----------------Started unstaking job-----------------");
      let getAllStakedRecords = await stakingService.find({});

      if (getAllStakedRecords && getAllStakedRecords.length >= 0) {
        for (let index = 0; index < getAllStakedRecords.length; index++) {
          const element = getAllStakedRecords[index];
          let endDate = element.endDate;
          let today = new Date();
          if (
            element.isActive &&
            endDate.setHours(0, 0, 0, 0) <= today.setHours(0, 0, 0, 0)
          ) {
            let getUser = await uservice.findOne({
              email: element?.email,
            });
            logToFile(
              `Started unstaking with id ${element.stakingId
              } and data is ${JSON.stringify(element)}`
            );

            let getStakingWallet = getUser.userWallets.find(
              (x) => x.coinSymbol === element.coin
            ) as UserWallet;

            if (!getStakingWallet) {
              logToFile(
                `Unable to find ${element.coin} wallet for ${element.email} while unstaking ${element.stakingId}`
              );
              continue;
            }

            const stakedAmount = Number(element?.stakedAmount ?? 0);
            const walletCoinBalance = Number(getStakingWallet.coinBalance ?? 0);
            const walletStakedBalance = Number(
              getStakingWallet.coinStakedBalance ?? 0
            );
            const updatedCoinBalance = walletCoinBalance + stakedAmount;
            const updatedStakedBalance = Math.max(
              walletStakedBalance - stakedAmount,
              0
            );

            console.log(
              "getStakingWallet.coinBalance + element.stakedAmount,",
              updatedCoinBalance
            );
            //update the user balance of actually coin
            let updateUserWallet = await uservice.updatePart(
              {
                email: element.email,
                "userWallets.coinSymbol": element.coin,
              },
              {
                $set: {
                  coinLastUsedOn: new Date(),
                  "userWallets.$.coinBalance": updatedCoinBalance,
                  "userWallets.$.coinStakedBalance": updatedStakedBalance,
                },
              }
            );
            getStakingWallet.coinBalance = updatedCoinBalance;
            getStakingWallet.coinStakedBalance = updatedStakedBalance;

            let getStakingRewardWallet = getUser.userWallets.find(
              (x) => x.coinSymbol === element.rewardCoin
            ) as UserWallet;

            if (getStakingRewardWallet) {
              const rewardAmount = Number(element?.finalAmount ?? 0);
              const updatedRewardBalance =
                Number(getStakingRewardWallet.coinBalance ?? 0) + rewardAmount;
              //update the user balance of reward coin(INEX)
              let updateUserWallet2 = await uservice.updatePart(
                {
                  email: element.email,
                  "userWallets.coinSymbol": element.rewardCoin,
                },
                {
                  $set: {
                    coinLastUsedOn: new Date(),
                    "userWallets.$.coinBalance": updatedRewardBalance,
                  },
                }
              );
              getStakingRewardWallet.coinBalance = updatedRewardBalance;
            } else {
              logToFile(
                `Reward wallet ${element.rewardCoin} not found for ${element.email} during unstaking ${element.stakingId}`
              );
            }
            //update the stake record
            let updateStakingRecord = await stakingService.updatePart(
              {
                email: element?.email,
                stakingId: element?.stakingId,
              },
              {
                $set: {
                  isActive: false,
                },
              }
            );
            logToFile(`Completed unstaking with id ${element.stakingId}`);
          }
        }
        console.log("All staking done till data");
        logToFile("All staking done till data");
        return;
      } else {
        const data = {
          message: "No sufficient balance avaliable",
          status: 500,
          data: {},
        };
        return data;
      }
    } catch (err: any) {
      logToFile("Error: " + err?.message);
      console.error("Error in scheduled task:", err);
      return { message: "User get failed", status: 500, data: {} };
    }
  }

  private async syncUserCoinStakedBalance(
    email: string,
    coinSymbol: string
  ): Promise<number | null> {
    try {
      const activeStakes = await stakingService.find({
        email,
        coin: coinSymbol,
        isActive: true,
      });
      const recalculatedBalance = activeStakes.reduce(
        (total, stake) => total + Number(stake?.stakedAmount ?? 0),
        0
      );
      await uservice.updatePart(
        {
          email,
          "userWallets.coinSymbol": coinSymbol,
        },
        {
          $set: {
            "userWallets.$.coinStakedBalance": recalculatedBalance,
          },
        }
      );
      return recalculatedBalance;
    } catch (error) {
      console.error(
        `Failed to sync staked balance for ${email} and coin ${coinSymbol}`,
        error
      );
      logToFile(
        `Failed to sync staked balance for ${email} and coin ${coinSymbol}: ${error}`
      );
      return null;
    }
  }

  async RunWithdrawSmartAPY(req: any, res: any) {
    try {
      console.log("----------------Started unstaking job-----------------");
      logToFile("----------------Started unstaking job-----------------");
      let getAllStakedRecords = await smartAPYService.find({});

      if (getAllStakedRecords && getAllStakedRecords.length >= 0) {
        for (let index = 0; index < getAllStakedRecords.length; index++) {
          const element = getAllStakedRecords[index];
          let endDate = element.endDate;
          let today = new Date();
          if (
            element.isActive &&
            endDate.setHours(0, 0, 0, 0) <= today.setHours(0, 0, 0, 0)
          ) {
            let getUser = await uservice.findOne({
              email: element?.email,
            });
            logToFile(
              `Started unstaking with id ${element.smartApyId
              } and data is ${JSON.stringify(element)}`
            );

            let getStakingWallet = getUser.userWallets.find(
              (x) => x.coinSymbol === element.coin
            ) as UserWallet;

            console.log(
              "getStakingWallet.coinBalance + element.stakedAmount,",
              getStakingWallet.coinBalance + element.stakedAmount
            );
            //update the user balance of actually coin
            let updateUserWallet = await uservice.updatePart(
              {
                email: element.email,
                "userWallets.coinSymbol": element.coin,
              },
              {
                $set: {
                  coinLastUsedOn: new Date(),
                  "userWallets.$.coinBalance":
                    getStakingWallet.coinBalance + element.stakedAmount,
                  "userWallets.$.coinStakedBalance":
                    (getStakingWallet?.coinStakedBalance || 0) -
                    element.stakedAmount,
                },
              }
            );

            let getStakingRewardWallet = getUser.userWallets.find(
              (x) => x.coinSymbol === element.rewardCoin
            ) as UserWallet;
            //update the user balance of reward coin(INEX)
            let updateUserWallet2 = await uservice.updatePart(
              {
                email: element.email,
                "userWallets.coinSymbol": element.rewardCoin,
              },
              {
                $set: {
                  coinLastUsedOn: new Date(),
                  "userWallets.$.coinBalance":
                    getStakingRewardWallet.coinBalance + element.finalAmount,
                },
              }
            );
            //update the stake record
            let updateStakingRecord = await stakingService.updatePart(
              {
                email: element?.email,
                stakingId: element?.smartApyId,
              },
              {
                $set: {
                  isActive: false,
                },
              }
            );
            logToFile(`Completed unstaking with id ${element.smartApyId}`);
          }
        }
        console.log("All staking done till data");
        logToFile("All staking done till data");
        return;
      } else {
        const data = {
          message: "No sufficient balance avaliable",
          status: 500,
          data: {},
        };
        return data;
      }
    } catch (err: any) {
      logToFile("Error: " + err?.message);
      console.error("Error in scheduled task:", err);
      return { message: "User get failed", status: 500, data: {} };
    }
  }

  async runWithdrawSmartAPYForSpecificUser(req: any, res: any) {
    try {
      let getSmartAPYRecord = await smartAPYService.findOne({
        smartApyId: req.body.smartApyId,
      });

      if (getSmartAPYRecord) {
        const element = getSmartAPYRecord;
        let endDate = new Date(element.endDate);
        let today = new Date();

        if (element.isActive) {
          // Check if withdrawal is before the end date
          today.setHours(0, 0, 0, 0); // Reset `today` to midnight
          endDate.setHours(0, 0, 0, 0); // Reset `endDate` to midnight
          let isEarlyWithdrawal = today < endDate; // Compare the two dates

          let penalty = 0;

          if (isEarlyWithdrawal) {
            // Deduct 10% of staked amount as a penalty for early withdrawal
            penalty = element.stakedAmount * 0.1;
            console.log(
              `Early withdrawal detected. Applying 10% penalty: ${penalty}`
            );
          }

          let adjustedStakedAmount = element.stakedAmount - penalty;

          let getUser = await uservice.findOne({
            email: element?.email,
          });

          let getStakingWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === element.coin
          ) as UserWallet;

          console.log(
            "getStakingWallet.coinBalance + adjustedStakedAmount,",
            getStakingWallet.coinBalance + adjustedStakedAmount
          );

          // Update the user's wallet for the original coin
          let updateUserWallet = await uservice.updatePart(
            {
              email: element.email,
              "userWallets.coinSymbol": element.coin,
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  getStakingWallet.coinBalance + adjustedStakedAmount,
                "userWallets.$.coinStakedBalance":
                  (getStakingWallet?.coinStakedBalance || 0) -
                  element.stakedAmount,
              },
            }
          );

          let getStakingRewardWallet = getUser.userWallets.find(
            (x) => x.coinSymbol === element.rewardCoin
          ) as UserWallet;

          // Update the user's wallet for the reward coin (INEX)
          let updateUserWallet2 = await uservice.updatePart(
            {
              email: element.email,
              "userWallets.coinSymbol": element.rewardCoin,
            },
            {
              $set: {
                coinLastUsedOn: new Date(),
                "userWallets.$.coinBalance":
                  getStakingRewardWallet.coinBalance + element.finalAmount,
              },
            }
          );

          // Update the staking record to mark it as inactive
          let updateStakingRecord = await smartAPYService.updatePart(
            {
              email: element?.email,
              smartApyId: element?.smartApyId,
            },
            {
              $set: {
                isActive: false,
              },
            }
          );
        } else {
          const data = {
            message: "No sufficient balance available",
            status: 500,
            data: {},
          };
          return data;
        }
      }
      let reGetSmartAPYRecord = await smartAPYService.findOne({
        smartApyId: req.body.smartApyId,
      });
      const data = {
        message: "Smart APY unstaking done",
        status: 200,
        data: reGetSmartAPYRecord,
      };
      return data;
    } catch (err: any) {
      logToFile("Error: " + err?.message);
      console.error("Error in scheduled task:", err);
      return { message: "User get failed", status: 500, data: {} };
    }
  }

  async reinvestSmartAPY(req: any, res: any) {
    try {
      let getSmartAPYRecord = await smartAPYService.findOne({
        smartApyId: req.body.smartApyId,
      });

      if (!getSmartAPYRecord) {
        return {
          message: "Smart APY record not found",
          status: 404,
          data: {},
        };
      }

      const element = getSmartAPYRecord;
      let endDate = new Date(element.endDate);
      let today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      let daysBeforeEndDate = Math.floor(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysBeforeEndDate < 1 || daysBeforeEndDate > 7) {
        return {
          message:
            "Reinvestment is allowed only between 1 to 7 days before the maturity date",
          status: 400,
          data: {},
        };
      }

      let newStakedAmount = element.stakedAmount + element.rewardAmount;
      let newStartDate = new Date();
      let newEndDate = new Date(newStartDate);

      if (element.duration.includes("months")) {
        let months = parseInt(element.duration.split(" ")[0]);
        newEndDate.setMonth(newEndDate.getMonth() + months);
      } else if (element.duration.includes("years")) {
        let years = parseInt(element.duration.split(" ")[0]);
        newEndDate.setFullYear(newEndDate.getFullYear() + years);
      }

      let newRewardAmount = newStakedAmount * element.percentage;
      let newFinalAmount = newStakedAmount + newRewardAmount;

      let newSAPY = {
        smartApyId: uuidv1(),
        stakedAmount: newStakedAmount,
        rewardAmount: newRewardAmount,
        finalAmount: newFinalAmount,
        coin: element.coin,
        rewardCoin: element.rewardCoin,
        percentage: element.percentage,
        email: element.email,
        startDate: newStartDate,
        endDate: newEndDate,
        isActive: true,
        duration: element.duration,
      } as SmartApy;
      let newSmartAPYRecord = await smartAPYService.create(newSAPY);

      // send email to user after completion
      await new SendEmail().sendReinvestmentConfirmation(
        element.email,
        "User",
        getSmartAPYRecord,
        newSmartAPYRecord
      );
      await smartAPYService.updatePart(
        { smartApyId: element.smartApyId },
        { $set: { isActive: false } }
      );

      return {
        message: "Smart APY reinvestment successful",
        status: 200,
        data: newSmartAPYRecord,
      };
    } catch (err: any) {
      logToFile("Error: " + err?.message);
      console.error("Error in reinvest function:", err);
      return { message: "Reinvestment failed", status: 500, data: {} };
    }
  }

  async getAllUserRanks(req: any, res: any) {
    try {
      let affiliateUsers = await affilateService.find({});
    } catch (err) { }
  }

  //Helper Functions
  async getConvertOrderAmountINUSD(order: Order) {
    try {
      if (order.orderType == "Convert" && order.status == "Completed") {
        let orderAmountInUSD = 0;
        if (order.breakdown.inCurrenyName == "BTC") {
          let btcRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "BTC"
          );
          let btcRateInUSD =
            (btcRate.data.buyPrice + btcRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * btcRateInUSD;
        } else if (order.breakdown.inCurrenyName == "LTC") {
          let ltcRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "LTC"
          );
          let ltcRateInUSD =
            (ltcRate.data.buyPrice + ltcRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * ltcRateInUSD;
        } else if (order.breakdown.inCurrenyName == "ETH") {
          let ethRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "ETH"
          );
          let ethRateInUSD =
            (ethRate.data.buyPrice + ethRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * ethRateInUSD;
        } else if (order.breakdown.inCurrenyName == "IN500") {
          let in500Rate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "IN500"
          );
          let in500RateInUSD =
            (in500Rate.data.buyPrice + in500Rate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * in500RateInUSD;
        } else if (order.breakdown.inCurrenyName == "INXC") {
          let inxcRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "INXC"
          );
          let inxcRateInUSD =
            (inxcRate.data.buyPrice + inxcRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * inxcRateInUSD;
        } else if (order.breakdown.inCurrenyName == "IUSD+") {
          let iusdRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "IUSD+"
          );
          let iusdRateInUSD =
            (iusdRate.data.buyPrice + iusdRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * iusdRateInUSD;
        } else if (order.breakdown.inCurrenyName == "BNB") {
          let bnbRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "BNB"
          );
          let bnbRateInUSD =
            (bnbRate.data.buyPrice + bnbRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * bnbRateInUSD;
        } else if (order.breakdown.inCurrenyName == "BUSD") {
          let busdRate = await currencyService.getCurrencyPriceByType(
            "Crypto",
            "BUSD"
          );
          let busdRateInUSD =
            (busdRate.data.buyPrice + busdRate.data.sellPrice) / 2;
          orderAmountInUSD = order.breakdown.inAmount * busdRateInUSD;
        } else {
          return 0;
        }
        return orderAmountInUSD;
      } else {
        return 0;
      }
    } catch (err) {
      return 0;
    }
  }

  async getPriceByNameForWallet(name: string, type: string, network?: string) {
    try {

      if (name === "BTCY") {
        let querySymbol = `BTCUSDT`;
        let results = await binance.prices(querySymbol);
        console.log("results", results);
        let btcPrice = Number(results[querySymbol]);

        // Calculate 1 BTC = 1,000,000 BTCY -> 1 BTCY = btcPrice / 1,000,000
        let btcyPriceInUSDT = btcPrice / 1_000_000;

        console.log(`Calculated BTCY price (1 BTC = 1,000,000 BTCY): ${btcyPriceInUSDT}`);

        return { status: 200, data: Number(btcyPriceInUSDT) };
      }
      const tokens = [
        "AAPL",
        "APPL",
        "AMZN",
        "BCM",
        "GOOGL",
        "META",
        "MSFT",
        "NVDA",
        "PEP",
        "SPX",
        "SNP500",
        "TSLA",
        "TLSA",
      ];
      console.log("tokens.includes(name)", tokens.includes(name));

      // Prefer shared WIBS price logic (cached Moralis/pump.fun)
      if (name === "WIBS") {
        const resp = await getPriceByName("WIBS");
        return { status: 200, data: Number(resp.data) };
      } else if (
        name == "IN500" ||
        name == "INXC" ||
        name == "IUSD+" ||
        name == "INEX" ||
        name == "DaCrazy" ||
        name == "INXP" ||
        name == "SRT"
      ) {
        let price = await currencyService.findOne({ code: name });
        if (type == "Sell" || type == "Convert") {
          return { status: 200, data: Number(price.sellPrice) };
        } else {
          return { status: 200, data: Number(price.buyPrice) };
        }
      } else if (name === "FTT") {
        let currentFTTPrice = await getLatestFTTPrice();
        return { status: 200, data: Number(currentFTTPrice) };
      } else if (tokens.includes(name)) {
        let c: string =
          name === "APPL"
            ? "AAPL"
            : name === "AMZN"
              ? "AMZN"
              : name === "BCM"
                ? "AVGO"
                : name === "GOOGL"
                  ? "GOOGL"
                  : name === "META"
                    ? "META"
                    : name === "MSFT"
                      ? "MSFT"
                      : name === "NVDA"
                        ? "NVDA"
                        : name === "PEP"
                          ? "PEP"
                          : name === "SNP500"
                            ? "SPX"
                            : name === "TLSA"
                              ? "TSLA"
                              : "";
        const getStockVale = await getLatestStockPrice(c);
        return { status: 200, data: Number(getStockVale / 1) };
      } else if (
        name.includes("EQSTK") ||
        name.includes("INDXXF") ||
        name.includes("CRYC10") ||
        name.includes("TOB") ||
        name.includes("ALCRYP")
      ) {
        const getLatestPrice = await getLatestPriceOfETF(name);
        return {
          status: 200,
          data: Number(getLatestPrice?.data.totalETFPrice),
        };
      } else if (name === "USDT") {
        return { status: 200, data: Number(1) };
      } else {
        name = name === "BEAM" ? "BEAMX" : name;
        let querySymbol = `${name}USDT`;
        let results = await binance.prices(querySymbol);
        return { status: 200, data: Number(results[querySymbol]) };
      }
    } catch (err) {
      return { status: 500, data: 0 };
    }
  }

  async getPrevPriceByNameForWallet(name: string, type: string) {
    try {

      if (name === "BTCY") {
        let querySymbol = `BTCUSDT`;
        let results = await binance.prices(querySymbol);
        console.log("results", results);
        let btcPrice = Number(results[querySymbol]);

        // Calculate 1 BTC = 1,000,000 BTCY → 1 BTCY = btcPrice / 1,000,000
        let btcyPriceInUSDT = btcPrice / 1_000_000;

        console.log(`Calculated BTCY price (1 BTC = 1,000,000 BTCY): ${btcyPriceInUSDT}`);

        return { status: 200, data: Number(btcyPriceInUSDT) };
      }
      const tokens = [
        "AAPL",
        "APPL",
        "AMZN",
        "BCM",
        "GOOGL",
        "META",
        "MSFT",
        "NVDA",
        "PEP",
        "SPX",
        "SNP500",
        "TSLA",
        "TLSA",
      ];
      console.log("tokens.includes(name)", tokens.includes(name));
      if (
        name == "IN500" ||
        name == "INXC" ||
        name == "IUSD+" ||
        name == "INEX" ||
        name == "DaCrazy" ||
        name == "INXP" ||
        name == "SRT" ||
        name == "WIBS"
      ) {
        let price = await currencyService.findOne({ code: name });
        if (type == "Sell" || type == "Convert") {
          return { status: 200, data: Number(price.sellPrice) };
        } else {
          return { status: 200, data: Number(price.buyPrice) };
        }
      } else if (name === "FTT") {
        let currentFTTPrice = await getLatestFTTPrice();
        return { status: 200, data: Number(currentFTTPrice) };
      } else if (tokens.includes(name)) {
        let c: string =
          name === "APPL"
            ? "AAPL"
            : name === "AMZN"
              ? "AMZN"
              : name === "BCM"
                ? "AVGO"
                : name === "GOOGL"
                  ? "GOOGL"
                  : name === "META"
                    ? "META"
                    : name === "MSFT"
                      ? "MSFT"
                      : name === "NVDA"
                        ? "NVDA"
                        : name === "PEP"
                          ? "PEP"
                          : name === "SNP500"
                            ? "SPX"
                            : name === "TLSA"
                              ? "TSLA"
                              : "";
        const getStockVale = await getLatestStockPrice(c);
        return { status: 200, data: Number(getStockVale / 1) };
      } else if (
        name.includes("EQSTK") ||
        name.includes("INDXXF") ||
        name.includes("CRYC10") ||
        name.includes("TOB") ||
        name.includes("ALCRYP")
      ) {
        const getLatestPrice = await getLatestPriceOfETF(name);
        return {
          status: 200,
          data: Number(getLatestPrice?.data.totalETFPrice),
        };
      } else if (name === "USDT") {
        return { status: 200, data: Number(1) };
      } else {
        name = name === "BEAM" ? "BEAMX" : name;
        let querySymbol = `${name}USDT`;
        let results = await binance.prices(querySymbol);
        return { status: 200, data: Number(results[querySymbol]) };
      }
    } catch (err) {
      return { status: 500, data: 0 };
    }
  }

  async registerUserWithPhone(req: any, res: any) {
    try {
      const { password, username, referralCode } = req.body;
      const rawPhone = String(req.body.phone || "").trim();

      if (!rawPhone || !password) {
        return {
          status: 400,
          message: "Phone number and password are required",
          data: {},
        };
      }

      // Canonicalise before anything derives from the number. The placeholder
      // account email below is built from it, so normalising afterwards would
      // let one person register twice — once as `phone_03001234567@…` and once
      // as `phone_923001234567@…` — each owning a different balance.
      const phone = toE164(rawPhone, req.body?.countryCode);
      if (!phone) {
        return {
          status: 400,
          message: "Enter a valid phone number, including the country code.",
          data: {},
        };
      }

      const suppliedEmail = String(req.body.email || "").trim().toLowerCase();
      const email = suppliedEmail || `phone_${phone.replace(/\D/g, "")}@phone.yays.app`;

      const phoneExists = await uservice.findOne({
        phone: phoneQuery(phone),
      });

      if (phoneExists) {
        return {
          status: 400,
          message: "Phone number already registered",
          data: {},
        };
      }

      let UserCreatedFrom: string = req.body.registerFrom;
      // Check if email already exists
      const emailExists = await uservice.findOne({ email: email });

      if (emailExists) {
        return {
          status: 400,
          message: "Email already registered",
          data: {},
        };
      }

      // Check if username exists
      if (username) {
        const usernameExist = await uservice.findOne({ username: username });
        const usernameExistInAffiliate = await affilateService.findOne({
          Username: username,
        });

        if (usernameExist || usernameExistInAffiliate) {
          return {
            status: 400,
            message: "Username already exists",
            data: {},
          };
        }
      }

      // Generate referral code
      const generateRefCode = referralCodes.generate({
        length: 8,
      });
      // Create user with phone number and email
      const newUser: User = {
        // The platform still uses an internal email-shaped account key. Phone-only
        // users receive a deterministic placeholder and are never asked to provide
        // an email address during registration.
        email,
        phone: phone,
        username: username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        profilePic: this.pickProfileImageValue(req.body),
        role: UserRoleTypes.Standard,
        authProviders: [{ provider: AuthProviders.Local }],
        verification: {
          emailVerified: false,
          phoneVerified: false, // Phone needs to be verified
        } as UserVerification,
        baseCurrency: Currency.USD,
        referralCodeUsed: referralCode,
        referralCode: generateRefCode[0],
      } as User;

      // Generate phone OTP
      const phoneOTP = Math.floor(100000 + Math.random() * 900000);
      const phoneCodeExpiry = new Date();
      phoneCodeExpiry.setMinutes(phoneCodeExpiry.getMinutes() + 15);

      // Create password hash
      let getPassword = await uservice.createPassword(password);
      const localAuthProvider = newUser.authProviders.find(p => p.provider === 'Local');
      if (localAuthProvider) {
        localAuthProvider.phash = getPassword.hash;
        localAuthProvider.psalt = getPassword.salt;
      }

      // Create user
      let createUser = await uservice.create(newUser);

      // Update user with phone code
      await uservice.updatePart(
        { _id: createUser._id },
        {
          $set: {
            "verification.phoneCode": phoneOTP.toString(),
            "verification.phoneCodeExpiry": phoneCodeExpiry,
          },
        }
      );

      // Create OTP record
      await userOtpSerive.create({
        email: email,
        phone: phone,
        phoneCode: phoneOTP.toString(),
        phoneCodeExpiry: phoneCodeExpiry,
        phoneVerified: false,
        authMethod: "phone",
      });

      // Send OTP via SMS service
      await smsService.sendOtp(phone, phoneOTP.toString());

      if (suppliedEmail) {
        const emailOTP = Math.floor(100000 + Math.random() * 900000);
        const emailCodeExpiry = new Date();
        emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);

        await uservice.updatePart(
          { _id: createUser._id },
          {
            $set: {
              "verification.emailCode": emailOTP.toString(),
              "verification.emailCodeExpiry": emailCodeExpiry,
            },
          }
        );

        await emailService.sendReviewEmail2(
          email,
          "User",
          emailOTP.toString(),
          "register",
          "New Register",
          "BTCY-MOBLIE-APP"
        );
      }


      //create a wallet user for login into wallet web
      let walletWebUser = await createUserWithEmailAndPasswordForWallet(
        email,
        password
      );
      if (walletWebUser.success) {
        let basicDetails = {};
        const newUser: User = {
          email: String(email).toLowerCase(),
          role: UserRoleTypes.Standard,
          authProviders: [
            {
              provider: AuthProviders.Local,
            },
          ],
          baseCurrency: Currency.USD,
          basic: basicDetails,
          userMnemonic: "",
          password: password,
        } as User;
        createUser = await wuserservice.create(newUser);

        // use the greeting card if body has a value and add it to wallet balance
        let greetingCode = req.body.gcode;
        let inexAmountTobeAdded = 0;
        let getReferredUser;
        let getReferredUserTaskCenter;
        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          referralCode !== "FREE500"
        ) {
          getReferredUser = await uservice.findOne({
            referralCode: referralCode,
          });

          // Check if referral code is valid
          if (!getReferredUser) {
            return { status: 400, data: "Invalid referral code" };
          }

          getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
        }

        if (
          referralCode !== undefined &&
          referralCode !== "" &&
          referralCode !== "zsuitepay" &&
          getReferredUser &&
          getReferredUserTaskCenter
        ) {
          newUser.referralCodeUsed = String(referralCode);

          await taskCenterService.updatePart(
            {
              email: getReferredUser.email,
            },
            {
              $inc: { inivitedUsersCount: 1 },
              $set: {
                inivitedUsersEmail:
                  getReferredUserTaskCenter.inivitedUsersEmail.concat(
                    newUser.email
                  ),
              },
            }
          );
        }
        if (greetingCode && greetingCode !== "") {
          let getAffiliateUser = await affilateService.findOne({
            Email: getReferredUser?.email,
          });
          let getUsedGreetingCard: any = getAffiliateUser.greetingCards.find(
            (x) => x.code === greetingCode
          );

          if (
            getUsedGreetingCard &&
            getUsedGreetingCard.receiverEmail === email
          ) {
            inexAmountTobeAdded = getUsedGreetingCard.numberOfTokens;
            let updateGreetingcard = await affilateService.updatePart(
              {
                Email: getReferredUser?.email,
                "greetingCards.code": greetingCode,
              },
              {
                $set: {
                  "greetingCards.$.receiverActivatedDate": new Date(),
                },
              }
            );
          } else {
          }
        }

        //Exchange wallet
        await createFirstTimeWallets(createUser.email, inexAmountTobeAdded);
        //await createFirstTimeWallets(createUser.email, inexAmountTobeAdded, isValidReferral);

        // Web wallets
        const walletOps: WalletOperations = new WalletOperations(req, res);
        await walletOps.createBitcoinWalletForWalletUser(email);
        await walletOps.createEthereumWalletForWalletUser(email);
        await walletOps.createBinanceWalletForWalletUser(email);
        await walletOps.createMaticWalletForWalletUser(email);
        await walletOps.createeINEXWalletForWalletUser(email);
        await walletOps.createeIN500WalletForWalletUser(email);
        await walletOps.createeINXCWalletForWalletUser(email);
        await walletOps.createeIUSDPWalletForWalletUser(email);
        await walletOps.createETHINEXWalletForWalletUser(email);
        await walletOps.createETHIN500WalletForWalletUser(email);
        await walletOps.createETHINXCWalletForWalletUser(email);
        await walletOps.createETHIUSDPWalletForWalletUser(email);
        await walletOps.createMATICINEXWalletForWalletUser(email);
      } else {
      }
      let affiliateUserRegister: boolean = false;

      // if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
      //   //todo backup pass academy

      //   const url = `${keys.academyBaseUrl.key}/api/users/signup`;
      //   let user = {
      //     email: email,
      //     first_name: req.body.first_name ?? "User",
      //     last_name: req.body.last_name ?? "User",
      //     password: req.body.password,
      //     userCreatedFrom: UserCreatedFrom,
      //     referral_code: referralCode,
      //   };
      //   const payload = { ...user };
      //   const response = await axios.post(url, payload);
      //   console.log("response", response);
      //   //Free gift card for new user signup added on 30-09-2024
      //   let createFreeGiftCardForUser = await createFreeGiftCard(
      //     "gift-card-50",
      //     email,
      //     50
      //   );
      //   await new SendEmail().sendSelfFreeGiftCardForNewSignUpNotification(
      //     email,
      //     "Gift Card $50",
      //     createFreeGiftCardForUser.currencies,
      //     50,
      //     createFreeGiftCardForUser.voucher,
      //     "",
      //     50
      //   );
      // }

      if (!affiliateUserRegister && UserCreatedFrom !== "Academy") {
        try {
          const url = `${keys.academyBaseUrl.key}/api/users/signup`;
          const user = {
            email,
            first_name: req.body.first_name ?? "User",
            last_name: req.body.last_name ?? "User",
            password: req.body.password,
            userCreatedFrom: UserCreatedFrom,
            referral_code: referralCode,
          };
          const response = await axios.post(url, user, { timeout: 15000 });
          console.log("✅ Academy response:", response.data);
          return { status: 200, data: "createdUser" };
        } catch (err: any) {
          console.error("❌ Error hitting academy signup:", err.message || err);
          return { status: 500, data: "Academy signup failed" };
        }
      } else {
        try {
          const url = `${keys.academyBaseUrl.key}/api/users/signup`;
          const user = {
            email,
            first_name: req.body.first_name ?? "User",
            last_name: req.body.last_name ?? "User",
            password: req.body.password,
            userCreatedFrom: UserCreatedFrom,
            referral_code: referralCode,
          };
          const response = await axios.post(url, user, { timeout: 15000 });
          console.log("✅ Academy response:", response.data);
          return { status: 200, data: "createdUser" };
        } catch (err: any) {
          console.error("❌ Error hitting academy signup:", err.message || err);
          return { status: 500, data: "Academy signup failed" };
        }
      }

      return {
        status: 200,
        message: suppliedEmail
          ? "Verification codes sent to phone and email, please verify to complete registration"
          : "Verification code sent to phone, please verify to complete registration",
        data: { phone, ...(suppliedEmail ? { email } : {}) },
      };
    } catch (err) {
      console.error("Error in phone registration:", err);
      return {
        status: 500,
        message: "Failed to register with phone number",
        data: {},
      };
    }
  }

  async sendOtpToPhone(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return {
          status: 400,
          message: "Phone number is required",
          data: {},
        };
      }

      // Canonicalise before doing anything else. `0300 1234567` and
      // `+92 300 1234567` are the same person, and a lookup on the raw string
      // would report a registered number as unknown.
      const normalizedPhone = toE164(phone, req.body?.countryCode);
      if (!normalizedPhone) {
        return {
          status: 400,
          message: "Enter a valid phone number, including the country code.",
          data: {},
        };
      }

      // RATE LIMITING
      // Check if rate limit exceeded
      // const rateLimitKey = `phone_otp_limit:${phone}`;
      // const requestCount = await redisClient.get(rateLimitKey);

      // if (requestCount && parseInt(requestCount) >= 5) {
      //   return {
      //     status: 429,
      //     message: "Too many OTP requests. Please try again after 15 minutes.",
      //     data: {}
      //   };
      // }

      // Increment counter and set expiry if not exists
      // if (requestCount) {
      //   await redisClient.incr(rateLimitKey);
      // } else {
      //   await redisClient.set(rateLimitKey, 1, {
      //     EX: 900 // 15 minutes expiry
      //   });
      // }

      // Matched against every form the number may already be stored in, so
      // accounts created before normalisation are still found.
      const user = await uservice.findOne({
        phone: phoneQuery(phone, req.body?.countryCode),
      });

      // Generate OTP
      const phoneOTP = Math.floor(100000 + Math.random() * 900000);
      const phoneCodeExpiry = new Date();
      phoneCodeExpiry.setMinutes(phoneCodeExpiry.getMinutes() + 15);

      // ENCRYPT OTP
      // Use a simple encryption for OTP storage
      const encryptedOTP = phoneOTP.toString();

      if (user) {
        // Update user with phone code
        await uservice.updatePart(
          { _id: user._id },
          {
            $set: {
              "verification.phoneCode": encryptedOTP,
              "verification.phoneCodeExpiry": phoneCodeExpiry,
            },
          }
        );

        // Update or create OTP record. Stored against the canonical form so
        // verification finds it however the user retypes the number.
        const otpRecord = await userOtpSerive.findOne({
          phone: phoneQuery(phone, req.body?.countryCode),
        });

        if (otpRecord) {
          await userOtpSerive.updatePart(
            { _id: (otpRecord as any)._id },
            {
              $set: {
                phone: normalizedPhone,
                phoneCode: encryptedOTP,
                phoneCodeExpiry: phoneCodeExpiry,
              },
            }
          );
        } else {
          await userOtpSerive.create({
            phone: normalizedPhone,
            phoneCode: encryptedOTP,
            phoneCodeExpiry: phoneCodeExpiry,
            phoneVerified: false,
            authMethod: "phone",
          });
        }

        // Send OTP via SMS service. A send failure has to surface: silently
        // returning 200 leaves the user waiting for a text that will never
        // arrive, with no way to tell that from a slow carrier.
        const smsResult = await smsService.sendOtp(
          normalizedPhone,
          phoneOTP.toString()
        );
        if (!smsResult) {
          return {
            status: 502,
            message:
              "We could not send the verification text. Check the number, or try again shortly.",
            data: {},
          };
        }

        return {
          status: 200,
          message: "OTP sent to phone",
          data: { phone: normalizedPhone },
        };
      } else {
        return {
          status: 404,
          message: "Phone number not registered",
          data: {},
        };
      }
    } catch (err) {
      console.error("Error sending OTP to phone:", err);
      return {
        status: 500,
        message: "Failed to send OTP",
        data: {},
      };
    }
  }

  async validatePhoneOtp(req: any, res: any) {
    try {
      const { phone, code } = req.body;

      if (!phone || !code) {
        return {
          status: 400,
          message: "Phone number and OTP code are required",
          data: {},
        };
      }

      const phoneFilter = phoneQuery(phone, req.body?.countryCode);
      const normalizedPhone = toE164(phone, req.body?.countryCode);

      // Find OTP record
      const otpRecord = await userOtpSerive.findOne({ phone: phoneFilter });

      if (!otpRecord) {
        return {
          status: 400,
          message: "No OTP found for this phone number",
          data: {},
        };
      }

      console.log("otpRecord", otpRecord);

      // Decrypt the stored OTP
      const decryptedOTP = otpRecord.phoneCode;

      // Compare with user input
      if (decryptedOTP !== code) {
        return {
          status: 400,
          message: "Invalid OTP code",
          data: {},
        };
      }

      // Check if OTP is expired
      const now = new Date();
      const expiry = new Date(otpRecord.phoneCodeExpiry || new Date());

      if (now > expiry) {
        return {
          status: 400,
          message: "OTP has expired",
          data: {},
        };
      }

      // Mark phone as verified in OTP record, and migrate the row onto the
      // canonical form so the next lookup is a direct hit.
      await userOtpSerive.updatePart(
        { _id: (otpRecord as any)._id },
        {
          $set: {
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            phoneVerified: true,
            phoneVerifiedOn: new Date(),
          },
        }
      );

      // Get user for token generation, matching any stored form.
      const user = await uservice.findOne({ phone: phoneFilter });
      if (!user) {
        return {
          status: 404,
          message: "Phone number not registered",
          data: {},
        };
      }

      // Update user record, normalising the stored number at the same time.
      await uservice.updatePart(
        { _id: (user as any)._id },
        {
          $set: {
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            "verification.phoneVerified": true,
            "verification.phoneVerifiedOn": new Date(),
          },
        }
      );

      // Generate auth token
      const tokenResponse = await new JwtAuthUtil().issueToken(user);

      return {
        status: 200,
        message: "Phone verified successfully",
        data: tokenResponse,
      };
    } catch (err) {
      console.error("Error validating phone OTP:", err);
      return {
        status: 500,
        message: "Failed to validate phone OTP",
        data: {},
      };
    }
  }

  async loginWithPhone(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return {
          status: 400,
          message: "Phone number is required",
          data: {},
        };
      }

      // Matched against every stored form, so a member who types the national
      // form of their own number is not told it is unregistered.
      const user = await uservice.findOne({
        phone: phoneQuery(phone, req.body?.countryCode),
      });

      if (!user) {
        return {
          status: 404,
          message: "Phone number not registered",
          data: {},
        };
      }

      // Check if user has email for fallback
      const hasEmail =
        user.email &&
        !user.email.includes("phone_") &&
        !user.email.includes("placeholder");

      // Send OTP for login
      const otpResponse = await this.sendOtpToPhone(req, res);

      // Add fallback information if available
      if (hasEmail) {
        return {
          ...otpResponse,
          data: {
            ...otpResponse.data,
            hasFallback: true,
            fallbackEmail: user.email.replace(/(.{2})(.*)(.@.*)/, "$1*****$3"), // Mask email for security
          },
        };
      }

      return otpResponse;
    } catch (err) {
      console.error("Error in phone login:", err);
      return {
        status: 500,
        message: "Failed to login with phone",
        data: {},
      };
    }
  }

  // Add fallback login method
  async fallbackToEmailLogin(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return {
          status: 400,
          message: "Phone number is required",
          data: {},
        };
      }

      // Find user by phone
      const user = await uservice.findOne({
        phone: phoneQuery(phone, req.body?.countryCode),
      });

      if (!user || !user.email || user.email.includes("placeholder")) {
        return {
          status: 404,
          message: "No associated email account found",
          data: {},
        };
      }

      // Send email OTP instead
      const emailOTP = Math.floor(100000 + Math.random() * 900000);
      const emailCodeExpiry = new Date();
      emailCodeExpiry.setMinutes(emailCodeExpiry.getMinutes() + 15);

      await uservice.updatePart(
        { _id: user._id },
        {
          $set: {
            "verification.emailCode": emailOTP,
            "verification.emailCodeExpiry": emailCodeExpiry,
          },
        }
      );

      // Send email
      await emailService.sendReviewEmail2(
        user.email,
        "User",
        emailOTP.toString(),
        "login"
      );

      return {
        status: 200,
        message: "OTP sent to email",
        data: { email: user.email.replace(/(.{2})(.*)(.@.*)/, "$1*****$3") },
      };
    } catch (err) {
      console.error("Error in fallback login:", err);
      return {
        status: 500,
        message: "Failed to send email OTP",
        data: {},
      };
    }
  }

  private async encryptOTP(otpCode: string): Promise<string> {
    try {
      // In a real implementation, use a proper crypto library
      // This is a simplified example using Node's crypto module
      const crypto = require("crypto");
      const algorithm = "aes-256-ctr";
      const secretKey =
        process.env.OTP_ENCRYPTION_KEY || "your-secret-encryption-key";
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
      const encrypted = Buffer.concat([cipher.update(otpCode), cipher.final()]);

      return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      console.error("OTP encryption error:", error);
      // Return plain OTP if encryption fails
      return otpCode;
    }
  }

  private async decryptOTP(encryptedOTP: string): Promise<string> {
    try {
      // Skip decryption if the OTP doesn't appear to be encrypted
      if (!encryptedOTP.includes(":")) {
        return encryptedOTP;
      }

      const crypto = require('crypto');
      const algorithm = 'aes-256-ctr';
      const secretKey = process.env.OTP_ENCRYPTION_KEY || 'your-secret-encryption-key';

      const [ivHex, encryptedHex] = encryptedOTP.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
      const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

      return decrypted.toString();
    } catch (error) {
      console.error("OTP decryption error:", error);
      // Return the original value if decryption fails
      return encryptedOTP;
    }
  }
}
