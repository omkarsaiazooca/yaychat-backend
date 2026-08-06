import { Request, Response } from "express";
import {
  AuthProviders,
  Currency,
  CurrencyType,
  PaymentTypes,
  TransactionAccount,
} from "../data/common";
import { MessageConstants } from "../data/constants";
import { CoreWallet } from "../data/coreWallet";
import { Order, OrderBreakdown, OrderStatus, Rates } from "../data/order";
import {
  TaskCenter,
  signUpPoints,
  tradeToEarnPercentage,
} from "../data/taskCenter";
import {
  User,
  UserLite,
  UserRoleTypes,
  UserVerification,
  UserWallet,
} from "../data/user";
import { UserBugs } from "../data/userBugs";
import { createFirstTimeWallets } from "../helpers/createWallet";
import { IndexxService } from "../services/IndexxTokens.service";
import { AppSettingsService } from "../services/appSettings.service";
import { CoreWalletService } from "../services/coreWallet.service";
import { CurrencyService } from "../services/currency.service";
import { OrderService } from "../services/order.service";
import { PaypalService } from "../services/paypal.service";
import { RewardService } from "../services/reward.service";
import { TaskCenterService } from "../services/taskCenter.service";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";
import { UserBugsService } from "../services/userBugs.service";
import { WalletUserService } from "../services/walletUser.service";
import { BaseAPIOperations } from "./base.operations";
import { SendEmail } from "./email.operations";
import { JwtAuthUtil } from "./jwt.operations";
import { OrderOperations } from "./order.operations";
import { getPrevDayPriceByName, getPriceByName } from "../controllers/priceAPI";
import { WalletTransactionService } from "../services/walletTransaction.service";
import { Transaction } from "../data/transaction";
import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";
import { keys } from "../config/keys";
import { decryptData, encryptData } from "../services/crypto.service";
import Web3 from "web3";
import { BridgeCoinsService } from "../services/bridgeCoins.service";
import { BridgeCoins } from "../data/bridgeCoins";
import axios from "axios";
import { getLatestPriceOfETF } from "./etf.operations";

const bitcoin = require("bitcoinjs-lib");
const env = keys.env.key;
let network = bitcoin.networks.bitcoin; //use networks.testnet for testnet
let path = "m/49'/0'/0'/0/0"; //use testnet path "m/44'/1'/0'/0/0" for testnet
console.log("env", env);
if (env == "development" || env == "test") {
  network = bitcoin.networks.testnet;
} else if (env == "main" || env == "prod") {
  network = bitcoin.networks.bitcoin;
}

const referralCodes = require("referral-codes");
let baseAPIURL = "https://api.changenow.io";
const API = axios.create({
  baseURL: baseAPIURL,
});

let uservice: UserService = new UserService();
let wuserservice: WalletUserService = new WalletUserService();
let emailService: SendEmail = new SendEmail();
let orderService: OrderService = new OrderService();
let rewardService: RewardService = new RewardService();
let indexxTokenService: IndexxService = new IndexxService();
let wTransactionService: WalletTransactionService =
  new WalletTransactionService();
let appSettingsService: AppSettingsService = new AppSettingsService();
let currencyService: CurrencyService = new CurrencyService();
let coreWalletService: CoreWalletService = new CoreWalletService();
let bugService: UserBugsService = new UserBugsService();
let taskCenterService: TaskCenterService = new TaskCenterService();
let paypalService: PaypalService = new PaypalService();
let bridgeCoinsService: BridgeCoinsService = new BridgeCoinsService();
export class WalletUserOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  get registerFields() {
    return {
      basic: 1,
      authProviders: 1,
      email: 1,
      verification: 1,
      role: 1,
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
    };
  }

  async registerUser(
    req: any,
    res: any,
    email: string,
    password: string,
    referralCode?: string
  ) {
    let register = await uservice.findOneSelect(
      { email: email },
      this.registerFields
    );
    if (register) {
      for (let i = 0; i < register.authProviders.length; i++) {
        if (register.authProviders[i].provider == "Local") {
          const message = MessageConstants.EmailRegistered;
          //const message = "emailRegistered";
          return { status: 500, data: message };
        } else {
          return { status: 500, data: "" };
        }
      }
      const message = "emailRegistered";
      return { status: 500, data: message };
    } else {
      const generateRefCode = referralCodes.generate({
        length: 8,
      });
      const newUser: User = {
        email: String(email).toLowerCase(),
        role: UserRoleTypes.Standard,
        authProviders: [{ provider: AuthProviders.Local }],
        verification: { emailVerified: false } as UserVerification,
        baseCurrency: Currency.USD,
        referralCodeUsed: referralCode,
        referralCode: generateRefCode[0],
      } as User;
      let getReferredUser = await uservice.findOne({
        referralCode: referralCode,
      });

      // Check if referral code is valid
      if (getReferredUser) {
        let getReferredUserTaskCenter = await taskCenterService.findOne({
          email: getReferredUser.email,
        });

        if (getReferredUserTaskCenter) {
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
        } else {
          newUser.referralCodeUsed = "";
        }
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

      await createFirstTimeWallets(createUser.email);

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

      /* send email */
      let res = await emailService.sendReviewEmail2(
        email,
        "User",
        emailOTP.toString()
      );
      if (res.status == 200) {
        const message = "createdUser";
        return { status: 200, data: message };
      } else {
        const message = "errorWhileSendingEmail";
        return { status: 500, data: message };
      }
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

  async issueToken(req: any, res: any) {
    let { email, password } = req.body;
    email = String(email).toLowerCase();
    let user = await uservice.findOneSelect(
      { email: email },
      this.registerFields
    );
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
  }

  async issueTokenAdmin(req: any, res: any) {
    let { email, password } = req.body;
    email = String(email).toLowerCase();
    let user = await uservice.findOneSelect(
      { email: email },
      this.registerFields
    );
    if (user && user.role === UserRoleTypes.Admin) {
      let isMatch = await uservice.comparePassword(
        password,
        user.authProviders[0].phash
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
                const message = "emailVerified";
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
      if (user) {
        let getPassword = await uservice.createPassword(password);
        let updateUser = await uservice.updatePart(
          { _id: user._id, email: user.email },
          {
            $set: {
              "authProviders.0.phash": getPassword.hash,
              "authProviders.0.psalt": getPassword.salt,
            },
          }
        );
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
      return { status: 500, data: err };
    }
  }

  async changePassword(req: any, res: any) {
    try {
      let { email, oldPassword, newPassword } = req.body;
      email = String(email).toLowerCase();
      let user = await uservice.findOne({ email: email });
      if (user) {
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

  async resendEmailCode(req: any, res: any) {
    try {
      let { email } = req.body;
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
        await emailService.sendReviewEmail2(email, "User", emailOTP.toString());
        return { status: 200, data: "message" };
      } else {
        const message = "emailNotRegistered";
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
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
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

  async updatePersonalDetails(req: any, res: any) {
    try {
      let { firstName, lastName, phone, photo, email } = req.body;
      console.log(req.body);
      email = String(email).toLowerCase();
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let updateDetails = await wuserservice.updatePart(
          { email: email },
          {
            $set: {
              "basic.firstName": firstName,
              "basic.lastName": lastName,
              phone: phone,
              "basic.profilePhoto": photo,
            },
          }
        );
        if (updateDetails) {
          let user = await wuserservice.findOneSelect(
            { email: email },
            {
              phone: 1,
              userId: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              role: 1,
              isVerified: 1,
              language: 1,
              photo: 1,
            }
          );
          const message = "Successfully updated personal details";
          return { status: 200, data: user };
        } else {
          const message = "Failed to updated personal details";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateBankDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let {
        bankName,
        ifscCode,
        accountNumber,
        accountHolderName,
        accountHolderAddress,
        accountIBAN,
      } = req.body;
      let user = await wuserservice.findOneSelect({ email: email }, {});
      let accountDetails = {
        accountType: PaymentTypes.BankDirect,
        accountId: "",
        currency: Currency.USD,
        accountBankName: bankName,
        accountNumber: accountNumber,
        accountHolderName: accountHolderName,
        accountHolderAddress: accountHolderAddress,
        accountIBAN: accountIBAN,
      };
      if (user) {
        let updateDetails = await wuserservice.updatePart(
          { email: email, accounts: user.accounts[0] },
          {
            $set: { "account.$": accountDetails },
          }
        );
        if (updateDetails) {
          let user = await wuserservice.findOneSelect(
            { email: email },
            {
              phone: 1,
              userId: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              role: 1,
              isVerified: 1,
              language: 1,
              photo: 1,
            }
          );
          const message = "Successfully updated personal details";
          return { status: 200, data: user };
        } else {
          const message = "Failed to updated personal details";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addAccount(req: any, res: any) {
    try {
      let { privateKey, coinName, email } = req.body;
      email = String(email).toLowerCase();
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        if (coinName === "Bitcoin") {
          const ECPair = ECPairFactory(ecc);
          const keyPair = ECPair.fromPrivateKey(privateKey, network);
          const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: network,
          });
          let encryptedPrivateKey = encryptData(keyPair.toWIF());
          let userWallet = {
            userId: user._id,
            coinType: CurrencyType.Crypto,
            coinWalletAddress: address,
            coinPrivateKey: encryptedPrivateKey,
            coinBalance: 0,
            coinLastUsed: new Date(),
            coinNetwork: "Bitcoin",
            coinName: "Bitcoin",
            coinSymbol: "BTC",
            coinDecimals: 8,
            coinBalanceInUSD: 0,
            coinBalanceInBTC: 0,
            coinPrice: 0,
            isCoinActive: true,
            coinCreatedOn: new Date(),
            coinLastUsedOn: new Date(),
            isImported: true,
          };
          let updateWallet = await wuserservice.updatePart(
            { email: email },
            { $push: { userWallets: userWallet } }
          );
          const message = "Account imported";
          return { status: 200, data: message };
        } else if (coinName === "Binance") {
          let addressObj = new Web3().eth.accounts.privateKeyToAccount(
            "0x" + privateKey
          );
          let encryptedPrivateKey = encryptData(addressObj.privateKey);
          let createUserWallet = {
            userId: user._id,
            coinType: CurrencyType.Crypto,
            coinWalletAddress: addressObj.address,
            coinPrivateKey: encryptedPrivateKey,
            coinNetwork: "Binance",
            coinName: "Binance",
            coinSymbol: "BNB",
            coinDecimals: 18,
            coinBalance: 0,
            coinBalanceInUSD: 0,
            coinBalanceInBTC: 0,
            coinCreatedOn: new Date(),
            coinLastUsedOn: new Date(),
            isCoinActive: true,
            isImported: true,
          };
          let updateWallet = await wuserservice.updatePart(
            { email: email },
            { $push: { userWallets: createUserWallet } }
          );
          const message = "Account imported";
          return { status: 200, data: message };
        } else if (coinName === "Ethereum") {
          let addressObj = new Web3().eth.accounts.privateKeyToAccount(
            "0x" + privateKey
          );
          let encryptedPrivateKey = encryptData(addressObj.privateKey);
          let createUserWallet = {
            userId: user._id,
            coinType: CurrencyType.Crypto,
            coinWalletAddress: addressObj.address,
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
            isImported: true,
          };
          let updateWallet = await wuserservice.updatePart(
            { email: email },
            { $push: { userWallets: createUserWallet } }
          );
          const message = "Account imported";
          return { status: 200, data: message };
        } else if (coinName === "Polygon") {
          let addressObj = new Web3().eth.accounts.privateKeyToAccount(
            "0x" + privateKey
          );
          let encryptedPrivateKey = encryptData(addressObj.privateKey);
          let createUserWallet = {
            userId: user._id,
            coinType: CurrencyType.Crypto,
            coinWalletAddress: addressObj.address,
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
            isImported: true,
          };
          let updateWallet = await wuserservice.updatePart(
            { email: email },
            { $push: { userWallets: createUserWallet } }
          );
          const message = "Account imported";
          return { status: 200, data: message };
        } else {
          const message = "Coin not supported";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async addBridgeCoins(req: any, res: any) {
    try {
      let {
        amountFrom,
        amountTo,
        payinAddress,
        payoutAddress,
        fromCurrency,
        toCurrency,
        txId,
        fromNetwork,
        toNetwork,
        email,
        status,
        actionsAvailable,
        expectedAmountFrom,
        expectedAmountTo,
        updatedAt,
        createdAt,
        depositReceivedAt,
        toLegacyTicker,
        fromLegacyTicker,
        payoutHash,
        payinHash,
      } = req.body;
      email = String(email).toLowerCase();
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let createNewRecord = {
          txId: txId,
          status: status,
          actionsAvailable: actionsAvailable,
          fromCurrency: fromCurrency,
          fromNetwork: fromNetwork,
          toCurrency: toCurrency,
          toNetwork: toNetwork,
          expectedAmountFrom: expectedAmountFrom,
          expectedAmountTo: expectedAmountTo,
          amountFrom: amountFrom,
          amountTo: amountTo,
          payinAddress: payinAddress,
          payoutAddress: payoutAddress,
          payinExtraId: null,
          payoutExtraId: null,
          refundAddress: null,
          refundExtraId: null,
          createdAt: createdAt,
          updatedAt: updatedAt,
          validUntil: null,
          depositReceivedAt: depositReceivedAt,
          payinHash: payinHash,
          payoutHash: payoutHash,
          fromLegacyTicker: fromLegacyTicker,
          toLegacyTicker: toLegacyTicker,
          refundHash: null,
          refundAmount: null,
          email: email,
        } as BridgeCoins;
        let createNewBridge = await bridgeCoinsService.create(createNewRecord);
        return { status: 200, data: createNewBridge };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateBridgeCoins(req: any, res: any) {
    try {
      let {
        amountFrom,
        amountTo,
        payinAddress,
        payoutAddress,
        fromCurrency,
        toCurrency,
        txId,
        fromNetwork,
        toNetwork,
        email,
        status,
        actionsAvailable,
        expectedAmountFrom,
        expectedAmountTo,
        updatedAt,
        createdAt,
        depositReceivedAt,
        toLegacyTicker,
        fromLegacyTicker,
        payoutHash,
        payinHash,
      } = req.body;
      email = String(email).toLowerCase();
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let findBridgeRecord = await bridgeCoinsService.findOne({
          email: email,
          txId: txId,
        });
        if (findBridgeRecord) {
          let updateBridgeRecord = await bridgeCoinsService.updatePart(
            {
              email: email,
              txId: txId,
            },
            {
              $set: {
                status: status,
                actionsAvailable: actionsAvailable,
                fromCurrency: fromCurrency,
                fromNetwork: fromNetwork,
                toCurrency: toCurrency,
                toNetwork: toNetwork,
                expectedAmountFrom: expectedAmountFrom,
                expectedAmountTo: expectedAmountTo,
                amountFrom: amountFrom,
                amountTo: amountTo,
                payinAddress: payinAddress,
                payoutAddress: payoutAddress,
                payinExtraId: null,
                payoutExtraId: null,
                refundAddress: null,
                refundExtraId: null,
                createdAt: createdAt,
                updatedAt: updatedAt,
                validUntil: null,
                depositReceivedAt: depositReceivedAt,
                payinHash: payinHash,
                payoutHash: payoutHash,
                fromLegacyTicker: fromLegacyTicker,
                toLegacyTicker: toLegacyTicker,
                refundHash: null,
                refundAmount: null,
              },
            }
          );
          return { status: 200, data: updateBridgeRecord };
        } else {
          const message = "Bridge Record not Found";
          return { status: 500, data: message };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async findBridgeCoins(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let allBridgeRecords = await bridgeCoinsService.findOne({
          email: email,
        });
        return { status: 200, data: allBridgeRecords };
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createBridgeCoinExchange(req: any, res: any) {
    try {
      let {
        fromAmount,
        flow,
        payoutAddress,
        fromCurrency,
        toCurrency,
        fromNetwork,
        toNetwork,
      } = req.body;
      const axiosConfig = {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "x-changenow-api-key":
            "3072e4f3234644ef6769aa7a6299f88a3d43204a36f8da6b3f66b5e0a99e5115",
        },
      };
      const postData = {
        fromCurrency: fromCurrency,
        toCurrency: toCurrency,
        fromNetwork: fromNetwork,
        toNetwork: toNetwork,
        fromAmount: fromAmount,
        address: payoutAddress,
        flow: flow,
      };
      const res = await API.post("/v2/exchange", postData, axiosConfig);
      if (res.status === 200) {
        return { status: 200, data: res.data };
      } else {
        return { status: res.status, data: res.data };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getBridgeByTxId(req: any, res: any) {
    try {
      const axiosConfig = {
        headers: {
          "x-changenow-api-key":
            "3072e4f3234644ef6769aa7a6299f88a3d43204a36f8da6b3f66b5e0a99e5115",
        },
      };
      const res = await API.get(
        "/v2/exchange/by-id?id=" + req.params.txId,
        axiosConfig
      );
      if (res.status === 200) {
        return { status: 200, data: res.data };
      } else {
        return { status: res.status, data: res.data };
      }
    } catch (err) {
      return { status: 500, data: err };
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

  async getUsersLite(req: any, res: any) {
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

  async getUserWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let myArray = user.userWallets;
        for (var i = 0; i < myArray.length; i++) {
          myArray[i].coinPrivateKey = "";
          if (
            myArray[i].coinSymbol.includes("iUSD+") ||
            myArray[i].coinSymbol.includes("INEX") ||
            myArray[i].coinSymbol.includes("INXC") ||
            myArray[i].coinSymbol.includes("DaCrazy") ||
            myArray[i].coinSymbol.includes("WIBS") ||
            myArray[i].coinSymbol.includes("IN500")
          ) {
            let priceData = await currencyService.findOne({
              code:
                myArray[i].coinSymbol === "iUSD+"
                  ? "IUSD+"
                  : myArray[i].coinSymbol,
            });
            myArray[i].coinPrice = priceData.buyPrice;
          } else {
            let priceData = await getPriceByName(myArray[i].coinSymbol);
            myArray[i].coinPrice = priceData.data;
          }
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

  async getUserWallets1(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let myArray = user.userWallets;
        for (var i = 0; i < myArray.length; i++) {
          myArray[i].coinPrivateKey = "";
          if (
            myArray[i].coinSymbol.includes("iUSD+") ||
            myArray[i].coinSymbol.includes("IUSD+") ||
            myArray[i].coinSymbol.includes("INEX") ||
            myArray[i].coinSymbol.includes("DaCrazy") ||
            myArray[i].coinSymbol.includes("INXC") ||
            myArray[i].coinSymbol.includes("WIBS") ||
            myArray[i].coinSymbol.includes("IN500")
          ) {
            let priceData = await currencyService.findOne({
              code:
                myArray[i].coinSymbol === "iUSD+"
                  ? "IUSD+"
                  : myArray[i].coinSymbol,
            });
            myArray[i].coinPrice = priceData.buyPrice;
          } else {
            let priceData = await getPriceByName(myArray[i].coinSymbol);
            myArray[i].coinPrice = priceData.data;
            let prevPriceData = await getPrevDayPriceByName(myArray[i].coinSymbol);
            console.log("prevPriceData", prevPriceData)
            myArray[i].coinPrevPrice = prevPriceData.data;
          }
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

  async getUserSpecificWallet(req: any, res: any) {
    try {
      let { email, coinName } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let userFilteredWallet: UserWallet = user.userWallets.find(
          (x) => x.coinName == coinName
        ) as UserWallet;
        if (userFilteredWallet) {
          userFilteredWallet.coinPrivateKey = "";
          if (
            userFilteredWallet.coinSymbol.includes("iUSD+") ||
            userFilteredWallet.coinSymbol.includes("INEX") ||
            userFilteredWallet.coinSymbol.includes("WIBS") ||
            userFilteredWallet.coinSymbol.includes("DaCrazy") ||
            userFilteredWallet.coinSymbol.includes("INXC") ||
            userFilteredWallet.coinSymbol.includes("IN500")
          ) {
            let priceData = await currencyService.findOne({
              code:
                userFilteredWallet.coinSymbol === "iUSD+"
                  ? "IUSD+"
                  : userFilteredWallet.coinSymbol,
            });
            userFilteredWallet.coinPrice = priceData.buyPrice;
          } else if (
            userFilteredWallet.coinSymbol.includes("EQSTK") ||
            userFilteredWallet.coinSymbol.includes("INDXXF") ||
            userFilteredWallet.coinSymbol.includes("CRYC10") ||
            userFilteredWallet.coinSymbol.includes("TOB") ||
            userFilteredWallet.coinSymbol.includes("ALCRYP")
          ) {
            const getLatestPrice = await getLatestPriceOfETF(userFilteredWallet.coinSymbol);
            console.log("I am here", getLatestPrice)
            userFilteredWallet.coinPrice = Number(getLatestPrice?.data.totalETFPrice);
          } else {
            let priceData = await getPriceByName(userFilteredWallet.coinSymbol);
            userFilteredWallet.coinPrice = priceData.data;
          }
          let getFromTxDetails = await wTransactionService.find({
            email: email,
            from: userFilteredWallet.coinWalletAddress,
          });
          let getToTxDetails = await wTransactionService.find({
            email: email,
            to: userFilteredWallet.coinWalletAddress,
          });
          let arrTx = getToTxDetails.concat(getFromTxDetails);
          userFilteredWallet.transactions = arrTx;
          return { status: 200, data: userFilteredWallet };
        } else {
          return { status: 500, data: `No wallet found for ${coinName}` };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }
  async getUserSpecificWalletKey(req: any, res: any) {
    try {
      let { email, coinName } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let userFilteredWallet: UserWallet = user.userWallets.find(
          (x) => x.coinName == coinName
        ) as UserWallet;
        if (userFilteredWallet) {
          userFilteredWallet.coinPrivateKey = decryptData(
            userFilteredWallet.coinPrivateKey
          );

          if (
            userFilteredWallet.coinSymbol.includes("iUSD+") ||
            userFilteredWallet.coinSymbol.includes("INEX") ||
            userFilteredWallet.coinSymbol.includes("DaCrazy") ||
            userFilteredWallet.coinSymbol.includes("WIBS") ||
            userFilteredWallet.coinSymbol.includes("INXC") ||
            userFilteredWallet.coinSymbol.includes("IN500")
          ) {
            let priceData = await currencyService.findOne({
              code:
                userFilteredWallet.coinSymbol === "iUSD+"
                  ? "IUSD+"
                  : userFilteredWallet.coinSymbol,
            });
            userFilteredWallet.coinPrice = priceData.buyPrice;
          } else {
            let priceData = await getPriceByName(userFilteredWallet.coinSymbol);
            userFilteredWallet.coinPrice = priceData.data;
          }
          let getFromTxDetails = await wTransactionService.find({
            email: email,
            from: userFilteredWallet.coinWalletAddress,
          });
          let getToTxDetails = await wTransactionService.find({
            email: email,
            to: userFilteredWallet.coinWalletAddress,
          });
          let arrTx = getToTxDetails.concat(getFromTxDetails);
          userFilteredWallet.transactions = arrTx;
          return { status: 200, data: userFilteredWallet };
        } else {
          return { status: 500, data: `No wallet found for ${coinName}` };
        }
      } else {
        const message = "emailNotRegistered";
        return { status: 500, data: message };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async getTransactions(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        let transactions = await wTransactionService.find({
          email: email,
        });
        return { status: 200, data: transactions };
      } else {
        return { status: 500, data: "emailNotRegistered" };
      }
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
      console.log(coinWallet);
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

  // async uploadBugFile(req: any, res: any, file: any) {
  //   let responseData = [];
  //   for (let i = 0; i < file.length; i++) {
  //     let results = {} as BugDocument;
  //     let documentData = {} as BugDocumentLite;
  //     let key = file[i].filename;
  //     results = {
  //       fileMode: FileModes.Standard,
  //       fileType: file[i].mimetype,
  //       uniqueName: key,
  //       title: file[i].originalname,
  //     } as BugDocument;
  //     let uploadCertificate = await fileservice.create(results);
  //     documentData = {
  //       _id: uploadCertificate._id,
  //       fileType: file[i].mimetype,
  //       title: file[i].originalname,
  //     };
  //     responseData.push(documentData);
  //   }
  //   res.statusCode = 200;
  //   res.send({ status: 200, data: responseData });
  //   return;
  // }

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
}
