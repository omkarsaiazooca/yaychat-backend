import Binance from "node-binance-api";
import { keys } from "../config/keys";
import {
  getCryptoPriceBySymobl,
  getPriceByName,
  getsStockPriceByName,
} from "../controllers/priceAPI";
import { PriceTicker } from "../data/priceTicker";
import { getLatestFTTPrice } from "../helpers/getFTTPrice";
import { JwtAuthUtil } from "../platform/jwt.operations";
import { PriceOperations } from "../platform/price.operations";
import { UserOperations } from "../platform/user.operations";
import { CurrencyService } from "../services/currency.service";
import { OrderService } from "../services/order.service";
import { UserService } from "../services/user.service";
import axios from "axios";
import {
  fetchStockData,
  fetchStockDataWithHistory,
  getLatestStockPrice,
} from "../helpers/twelveDataLatestPrice";
import { Request, Response } from "express";
import { getLatestPriceOfETF } from "../platform/etf.operations";
import {
  checkUserType,
  checkUserTypeByUsername,
} from "../helpers/checkUserTypeBasedOnEmail";
import { LotteryService } from "../services/lottery.service";
import { LotteryTicketService } from "../services/lotteryTicket.service";
import { Lottery, Ticket } from "../data/lottery";
import { UserCartTicketService } from "../services/userCartTicket.service";
import { v1 as uuidv1 } from "uuid";
import { CoinClaim, UserLite, UserWallet } from "../data/user";
import { Order, OrderBreakdown, OrderStatus, Rates } from "../data/order";
import { PaymentTypes, TransactionAccount } from "../data/common";
import { TransactionService } from "../services/transaction.service";
import { decode } from "jsonwebtoken";
import { NewGiftCardService } from "../services/newGiftCard.service";
import { NewGiftCard } from "../data/newGiftCard";
import { NewGiftCardOperations } from "../platform/newGiftCard.operations";
import { createClient } from "redis";
import { AmbassadorSevice } from "../services/ambassador.service";
import { Ambassador } from "../data/ambassador";
import { DailyMiningStatsService } from "../services/dailyMiningStats.service";
import { verifyAppleToken, verifyGoogleToken } from "../helpers/authHelpers";
import { LinkedAccountService } from "../services/linkedAccount.service";
import { LinkedAccountBonusLogService } from "../services/linkedAccountBonusLog.service";
import { SendEmail } from "../platform/email.operations";
import { WhitelistService } from "../services/whitelist.service";
import * as bcrypt from "bcryptjs";

const binance = new Binance().options({
  APIKEY: keys.BinanceKey.key,
  APISECRET: keys.BinanceSecret.key,
  family: 4,
});
const txservice: TransactionService = new TransactionService();
const currencyService: CurrencyService = new CurrencyService();
const orderService: OrderService = new OrderService();
const userService: UserService = new UserService();
const lotteryService: LotteryService = new LotteryService();
const ticketService: LotteryTicketService = new LotteryTicketService();
const dailyStatsService = new DailyMiningStatsService();
const userCartTicketService: UserCartTicketService =
  new UserCartTicketService();
const newGiftCardService: NewGiftCardService = new NewGiftCardService();
const ambassadorSevice: AmbassadorSevice = new AmbassadorSevice();
const linkedAccountService: LinkedAccountService = new LinkedAccountService();
const linkedAccountBonusLogService: LinkedAccountBonusLogService =
  new LinkedAccountBonusLogService();
const notificationEmailService: SendEmail = new SendEmail();
const whitelistService: WhitelistService = new WhitelistService();
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

export class UserController {
  constructor() {
    this.loginWithOtp = this.loginWithOtp.bind(this);
    this.sendErrorResponse = this.sendErrorResponse.bind(this);
    this.sendResponse = this.sendResponse.bind(this);
    this.fundWallet = this.fundWallet.bind(this);
  }

  async getUserMiningReward(req: any, res: any) {
    try {
      let { email, coinSymbol } = req.params;
      if (!email || email == undefined || !coinSymbol || coinSymbol == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserMiningBalance(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async withdrawBTCY(req: any, res: any) {
    try {
      let { email, coinSymbol } = req.body;
      // if (email === "sunkuomkarsai@gmail.com") {

      // } else {
      //   res.statusCode = 400;
      //   res.send({ message: "App under Maintenance. Please try again later", status: 400, data: "App under Maintenance. Please try again later" });
      //   return;
      // }
      if (!email || email == undefined || !coinSymbol || coinSymbol == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }


      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.withdrawUserBalance(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
  async getAllMiningUsers(req: any, res: any) {
    try {
      let { coinSymbol } = req.params;
      if (!coinSymbol || coinSymbol == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllMiningUsers(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserMiningSubscriptionPlan(req: any, res: any) {
    try {
      let { email, coinSymbol } = req.params;
      if (!email || email == undefined || !coinSymbol || coinSymbol == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserMiningSubscriptionPlan(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserMiningPlanWithPaymentMethod(req: any, res: any) {
    try {
      let { email, coinSymbol } = req.params;
      if (!email || email == undefined || !coinSymbol || coinSymbol == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserMiningPlanWithPaymentMethod(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllMiningSubscriptionPlans(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllMiningSubscriptionPlan(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.checkEmailIfAlreadyUsed(
        req,
        res,
        String(email).toLowerCase()
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkByEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.checkEmailIfAlreadyUsedAndUserType(
        req,
        res,
        String(email).toLowerCase()
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkByPhone(req: any, res: any) {
    try {
      let { phone } = req.body;
      if (!phone || phone == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.checkPhoneIfAlreadyUsedAndUserType(
        req,
        res,
        String(phone).toLowerCase()
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkByWalletEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.checkWalletEmailIfAlreadyUsedAndUserType(
        req,
        res,
        String(email).toLowerCase()
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async checkWhitelistStatus(req: any, res: any) {
    try {
      let { email } = req.params;
      
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ 
          status: 400, 
          data: { 
            whitelisted: false,
            message: "Email is required" 
          } 
        });
        return;
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const isWhitelisted = await whitelistService.isEmailWhitelisted(normalizedEmail);

      res.statusCode = 200;
      res.send({ 
        status: 200, 
        data: { 
          email: normalizedEmail,
          whitelisted: isWhitelisted 
        } 
      });
      return;
    } catch (err) {
      console.error("Error checking whitelist status:", err);
      res.statusCode = 500;
      res.send({ 
        status: 500, 
        data: { 
          whitelisted: false,
          message: "Unhandled error: " + err 
        } 
      });
      return;
    }
  }

  async checkUsername(req: any, res: any) {
    try {
      let { username } = req.body;
      if (!username || username == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.checkUsernameIfAlreadyUsed(
        req,
        res,
        username
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async registerUser(req: any, res: any) {
    try {
      let { email, password, username, referralCode, registerFrom } = req.body;
      if (
        (!email && !password) ||
        email == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      console.log(req.body);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.registerUser(
        req,
        res,
        String(email).toLowerCase(),
        password,
        username,
        referralCode,
        false,
        referralCode ? "HoneyBeeRegister" : "",
        registerFrom
      );
      res.statusCode = dataResults?.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async registerUserWithApp(req: any, res: any) {
    try {
      let { email, password, username, referralCode, registerFrom } = req.body;
      if (
        (!email && !password) ||
        email == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      console.log(req.body);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.registerUserFromApp(
        req,
        res,
        String(email).toLowerCase(),
        password,
        username,
        referralCode,
        false,
        referralCode ? "HoneyBeeRegister" : "",
        registerFrom
      );
      console.log("dataResults", dataResults)
      if (dataResults.status === 200) {
        await dailyStatsService.incrNewUserForToday("BTCY", email);
      }
      res.statusCode = dataResults?.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log("err in registerUserWithApp", err)
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async registerUserWithAppTest(req: any, res: any) {
    try {
      let { email, password, username, referralCode, registerFrom } = req.body;
      if (
        (!email && !password) ||
        email == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      console.log(req.body);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.registerUserFromApp(
        req,
        res,
        String(email).toLowerCase(),
        password,
        username,
        referralCode,
        false,
        referralCode ? "HoneyBeeRegister" : "",
        registerFrom
      );
      console.log("dataResults", dataResults)
      res.statusCode = dataResults?.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log("err in registerUserWithApp", err)
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async registerUser0(req: any, res: any) {
    try {
      let { email, password, username, referralCode, registerFrom } = req.body;
      if (
        (!email && !password) ||
        email == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      console.log(req.body);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.registerUser0(
        req,
        res,
        String(email).toLowerCase(),
        password,
        username,
        referralCode,
        false,
        referralCode ? "HoneyBeeRegister" : "",
        registerFrom
      );
      res.statusCode = dataResults?.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async registerUserWithApple(req: any, res: any) {
    try {
      const { appleToken, referralCode, registerFrom, languageSelected } = req.body;

      console.log("req.body", req.body)

      console.log("appleToken, referralCode, registerFrom", appleToken, referralCode, registerFrom)
      if (!appleToken) {
        res.status(400).send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.registerUserWithApple(
        req,
        res,
        appleToken,
        referralCode,
        registerFrom,
        languageSelected
      );

      if (dataResults.status === 200) {
        const appleUserInfo = await verifyAppleToken(appleToken);
        const { email } = appleUserInfo;
        await dailyStatsService.incrNewUserForToday("BTCY", email);
      }
      console.log(dataResults)
      res.status(dataResults.status).send(dataResults);
    } catch (err) {
      console.log("err", err)
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async registerUserWithGoogle(req: any, res: any) {
    try {
      const { googleToken, referralCode, registerFrom, languageSelected } = req.body;
      if (!googleToken) {
        res.status(400).send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.registerUserWithGoogle(
        req,
        res,
        googleToken,
        referralCode,
        registerFrom,
        languageSelected
      );
      if (dataResults.status === 200) {
        const googleUserInfo = await verifyGoogleToken(googleToken); // You need to implement this function
        const { email } = googleUserInfo;
        await dailyStatsService.incrNewUserForToday("BTCY", email);
      }
      res.status(dataResults.status).send(dataResults);
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async loginUserWithGoogle(req: any, res: any) {
    try {
      const { googleToken } = req.body;
      if (!googleToken) {
        res.status(400).send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.loginWithGoogle(req, res, googleToken);
      console.log("dataResults", dataResults);
      if (dataResults?.status == 200) {
        let results = await userOps.issueTokenWithEmail(dataResults.email);
        res.statusCode = results.status;
        res.send(results);
        return;
      } else {
        res
          .status(500)
          .send({ status: 500, data: { message: dataResults.data } });
      }
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }


  async loginUserWithApple(req: any, res: any) {
    try {
      const { appleToken } = req.body;
      if (!appleToken) {
        res.status(400).send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.loginWithApple(req, res, appleToken);
      console.log("dataResults", dataResults);
      if (dataResults?.status == 200) {
        let results = await userOps.issueTokenWithEmail(String(dataResults?.email));
        res.statusCode = results.status;
        res.send(results);
        return;
      } else {
        res
          .status(500)
          .send({ status: 500, data: { message: dataResults.data } });
      }
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async issueToken(req: any, res: any) {
    try {
      // Validate request
      if (!req.body.password) {
        return this.sendErrorResponse(res, 400, "Password is required");
      }

      // Initialize user operations
      const userOps = new UserOperations(req, res);
      const results = await userOps.issueToken(req, res);

      console.log("results", results);
      // Send the response based on results
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async loginWithOtp(req: any, res: any) {
    try {
      const { email, code } = req.body;

      // Basic validation
      if (!email || !code) {
        return this.sendErrorResponse(res, 400, "Email and OTP code are required");
      }

      const userOps = new UserOperations(req, res);

      // 1) Verify OTP (expects { email, code } in req.body)
      const verification = await userOps.validateOtp(req, res);

      if (!verification || verification.status !== 200) {
        const message = "Invalid or expired OTP code";
        return this.sendErrorResponse(res, 401, message);
      }

      // 2) Issue tokens for the user
      const results = await userOps.issueTokenWithEmail(String(email).toLowerCase());

      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }




  // Helper method for success response
  sendResponse(res: any, statusCode: number, data: any) {
    res.statusCode = statusCode;
    res.send({ status: statusCode, data });
  }

  // Helper method for error response
  sendErrorResponse(res: any, statusCode: number, message: string, err?: any) {
    const errorMsg = err ? `${message}: ${err}` : message;
    res.statusCode = statusCode;
    res.send({ status: statusCode, data: { message: errorMsg } });
  }

  async issueTokenWithSignInToken(req: any, res: any) {
    try {
      if (!req.body.signInToken || req.body.signInToken == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      let siteName = req.body.siteName;
      console.log(siteName === "lottery");
      if (siteName === "lottery") {
        const userOps = new UserOperations(req, res);
        let results = await userOps.issueToken(req, res);
        res.statusCode = results.status;
        res.send(results);
        return;
      }
      let userType = "";
      let userObj: any = decode(req.body.signInToken);
      console.log("userObj", userObj);
      if (userObj?.email) {
        userType = await checkUserType(String(userObj.email).toLowerCase());
        console.log("userType", userType);
      }

      const userOps = new UserOperations(req, res);
      let results = await userOps.issueTokenForSignInToken(
        req,
        res,
        userObj?.email
      );

      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async issueTokenHive(req: any, res: any) {
    try {
      // Validate password
      if (!req.body.password) {
        return this.sendErrorResponse(res, 400, "Password is required");
      }

      // Initialize user operations
      const userOps = new UserOperations(req, res);

      // Check if siteName is lottery and issue token accordingly
      const results = await userOps.issueTokenHive(req, res);

      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async refreshToken(req: any, res: any) {
    try {
      let refreshtoken = null;

      // First check for refresh token in Authorization header as Bearer token
      const authHeader = req.headers["authorization"];
      if (authHeader) {
        if (authHeader.startsWith("Bearer ")) {
          refreshtoken = authHeader.substring(7); // Remove "Bearer " prefix
        } else {
          refreshtoken = authHeader;
        }
      }

      if (!refreshtoken) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Refresh token not found in Authorization header or request body" } });
        return;
      }

      const tokenResponse = await new JwtAuthUtil().refreshToken(refreshtoken);
      res.statusCode = 200;
      res.send({ status: 200, data: tokenResponse });
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async validateUserToken(req: any, res: any) {
    try {
      // Token validation is already handled by validateAuthHeader middleware
      // req.user contains the decoded token data
      const userData = req.user as any;

      res.statusCode = 200;
      res.send({
        status: 200,
        data: {
          message: "Token is valid",
          user: {
            email: userData.email,
            username: userData.username,
            role: userData.role,
          }
        }
      });
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async logout(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.logout(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateEmail(req: any, res: any) {
    try {
      let { email, code } = req.body;
      if (!email || email == undefined || !code || code == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.validateEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sendOtpToEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.sendOtpToEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sendForgotOtpToEmail(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.sendForgotOtpToEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateEmailOtp(req: any, res: any) {
    try {
      let { email, code } = req.body;
      if (!email || email == undefined || !code || code == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.validateOtp(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateForgotEmailOtp(req: any, res: any) {
    try {
      let { email, code } = req.body;
      if (!email || email == undefined || !code || code == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.validateForgotOtp(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async resetPassword(req: any, res: any) {
    try {
      let { email, code, password } = req.body;
      if (
        !email ||
        // !code ||
        !password ||
        email == undefined ||
        // code == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.resetPassword(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async resetPasswordWithPhone(req: any, res: any) {
    try {
      let { phone, code, password } = req.body;
      if (
        !phone ||
        !password ||
        phone == undefined ||
        // code == undefined ||
        password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.resetPasswordWithPhone(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async changePassword(req: any, res: any) {
    try {
      let { oldPassword, newPassword, email } = req.body;
      if (
        !email ||
        !oldPassword ||
        !newPassword ||
        email == undefined ||
        oldPassword == undefined ||
        newPassword == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.changePassword(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async setPassword(req: any, res: any) {
    try {
      let { email, password } = req.body;

      // Validate required fields
      if (!email || !password || email == undefined || password == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Email and password are required" } });
        return;
      }

      // Additional validation
      if (typeof email !== 'string' || typeof password !== 'string') {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Email and password must be valid strings" } });
        return;
      }

      // Trim and validate email format
      email = email.trim();
      if (!email.includes('@') || email.length < 5) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Please provide a valid email address" } });
        return;
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.setPassword(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.error("Controller setPassword error:", err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async forgotPassword(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.forgotPassword(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async resendEmailCode(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.resendEmailCode(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserLiteDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserLiteDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getMiningLiteDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getMiningLiteDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllUserDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllUserDetailsForAdmin(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllUserDetailsForAdmin(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getHoneybeeUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getHoneyBeeUserDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUsers(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllUsers(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUsersCount(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserCount(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUsersLite(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUsersLite(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getHiveUsersLite(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getHiveUsersLite(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserOrders(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserCompletedOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserCompletedOrders(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserOrder(req: any, res: any) {
    try {
      let { email, orderId } = req.params;
      if (!email || email == undefined || !orderId || orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      console.log("email", email);
      console.log("orderId", orderId);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserOrder(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserMiningSubscriptionOrders(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      console.log("email", email);
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserMiningSubscriptionOrders(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserRewardDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserRewardDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateRewards(req: any, res: any) {
    try {
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateRewardWalletAddress(req: any, res: any) {
    try {
      let { email, rewardWalletAddress } = req.body;
      if (
        !email ||
        email == undefined ||
        rewardWalletAddress == undefined ||
        !rewardWalletAddress
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.updateRewardWalletAddress(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async addRewards(req: any, res: any) {
    try {
      let email = req.body.email;
      let orderId = req.body.orderId;
      if (email && orderId && email == undefined && orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.addRewards(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async fundWallet(req: any, res: any) {
    try {
      const { email, amount, currency = "USD" } = req.body;
      
      if (!email || !amount) {
        res.statusCode = 400;
        res.send({ 
          status: 400, 
          data: { message: "Email and amount are required" } 
        });
        return;
      }

      if (amount <= 0) {
        res.statusCode = 400;
        res.send({ 
          status: 400, 
          data: { message: "Amount must be greater than 0" } 
        });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.fundWallet(req, res);
      
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ 
        status: 500, 
        data: { message: "Unhandled error: " + err } 
      });
      return;
    }
  }

  async addRewardsForCoursePurchase(req: any, res: any) {
    try {
      let email = req.body.email;
      let orderId = req.body.orderId;
      if (email && orderId && email == undefined && orderId == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.addRewardsForCoursePurchase(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllRefferedUsers(req: any, res: any) {
    try {
      let email = req.params.email;
      if (email && email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllReferredUsers(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateGiftCard(req: any, res: any) {
    try {
      const { voucher } = req.body;

      if (!voucher) {
        return res
          .status(400)
          .json({ status: 400, error: "Voucher code is required" });
      }

      const giftCard = (await newGiftCardService.findOne({
        voucher: voucher,
      })) as NewGiftCard;

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 404,
          error: "This voucher code has already been used",
        });
      }
      const inexToUsdRate = await getPriceByName("INEX");
      const wibsToUsdRate = await getPriceByName("WIBS");
      let finalTokens =
        giftCard.type === "INEX"
          ? giftCard.amount / inexToUsdRate.data
          : giftCard.amount / wibsToUsdRate.data;
      return res.status(200).json({
        status: 200,
        data: {
          message: "Voucher code is valid",
          value: `${finalTokens} ${giftCard.type}`,
        },
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({ status: 500, error: error.message });
    }
  }

  async redeemGiftCard(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card redemption is currently disabled",
      });

      const { voucher, email } = req.body;

      if (!voucher || !email) {
        return res.status(400).json({
          status: 400,
          error: "redeem code and User email Address are required",
        });
      }

      const giftCard = await newGiftCardService.findOne({ voucher: voucher });

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid redeem code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 400,
          error: "This redeem code has already been used",
        });
      }

      const giftCardOperations = new NewGiftCardOperations(req, res);
      const result = await giftCardOperations.redeemGiftCardCoupon(
        req,
        res,
        giftCard,
        email
      );

      // Mark gift card as used
      await newGiftCardService.updatePart(
        {
          voucher: voucher,
        },
        {
          $set: {
            isUsed: true,
            redeemedOn: new Date(),
            redeemedBy: email,
          },
        }
      );

      const usdRate = await getPriceByName(giftCard.type);
      let redeemValue;
      if (giftCard?.baseCurrency && giftCard.baseCurrency === "USD") {
        redeemValue = giftCard.amount / usdRate.data;
      } else {
        redeemValue = giftCard.amount;
      }

      const newTx = await txservice.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: "",
        to: "",
        amount: redeemValue,
        info: "Gift Card Redeem by user",
        notes: `Gift Card (${giftCard.voucher}) Redeem by user`,
        status: OrderStatus.Completed,
        currencyRef: giftCard.type,
        walletType: "ASSET_WALLET",
        transactionType: "Gift Redeem",
        exchangeName: "CEX",
        txDate: new Date(),
        benificaryAddress: "",
      });
      console.log("newTx", newTx);
      return res.status(200).json({
        message: "Voucher redeemed successfully",
        value: redeemValue,
        currency: giftCard.type,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getAllGiftCards(req: any, res: any) {
    try {
      let email = req.params.email;

      if (email && email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllGiftCards(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getLeaderboard(req: any, res: any) {
    try {
      let coin = req.params.coin;
      let nextToken = req.query.nextToken ? parseInt(req.query.nextToken) : 0;

      if (!coin) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getLeaderboard(req, res, coin, nextToken);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createGiftCard(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card creation is currently disabled",
      });

      const { amount, currency, giftCardUrl } = req.body;

      if (!amount || !currency || !giftCardUrl) {
        return res.status(400).json({
          status: 400,
          error: "All fields are required",
        });
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.createNewGiftCard(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      console.log(err);
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validateTokenSell(req: any, res: any) {
    try {
      const { amount, currency, email } = req.body;

      if (!amount || !currency || !email) {
        return res.status(400).json({
          status: 400,
          error: "All fields are required",
        });
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.validateTokenSell(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async addPersonalInfo(req: any, res: any) {
    try {
      const { country, personalIdNumber, email } = req.body;

      if (!country || !personalIdNumber || !email) {
        return res.status(400).json({
          status: 400,
          error: "All fields are required",
        });
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.addPersonalInfo(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async applyForAmbassador(req: Request, res: Response) {

    const { fullName, email, bio, socialProfiles } = req.body;

    // Optional: prevent duplicate email submissions
    const existing = await ambassadorSevice.findOne({ email, status: 'Pending' });
    if (existing) {
      return res.status(409).json({ error: 'Application already submitted and pending.' });
    }

    // Build a fully-typed payload
    const payload: any = {
      fullName,
      email,
      bio,
      socialProfiles,
      status: 'Pending',        // required by the interface
      submittedAt: new Date()   // required by the interface
    };

    const record = await ambassadorSevice.create(payload);

    res.status(201).json({ id: record._id, status: record.status });
  }


  async getAmbassadors(req: Request, res: Response) {

    const list = await ambassadorSevice.find({});
    if (!list) {
      return res.status(200).json({ data: [] });
    }

    res.status(200).json({ data: list, });
  }

  async registerBtcySocialPostAirdrop(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.btcySocialPostAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }


  async sendGiftCard(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card sending is currently disabled",
      });

      const { giftcardVoucher, senderEmail, recevierEmail } = req.body;

      if (!giftcardVoucher || !senderEmail || !recevierEmail) {
        return res.status(400).json({
          status: 400,
          error: "All fields are required",
        });
      }

      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.sendGiftCard(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async addPhone(req: any, res: any) {
    try {
      let { email, phone } = req.body;
      if (!email || email == undefined || !phone || phone == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      } else {
        const userOps = new UserOperations(req, res);
        let dataResults = await userOps.addPhone(req, res);
        res.statusCode = dataResults.status;
        res.send(dataResults);
        return;
      }
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async verifyPhone(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.verifyPhone(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.genericWallets(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async getDemoUserWallets(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.genericDemoWallets(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async totalInvestmentForEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.calculateTotalInvestment(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }


  async getPrivacySettings(req: any, res: any) {
    try {
      const email = req.params.email.toLowerCase();

      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getPrivacySettings(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async totalDemoInvestmentForEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.calculateDemoTotalInvestment(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async getTransactions(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getTransactions(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getTransactionReport(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getTransactionsReport(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBalance(req: any, res: any) {
    try {
      let email = req.params.email;
      email = String(email).toLowerCase();

      const coin = req.params.coin;
      if (email == undefined || coin == undefined || !email || !coin) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getBalance(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBalanceByNetwork(req: any, res: any) {
    try {
      const email = req.params.email;
      const coin = req.params.coin;
      const network = req.params.network;
      if (
        email == undefined ||
        coin == undefined ||
        network == undefined ||
        !network ||
        !email ||
        !coin
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getBalanceByNetwork(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async debitBtcyYingYangBalance(req: any, res: any) {
    try {
      const apiKey = String(req.headers["x-wallstreet-key"] || "");
      const expected = "WSX_2026_RANDOM_KEY_#aB3@9fGh&kLmN8pQrS2tUvWxYz";
      if (!expected) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "WALLSTREET_API_KEY not configured" } });
        return;
      }
      if (!apiKey || apiKey !== expected) {
        res.statusCode = 403;
        res.send({ status: 403, data: { message: "Forbidden" } });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.debitBtcyYingYangBalance(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getWallstreetUsdBalance(req: any, res: any) {
    try {
      const apiKey = String(req.headers["x-wallstreet-key"] || "");
      const expected = "WSX_2026_RANDOM_KEY_#aB3@9fGh&kLmN8pQrS2tUvWxYz";
      if (!expected) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "WALLSTREET_API_KEY not configured" } });
        return;
      }
      if (!apiKey || apiKey !== expected) {
        res.statusCode = 403;
        res.send({ status: 403, data: { message: "Forbidden" } });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getWallstreetUsdBalance(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateWallstreetUsdBalance(req: any, res: any) {
    try {
      const apiKey = String(req.headers["x-wallstreet-key"] || "");
      const expected = "WSX_2026_RANDOM_KEY_#aB3@9fGh&kLmN8pQrS2tUvWxYz";
      if (!expected) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "WALLSTREET_API_KEY not configured" } });
        return;
      }
      if (!apiKey || apiKey !== expected) {
        res.statusCode = 403;
        res.send({ status: 403, data: { message: "Forbidden" } });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updateWallstreetUsdBalance(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }


  async getUserWalletbyNetwork(req: any, res: any) {
    try {
      const email = req.params.email;
      const coin = req.params.coin;
      const network = req.params.network;
      if (
        email == undefined ||
        coin == undefined ||
        network == undefined ||
        !network ||
        !email ||
        !coin
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getUserWalletByNetwork(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAcknowledgementStatus(req: any, res: any) {
    try {
      const email = req.params.email;
      if (
        email == undefined ||
        !email
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getAcknowledgementStatus(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateBtcyAcknowledgementStatus(req: any, res: any) {
    try {
      const email = req.body.email;
      if (
        email == undefined ||
        !email
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updateBtcyAcknowledgementStatus(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBTCYMigrationStatus(req: any, res: any) {
    try {
      const email = req.params.email;
      if (
        email == undefined ||
        !email
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.getBTCYMigrationStatus(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateBTCYMigrationStatus(req: any, res: any) {
    try {
      const email = req.body.email;
      if (
        email == undefined ||
        !email
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updateBTCYMigrationStatus(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateBTCYPrivacySettings(req: any, res: any) {
    try {
      const email = req.body.email;
      if (
        email == undefined ||
        !email
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updatePrivacySettings(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async createUserWalletbyNetwork(req: any, res: any) {
    try {
      const email = req.body.email;
      const coin = req.body.coin;
      const network = req.body.network;
      if (
        email == undefined ||
        coin == undefined ||
        network == undefined ||
        !network ||
        !email ||
        !coin
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.createUserWalletByNetwork(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async withdrawRewards(req: any, res: any) {
    try {
      const email = req.body.email;
      const amount = req.body.amount;
      if (email == undefined || amount == undefined || !email || !amount) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.withdrawRewards(req, res);
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

  async updateFavCurrencies(req: any, res: any) {
    try {
      const email = req.body.email;
      const currencies = req.body.currencies;
      if (
        email == undefined ||
        currencies == undefined ||
        !email ||
        !currencies
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updateFavCurrencies(req, res);
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

  async getPriceByName(req: any, res: any) {
    try {
      const coin = req.params.coin;
      if (coin == undefined || !coin) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }

      // Special handling: WIBS price via shared price API (cached)
      if (coin === "WIBS") {
        const priceResp = await getPriceByName("WIBS");
        const results = { data: priceResp.data, status: priceResp.status };
        res.statusCode = 200;
        res.send({ status: 200, data: { results } });
        return;
      }

      if (
        coin === "EQSTK" ||
        coin === "INDXXF" ||
        coin === "CRYC10" ||
        coin === "TOB" ||
        coin === "ALCRYP"
      ) {
        console.log("sending etf price");
        const getLatestPrice = await getLatestPriceOfETF(coin);
        let results = {
          status: 200,
          data: Number(getLatestPrice?.data.totalETFPrice),
        };
        res.statusCode = 200;
        // res.send(results);
        res.send({
          status: 200,
          data: {
            results,
          },
        });
        return;
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

      let results;
      if (
        coin == "IN500" ||
        coin == "INXC" ||
        coin == "IUSD+" ||
        coin == "INEX" ||
        coin == "INXP" ||
        coin == "SRT" ||
        coin == "DaCrazy"
      ) {
        let price = await currencyService.findOne({ code: coin });
        if (req.body.type == "Sell" || req.body.type == "Convert") {
          results = { data: price.sellPrice, status: 200 };
        } else {
          results = { data: price.buyPrice, status: 200 };
        }
      } else if (coin === "FTT") {
        let currentFTTPrice = await getLatestFTTPrice();
        results = { data: currentFTTPrice, status: 200 };
      } else if (tokens.includes(coin)) {
        let c: string =
          coin === "APPL"
            ? "AAPL"
            : coin === "AMZN"
              ? "AMZN"
              : coin === "BCM"
                ? "AVGO"
                : coin === "GOOGL"
                  ? "GOOGL"
                  : coin === "META"
                    ? "META"
                    : coin === "MSFT"
                      ? "MSFT"
                      : coin === "NVDA"
                        ? "NVDA"
                        : coin === "PEP"
                          ? "PEP"
                          : coin === "SNP500"
                            ? "SPX"
                            : coin === "TLSA"
                              ? "TSLA"
                              : "";
        console.log("c", c, coin);
        const getStockVale = await getLatestStockPrice(c);
        console.log("final price", getStockVale / 1);
        results = { data: getStockVale / 1, status: 200 };
      } else {
        results = await getPriceByName(coin);
      }
      res.statusCode = 200;
      // res.send(results);
      res.send({
        status: 200,
        data: {
          results,
        },
      });
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
      /*
      res.statusCode = 500;
      return res
        .send({ status: 500, data: { message: "Unhandled error: " + err } });*/
    }
  }

  async getAllStockPrices(req: any, res: any) {
    try {
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

      const tokenMap = {
        APPL: "AAPL",
        AMZN: "AMZN",
        BCM: "AVGO",
        GOOGL: "GOOGL",
        META: "META",
        MSFT: "MSFT",
        NVDA: "NVDA",
        PEP: "PEP",
        SNP500: "SPX",
        TLSA: "TSLA",
      } as any;

      let results: any[] = [];

      for (let coin of tokens) {
        const mappedCoin = tokenMap[coin] || coin;
        const stockValue = await getLatestStockPrice(mappedCoin);
        results.push({ token: coin, value: stockValue / 1000 });
      }

      res.statusCode = 200;
      res.send({
        status: 200,
        data: results,
      });
    } catch (err) {
      console.log(err);
      res.statusCode = 500;
      return res.send({
        status: 500,
        data: { message: "Unhandled error: " + err },
      });
    }
  }

  async fetchLatestStockPrice(symbol: string) {
    const endpoint = "https://api.twelvedata.com/time_series";

    try {
      if (symbol === "APPL") {
        symbol = "APPL";
      }
      const response = await axios.get(endpoint, {
        params: {
          symbol: symbol,
          interval: "1min", // You can adjust this based on your needs.
          apikey: process.env.TWELVE_DATA_API_KEY,
        },
      });
      if (
        response.data &&
        response.data.values &&
        response.data.values.length > 0
      ) {
        const latestPrice = Number(response.data.values[0].close); // Assumes the first item is the latest data point
        console.log(`The latest price for ${symbol} is $${latestPrice}`);
        return latestPrice;
      } else {
        console.log(`Failed to fetch data for ${symbol}`);
        return 0;
      }
    } catch (error: any) {
      console.error(`Error fetching stock price: ${error.message}`);
      return 0;
    }
  }

  async cryptoPriceByName(req: any, res: any) {
    try {
      let coin = req.body.coin;
      if (coin === "USDT") {
        console.log("I am here");
        coin = "USDC";
      }
      if (coin == undefined || !coin) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      let querySymbol = `${coin}USDT`;
      let results: PriceTicker = await binance.prevDay(querySymbol);
      let final = {
        symbol: results.symbol,
        priceChange: Number(results.priceChange),
        priceChangePercent: Number(results.priceChangePercent),
        lastPrice: Number(results.lastPrice),
      };
      res.statusCode = 200;
      res.send({ status: 200, data: final });
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getIndexxTokensPrice(req: any, res: any) {
    try {
      let INXCPrice = await currencyService.findOne({
        code: "INXC",
        type: "BUY",
      });
      let IN500Price = await currencyService.findOne({
        code: "IN500",
        type: "BUY",
      });
      let USDPPrice = await currencyService.findOne({
        code: "IUSD+",
        type: "BUY",
      });
      let INEXPrice = await currencyService.findOne({
        code: "INEX",
        type: "BUY",
      });
      let DaCrazyPrice = await currencyService.findOne({
        code: "DaCrazy",
        type: "BUY",
      });
      let INXPPrice = await currencyService.findOne({
        code: "INXP",
        type: "BUY",
      });
      let SRTPrice = await currencyService.findOne({
        code: "SRT",
        type: "BUY",
      });
      res.statusCode = 200;
      res.send({
        status: 200,
        data: {
          INXCPrice: INXCPrice.buyPrice,
          INXCpriceChangePercent: -1.2,
          IN500Price: IN500Price.buyPrice,
          IN500priceChangePercent: -0.41,
          IUSDPPrice: USDPPrice.buyPrice,
          IUSDPpriceChangePercent: 0.05,
          INEXPrice: INEXPrice.buyPrice,
          INEXpriceChangePercent: 0.0,
          INXPPrice: INXPPrice.buyPrice,
          INXPpriceChangePercent: 0.0,
          SRTPrice: SRTPrice.buyPrice,
          SRTPriceChangePercent: 0.0,
          DaCrazyPrice: DaCrazyPrice.buyPrice,
          DaCrazyPriceChangePercent: 0.0,
        },
      });
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async marketsData(req: any, res: any) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }

      const cacheKey = `market_data`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData !== null) {
        const cachedResult = JSON.parse(cachedData);
        return res.status(200).send({
          status: 200,
          data: cachedResult.data,
          topGainers: cachedResult.topGainers,
          topLosers: cachedResult.topLosers,
          topVolumes: cachedResult.topVolumes,
        });
      }
      const [INXCPrice, IN500Price, USDPPrice, INEXPrice, BTCYPrice, INXPPrice, wibsResp] = await Promise.all([
        currencyService.findOne({ code: "INXC", type: "BUY" }),
        currencyService.findOne({ code: "IN500", type: "BUY" }),
        currencyService.findOne({ code: "IUSD+", type: "BUY" }),
        currencyService.findOne({ code: "INEX", type: "BUY" }),
        currencyService.findOne({ code: "BTCY", type: "BUY" }),
        currencyService.findOne({ code: "INXP", type: "BUY" }),
        getPriceByName("WIBS"),
      ]);
      const wibsPrice = Number((wibsResp as any)?.data ?? 0);
      const priceOps = new PriceOperations(req, res);
      const marketVolumeSymbols = [
        "BTC","ETH","BNB","LTC","XRP","USDC","DOGE","SOL","TRX",
        "DAI","SHIB","LINK","USDT","TUSD","BCH","MATIC","DOT",
        "CHZ","VET","AVAX","THETA","NOT","FTM","RUNE","NEAR","AAVE",
        "INJ","PYTH","BEAM","XLM","SUI","ADA","MANA","IN500","INEX",
        "WIBS","INXC","IUSD+","INXP","BTCY","ALCRYP","EQSTK","INDXXF",
        "CRYC10","TOB"
      ];
      const marketVols = await Promise.all(
        marketVolumeSymbols.map(async (s) => ({ s, v: await priceOps.volumes(s) }))
      );
      const vmap: any = Object.fromEntries(marketVols.map(({ s, v }) => [s, v]));
      let volumesBTC = vmap["BTC"]; let volumesETH = vmap["ETH"]; let volumesBNB = vmap["BNB"]; let volumesLTC = vmap["LTC"]; let volumesXRP = vmap["XRP"]; let volumesUSDC = vmap["USDC"]; let volumesDOGE = vmap["DOGE"]; let volumesSOL = vmap["SOL"]; let volumesTRX = vmap["TRX"]; let volumesDAI = vmap["DAI"]; let volumesSHIB = vmap["SHIB"]; let volumesLINK = vmap["LINK"]; let volumesUSDT = vmap["USDT"]; let volumesTUSD = vmap["TUSD"]; let volumesBCH = vmap["BCH"]; let volumesMATIC = vmap["MATIC"]; let volumesDOT = vmap["DOT"]; let volumesCHZ = vmap["CHZ"]; let volumesVET = vmap["VET"]; let volumesAVAX = vmap["AVAX"]; let volumesTHETA = vmap["THETA"]; let volumesNOT = vmap["NOT"]; let volumesFTM = vmap["FTM"]; let volumesRUNE = vmap["RUNE"]; let volumesNEAR = vmap["NEAR"]; let volumesAAVE = vmap["AAVE"]; let volumesINJ = vmap["INJ"]; let volumesPYTH = vmap["PYTH"]; let volumesBEAM = vmap["BEAM"]; let volumesXLM = vmap["XLM"]; let volumesSUI = vmap["SUI"]; let volumesADA = vmap["ADA"]; let volumesMANA = vmap["MANA"]; let volumesIN500 = vmap["IN500"]; let volumesINEX = vmap["INEX"]; let volumesWIBS = vmap["WIBS"]; let volumesINXC = vmap["INXC"]; let volumesIUSDP = vmap["IUSD+"]; let volumesINXP = vmap["INXP"]; let volumesBTCY = vmap["BTCY"]; let volumesALCRYP = vmap["ALCRYP"]; let volumesEQSTK = vmap["EQSTK"]; let volumesINDXXF = vmap["INDXXF"]; let volumesCRYC10F = vmap["CRYC10"]; let volumesTOB = vmap["TOB"]; let volumesFTT = await priceOps.FTTDeposits();
      const [
        getBTCData,
        getETHData,
        getLTCData,
        getBNBData,
        getDOGEData,
        getUSDCData,
        getUSDTData,
        getSOLData,
        getTRXData,
        getXRPData,
        getDAIData,
        getSHIBData,
        getLINKData,
        getTUSDData,
        getBCHData,
        getMATICData,
        getDOTData,
        getCHZData,
        getVETData,
        getAVAXData,
        getTHETAData,
        getNOTData,
        getFTMData,
        getRUNEData,
        getNEARData,
        getAAVEData,
        getINJData,
        getPYTHData,
        getBEAMData,
        getADAData,
        getXLMData,
        getSUIData,
        getMANAMData,
        getEQSTKData,
        getCRYC10Data,
        getALCRYPData,
        getINDXXFData,
        getTOBData,
        userData,
      ] = await Promise.all([
        getCryptoPriceBySymobl("BTC"),
        getCryptoPriceBySymobl("ETH"),
        getCryptoPriceBySymobl("LTC"),
        getCryptoPriceBySymobl("BNB"),
        getCryptoPriceBySymobl("DOGE"),
        getCryptoPriceBySymobl("USDC"),
        getCryptoPriceBySymobl("USDT"),
        getCryptoPriceBySymobl("SOL"),
        getCryptoPriceBySymobl("TRX"),
        getCryptoPriceBySymobl("XRP"),
        getCryptoPriceBySymobl("DAI"),
        getCryptoPriceBySymobl("SHIB"),
        getCryptoPriceBySymobl("LINK"),
        getCryptoPriceBySymobl("TUSD"),
        getCryptoPriceBySymobl("BCH"),
        getCryptoPriceBySymobl("MATIC"),
        getCryptoPriceBySymobl("DOT"),
        getCryptoPriceBySymobl("CHZ"),
        getCryptoPriceBySymobl("VET"),
        getCryptoPriceBySymobl("AVAX"),
        getCryptoPriceBySymobl("THETA"),
        getCryptoPriceBySymobl("NOT"),
        getCryptoPriceBySymobl("FTM"),
        getCryptoPriceBySymobl("RUNE"),
        getCryptoPriceBySymobl("NEAR"),
        getCryptoPriceBySymobl("AAVE"),
        getCryptoPriceBySymobl("INJ"),
        getCryptoPriceBySymobl("PYTH"),
        getCryptoPriceBySymobl("BEAMX"),
        getCryptoPriceBySymobl("ADA"),
        getCryptoPriceBySymobl("XLM"),
        getCryptoPriceBySymobl("SUI"),
        getCryptoPriceBySymobl("MANA"),
        getLatestPriceOfETF("EQSTK"),
        getLatestPriceOfETF("CRYC10"),
        getLatestPriceOfETF("ALCRYP"),
        getLatestPriceOfETF("INDXXF"),
        getLatestPriceOfETF("TOB"),
        userService.findOne({ email: req.body.email }),
      ]);
      
      let favCurrencies =
        userData?.favouriteCurrencies === null ||
          userData?.favouriteCurrencies === undefined
          ? []
          : userData?.favouriteCurrencies;
      console.log("favCurrencies", favCurrencies);

      let EQSTKData = {
        Name: "EqStocks ETF",
        Symbol: "EQSTK",
        Price: getEQSTKData.data.totalETFPrice,
        Volume: volumesEQSTK,
        Change: 0,
        IUSDPrice: getEQSTKData.data.totalETFPrice / 0.99,
        BTCPrice: getEQSTKData.data.totalETFPrice / getBTCData.data.lastPrice,
        ETHPrice: getEQSTKData.data.totalETFPrice / getETHData.data.lastPrice,
        BNBPrice: getEQSTKData.data.totalETFPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getEQSTKData.data.totalETFPrice,
        HighPrice: getEQSTKData.data.totalETFPrice,
        Favourite: favCurrencies.includes("EQSTK") ? true : false,
        allStockPrice: getEQSTKData.data.individualPrices,
      };

      let INDXXFData = {
        Name: "Indexx Focus ETF",
        Symbol: "INDXXF",
        Price: getINDXXFData.data.totalETFPrice,
        Volume: volumesINDXXF,
        Change: 0,
        IUSDPrice: getINDXXFData.data.totalETFPrice / 0.99,
        BTCPrice: getINDXXFData.data.totalETFPrice / getBTCData.data.lastPrice,
        ETHPrice: getINDXXFData.data.totalETFPrice / getETHData.data.lastPrice,
        BNBPrice: getINDXXFData.data.totalETFPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getINDXXFData.data.totalETFPrice,
        HighPrice: getINDXXFData.data.totalETFPrice,
        Favourite: favCurrencies.includes("INDXXF") ? true : false,
        allStockPrice: getINDXXFData.data.individualPrices,
      };

      let CRYC10Data = {
        Name: "CryptoCap 10 ETF",
        Symbol: "CRYC10",
        Price: getCRYC10Data.data.totalETFPrice,
        Volume: volumesCRYC10F,
        Change: 0,
        IUSDPrice: getCRYC10Data.data.totalETFPrice / 0.99,
        BTCPrice: getCRYC10Data.data.totalETFPrice / getBTCData.data.lastPrice,
        ETHPrice: getCRYC10Data.data.totalETFPrice / getETHData.data.lastPrice,
        BNBPrice: getCRYC10Data.data.totalETFPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getCRYC10Data.data.totalETFPrice,
        HighPrice: getCRYC10Data.data.totalETFPrice,
        Favourite: favCurrencies.includes("CRYC10") ? true : false,
        allStockPrice: getCRYC10Data.data.individualPrices,
      };

      let ALCRYPData = {
        Name: "AlphaCrypto ETF",
        Symbol: "ALCRYP",
        Price: getALCRYPData.data.totalETFPrice,
        Volume: volumesALCRYP,
        Change: 0,
        IUSDPrice: getALCRYPData.data.totalETFPrice / 0.99,
        BTCPrice: getALCRYPData.data.totalETFPrice / getBTCData.data.lastPrice,
        ETHPrice: getALCRYPData.data.totalETFPrice / getETHData.data.lastPrice,
        BNBPrice: getALCRYPData.data.totalETFPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getALCRYPData.data.totalETFPrice,
        HighPrice: getALCRYPData.data.totalETFPrice,
        Favourite: favCurrencies.includes("ALCRYP") ? true : false,
        allStockPrice: getALCRYPData.data.individualPrices,
      };

      let TOBData = {
        Name: "Token Blend ETF",
        Symbol: "TOB",
        Price: getTOBData.data.totalETFPrice,
        Volume: volumesTOB,
        Change: 0,
        IUSDPrice: getTOBData.data.totalETFPrice / 0.99,
        BTCPrice: getTOBData.data.totalETFPrice / getBTCData.data.lastPrice,
        ETHPrice: getTOBData.data.totalETFPrice / getETHData.data.lastPrice,
        BNBPrice: getTOBData.data.totalETFPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getTOBData.data.totalETFPrice,
        HighPrice: getTOBData.data.totalETFPrice,
        Favourite: favCurrencies.includes("TOB") ? true : false,
        allStockPrice: getTOBData.data.individualPrices,
      };

      let CHZData = {
        Name: "Chiliz",
        Symbol: "CHZ",
        Price: getCHZData.data.lastPrice,
        Volume: volumesCHZ,
        Change: getCHZData.data.priceChangePercent,
        IUSDPrice: getCHZData.data.lastPrice / 0.99,
        BTCPrice: getCHZData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getCHZData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getCHZData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getCHZData.data.lowPrice,
        HighPrice: getCHZData.data.highPrice,
        Favourite: favCurrencies.includes("CHZ") ? true : false,
      };

      let VETData = {
        Name: "VeChain",
        Symbol: "VET",
        Price: getVETData.data.lastPrice,
        Volume: volumesVET,
        Change: getVETData.data.priceChangePercent,
        IUSDPrice: getVETData.data.lastPrice / 0.99,
        BTCPrice: getVETData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getVETData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getVETData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getVETData.data.lowPrice,
        HighPrice: getVETData.data.highPrice,
        Favourite: favCurrencies.includes("VET") ? true : false,
      };

      let AVAXData = {
        Name: "Avalanche",
        Symbol: "AVAX",
        Price: getAVAXData.data.lastPrice,
        Volume: volumesAVAX,
        Change: getAVAXData.data.priceChangePercent,
        IUSDPrice: getAVAXData.data.lastPrice / 0.99,
        BTCPrice: getAVAXData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getAVAXData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getAVAXData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$16.67B",
        CirculatingSupply: "409.91M",
        LowPrice: getAVAXData.data.lowPrice,
        HighPrice: getAVAXData.data.highPrice,
        Favourite: favCurrencies.includes("AVAX") ? true : false,
      };

      let THETAData = {
        Name: "Theta Network",
        Symbol: "THETA",
        Price: getTHETAData.data.lastPrice,
        Volume: volumesTHETA,
        Change: getTHETAData.data.priceChangePercent,
        IUSDPrice: getTHETAData.data.lastPrice / 0.99,
        BTCPrice: getTHETAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTHETAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTHETAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$16.67B",
        CirculatingSupply: "409.91M",
        LowPrice: getTHETAData.data.lowPrice,
        HighPrice: getTHETAData.data.highPrice,
        Favourite: favCurrencies.includes("THETA") ? true : false,
      };

      let NOTData = {
        Name: "NotCoin",
        Symbol: "NOT",
        Price: getNOTData.data.lastPrice,
        Volume: volumesNOT,
        Change: getNOTData.data.priceChangePercent,
        IUSDPrice: getNOTData.data.lastPrice / 0.99,
        BTCPrice: getNOTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getNOTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getNOTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNOTData.data.lowPrice,
        HighPrice: getNOTData.data.highPrice,
        Favourite: favCurrencies.includes("NOT") ? true : false,
      };

      let FTMData = {
        Name: "Fantom",
        Symbol: "FTM",
        Price: getFTMData.data.lastPrice,
        Volume: volumesFTM,
        Change: getFTMData.data.priceChangePercent,
        IUSDPrice: getFTMData.data.lastPrice / 0.99,
        BTCPrice: getFTMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getFTMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getFTMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getFTMData.data.lowPrice,
        HighPrice: getFTMData.data.highPrice,
        Favourite: favCurrencies.includes("FTM") ? true : false,
      };

      let RUNEData = {
        Name: "Thor Chain",
        Symbol: "RUNE",
        Price: getRUNEData.data.lastPrice,
        Volume: volumesRUNE,
        Change: getRUNEData.data.priceChangePercent,
        IUSDPrice: getRUNEData.data.lastPrice / 0.99,
        BTCPrice: getRUNEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getRUNEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getRUNEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getRUNEData.data.lowPrice,
        HighPrice: getRUNEData.data.highPrice,
        Favourite: favCurrencies.includes("RUNE") ? true : false,
      };

      let NEARData = {
        Name: "Near Protocol",
        Symbol: "NEAR",
        Price: getNEARData.data.lastPrice,
        Volume: volumesNEAR,
        Change: getNEARData.data.priceChangePercent,
        IUSDPrice: getNEARData.data.lastPrice / 0.99,
        BTCPrice: getNEARData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getNEARData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getNEARData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNEARData.data.lowPrice,
        HighPrice: getNEARData.data.highPrice,
        Favourite: favCurrencies.includes("NEAR") ? true : false,
      };

      let AAVEData = {
        Name: "Aave Coin",
        Symbol: "AAVE",
        Price: getAAVEData.data.lastPrice,
        Volume: volumesAAVE,
        Change: getAAVEData.data.priceChangePercent,
        IUSDPrice: getAAVEData.data.lastPrice / 0.99,
        BTCPrice: getAAVEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getAAVEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getAAVEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getAAVEData.data.lowPrice,
        HighPrice: getAAVEData.data.highPrice,
        Favourite: favCurrencies.includes("AAVE") ? true : false,
      };

      let INJData = {
        Name: "Injective",
        Symbol: "INJ",
        Price: getINJData.data.lastPrice,
        Volume: volumesINJ,
        Change: getINJData.data.priceChangePercent,
        IUSDPrice: getINJData.data.lastPrice / 0.99,
        BTCPrice: getINJData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getINJData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getINJData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getINJData.data.lowPrice,
        HighPrice: getINJData.data.highPrice,
        Favourite: favCurrencies.includes("INJ") ? true : false,
      };

      let PYTHData = {
        Name: "Pyth Network",
        Symbol: "PYTH",
        Price: getPYTHData.data.lastPrice,
        Volume: volumesPYTH,
        Change: getPYTHData.data.priceChangePercent,
        IUSDPrice: getPYTHData.data.lastPrice / 0.99,
        BTCPrice: getPYTHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getPYTHData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getPYTHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getPYTHData.data.lowPrice,
        HighPrice: getPYTHData.data.highPrice,
        Favourite: favCurrencies.includes("PYTH") ? true : false,
      };

      // let CROData = {
      //   Name: "Cronos",
      //   Symbol: "CRO",
      //   Price: getCROData.data.lastPrice,
      //   Volume: volumesCRO,
      //   Change: getCROData.data.priceChangePercent,
      //   IUSDPrice: getCROData.data.lastPrice / 0.99,
      //   BTCPrice: getCROData.data.lastPrice / getBTCData.data.lastPrice,
      //   ETHPrice: getCROData.data.lastPrice / getETHData.data.lastPrice,
      //   BNBPrice: getCROData.data.lastPrice / getBNBData.data.lastPrice,
      //   MarketCap: "$4.62B",
      //   CirculatingSupply: "26.91B",
      //   LowPrice: getCROData.data.lowPrice,
      //   HighPrice: getCROData.data.highPrice,
      //   Favourite: favCurrencies.includes("CRO") ? true : false,
      // };

      let BEAMData = {
        Name: "Beam",
        Symbol: "BEAM",
        Price: getBEAMData.data.lastPrice,
        Volume: volumesBEAM,
        Change: getBEAMData.data.priceChangePercent,
        IUSDPrice: getBEAMData.data.lastPrice / 0.99,
        BTCPrice: getBEAMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBEAMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBEAMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getBEAMData.data.lowPrice,
        HighPrice: getBEAMData.data.highPrice,
        Favourite: favCurrencies.includes("BEAM") ? true : false,
      };

      let ADAData = {
        Name: "Cardano",
        Symbol: "ADA",
        Price: getADAData.data.lastPrice,
        Volume: volumesADA,
        Change: getADAData.data.priceChangePercent,
        IUSDPrice: getADAData.data.lastPrice / 0.99,
        BTCPrice: getADAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getADAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getADAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$30.82B",
        CirculatingSupply: "35.13B",
        LowPrice: getADAData.data.lowPrice,
        HighPrice: getADAData.data.highPrice,
        Favourite: favCurrencies.includes("ADA") ? true : false,
      };

      let XLMData = {
        Name: "Steller",
        Symbol: "XLM",
        Price: getXLMData.data.lastPrice,
        Volume: volumesXLM,
        Change: getXLMData.data.priceChangePercent,
        IUSDPrice: getXLMData.data.lastPrice / 0.99,
        BTCPrice: getXLMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getXLMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getXLMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$10.67B",
        CirculatingSupply: "30.91B",
        LowPrice: getXLMData.data.lowPrice,
        HighPrice: getXLMData.data.highPrice,
        Favourite: favCurrencies.includes("XLM") ? true : false,
      };
      let SUIData = {
        Name: "SUI",
        Symbol: "SUI",
        Price: getSUIData.data.lastPrice,
        Volume: volumesSUI,
        Change: getSUIData.data.priceChangePercent,
        IUSDPrice: getSUIData.data.lastPrice / 0.99,
        BTCPrice: getSUIData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getSUIData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getSUIData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$10.67B",
        CirculatingSupply: "30.91B",
        LowPrice: getSUIData.data.lowPrice,
        HighPrice: getSUIData.data.highPrice,
        Favourite: favCurrencies.includes("SUI") ? true : false,
      };

      let MANAData = {
        Name: "Decentraland",
        Symbol: "MANA",
        Price: getMANAMData.data.lastPrice,
        Volume: volumesMANA,
        Change: getMANAMData.data.priceChangePercent,
        IUSDPrice: getMANAMData.data.lastPrice / 0.99,
        BTCPrice: getMANAMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getMANAMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getMANAMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$915.67M",
        CirculatingSupply: "1.95B",
        LowPrice: getMANAMData.data.lowPrice,
        HighPrice: getMANAMData.data.highPrice,
        Favourite: favCurrencies.includes("MANA") ? true : false,
      };

      let BTCData = {
        Name: "Bitcoin",
        Symbol: "BTC",
        Price: getBTCData.data.lastPrice,
        Volume: volumesBTC,
        Change: getBTCData.data.priceChangePercent,
        IUSDPrice: getBTCData.data.lastPrice / 0.99,
        BTCPrice: getBTCData.data.lastPrice,
        ETHPrice: getBTCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBTCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "18.63M",
        LowPrice: getBTCData.data.lowPrice,
        HighPrice: getBTCData.data.highPrice,
        Favourite: favCurrencies.includes("BTC") ? true : false,
      };

      let ETHData = {
        Name: "Ethereum",
        Symbol: "ETH",
        Price: getETHData.data.lastPrice,
        Volume: volumesETH,
        Change: getETHData.data.priceChangePercent,
        IUSDPrice: getETHData.data.lastPrice / 0.99,
        BTCPrice: getETHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getETHData.data.lastPrice,
        BNBPrice: getETHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$149.8B",
        CirculatingSupply: "112.5M",
        LowPrice: getETHData.data.lowPrice,
        HighPrice: getETHData.data.highPrice,
        Favourite: favCurrencies.includes("ETH") ? true : false,
      };

      let LTCData = {
        Name: "Litecoin",
        Symbol: "LTC",
        Price: getLTCData.data.lastPrice,
        Volume: volumesLTC,
        Change: getLTCData.data.priceChangePercent,
        IUSDPrice: getLTCData.data.lastPrice / 0.99,
        BTCPrice: getLTCData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getLTCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getLTCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getLTCData.data.lowPrice,
        HighPrice: getLTCData.data.highPrice,
        Favourite: favCurrencies.includes("LTC") ? true : false,
      };

      let BNBData = {
        Name: "Binance Coin",
        Symbol: "BNB",
        Price: getBNBData.data.lastPrice,
        Volume: volumesBNB,
        Change: getBNBData.data.priceChangePercent,
        IUSDPrice: getBNBData.data.lastPrice / 0.99,
        BTCPrice: getBNBData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBNBData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getBNBData.data.lowPrice,
        HighPrice: getBNBData.data.highPrice,
        Favourite: favCurrencies.includes("BNB") ? true : false,
      };

      let DOGEData = {
        Name: "Dogecoin",
        Symbol: "DOGE",
        Price: getDOGEData.data.lastPrice,
        Volume: volumesDOGE,
        Change: getDOGEData.data.priceChangePercent,
        IUSDPrice: getDOGEData.data.lastPrice / 0.99,
        BTCPrice: getDOGEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDOGEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDOGEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDOGEData.data.lowPrice,
        HighPrice: getDOGEData.data.highPrice,
        Favourite: favCurrencies.includes("DOGE") ? true : false,
      };

      let XRPData = {
        Name: "Ripple",
        Symbol: "XRP",
        Price: getXRPData.data.lastPrice,
        Volume: volumesXRP,
        Change: getXRPData.data.priceChangePercent,
        IUSDPrice: getXRPData.data.lastPrice / 0.99,
        BTCPrice: getXRPData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getXRPData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getXRPData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getXRPData.data.lowPrice,
        HighPrice: getXRPData.data.highPrice,
        Favourite: favCurrencies.includes("XRP") ? true : false,
      };

      let TUSDData = {
        Name: "True USD",
        Symbol: "TUSD",
        Price: getTUSDData.data.lastPrice,
        Volume: volumesTUSD,
        Change: getTUSDData.data.priceChangePercent,
        IUSDPrice: getTUSDData.data.lastPrice / 0.99,
        BTCPrice: getTUSDData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTUSDData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTUSDData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getTUSDData.data.lowPrice,
        HighPrice: getTUSDData.data.highPrice,
        Favourite: favCurrencies.includes("TUSD") ? true : false,
      };

      // let LEOData = {
      //   Name: "UNUS SED LEO",
      //   Symbol: "LEO",
      //   Price: getLEOData.data.lastPrice,
      //   Volume: volumesLEO,
      //   Change: getLEOData.data.priceChangePercent,
      //   IUSDPrice: getLEOData.data.lastPrice / 0.99,
      //   BTCPrice: getLEOData.data.lastPrice / getBTCData.data.lastPrice,
      //   MarketCap: "$44.6B",
      //   CirculatingSupply: "66.5M",
      //   LowPrice: getLEOData.data.lowPrice,
      //   HighPrice: getLEOData.data.highPrice,
      //   Favourite: favCurrencies.includes("LEO") ? true : false,
      // };

      let BCHData = {
        Name: "Bitcoin Cash",
        Symbol: "BCH",
        Price: getBCHData.data.lastPrice,
        Volume: volumesBCH,
        Change: getBCHData.data.priceChangePercent,
        IUSDPrice: getBCHData.data.lastPrice / 0.99,
        BTCPrice: getBCHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBCHData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBCHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getBCHData.data.lowPrice,
        HighPrice: getBCHData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      let MATICData = {
        Name: "Polygon",
        Symbol: "MATIC",
        Price: getMATICData.data.lastPrice,
        Volume: volumesMATIC,
        Change: getMATICData.data.priceChangePercent,
        IUSDPrice: getMATICData.data.lastPrice / 0.99,
        BTCPrice: getMATICData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getMATICData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getMATICData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getMATICData.data.lowPrice,
        HighPrice: getMATICData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      let DOTData = {
        Name: "Polkadot",
        Symbol: "DOT",
        Price: getDOTData.data.lastPrice,
        Volume: volumesDOT,
        Change: getDOTData.data.priceChangePercent,
        IUSDPrice: getDOTData.data.lastPrice / 0.99,
        BTCPrice: getDOTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDOTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDOTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDOTData.data.lowPrice,
        HighPrice: getDOTData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      // let TONData = {
      //   Name: "Toncoin",
      //   Symbol: "TON",
      //   Price: getTONData.data.lastPrice,
      //   Volume: volumesTON,
      //   Change: getTONData.data.priceChangePercent,
      //   IUSDPrice: getTONData.data.lastPrice / 0.99,
      //   BTCPrice: getTONData.data.lastPrice / getBTCData.data.lastPrice,
      //   MarketCap: "$44.6B",
      //   CirculatingSupply: "66.5M",
      //   LowPrice: getTONData.data.lowPrice,
      //   HighPrice: getTONData.data.highPrice,
      //   Favourite: favCurrencies.includes("TON") ? true : false,
      // };

      let DAIData = {
        Name: "DAI",
        Symbol: "DAI",
        Price: getDAIData.data.lastPrice,
        Volume: volumesDAI,
        Change: getDAIData.data.priceChangePercent,
        IUSDPrice: getDAIData.data.lastPrice / 0.99,
        BTCPrice: getDAIData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDAIData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDAIData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDAIData.data.lowPrice,
        HighPrice: getDAIData.data.highPrice,
        Favourite: favCurrencies.includes("DAI") ? true : false,
      };

      let SHIBData = {
        Name: "Shiba Inu",
        Symbol: "SHIB",
        Price: getSHIBData.data.lastPrice,
        Volume: volumesSHIB,
        Change: getSHIBData.data.priceChangePercent,
        IUSDPrice: getSHIBData.data.lastPrice / 0.99,
        BTCPrice: getSHIBData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getSHIBData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getSHIBData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getSHIBData.data.lowPrice,
        HighPrice: getSHIBData.data.highPrice,
        Favourite: favCurrencies.includes("SHIB") ? true : false,
      };

      let LINKData = {
        Name: "ChainLink",
        Symbol: "LINK",
        Price: getLINKData.data.lastPrice,
        Volume: volumesLINK,
        Change: getLINKData.data.priceChangePercent,
        IUSDPrice: getLINKData.data.lastPrice / 0.99,
        BTCPrice: getLINKData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getLINKData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getLINKData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getLINKData.data.lowPrice,
        HighPrice: getLINKData.data.highPrice,
        Favourite: favCurrencies.includes("LINK") ? true : false,
      };

      let USDCData = {
        Name: "USDC",
        Symbol: "USDC",
        Price: getUSDCData.data.lastPrice,
        Volume: volumesUSDC,
        Change: getUSDCData.data.priceChangePercent,
        IUSDPrice: getUSDCData.data.lastPrice / 0.99,
        BTCPrice: getUSDCData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getUSDCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getUSDCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getUSDCData.data.lowPrice,
        HighPrice: getUSDCData.data.highPrice,
        Favourite: favCurrencies.includes("USDC") ? true : false,
      };

      let USDTData = {
        Name: "Tether",
        Symbol: "USDT",
        Price: getUSDTData.data.lastPrice,
        Volume: volumesUSDT,
        Change: getUSDTData.data.priceChangePercent,
        IUSDPrice: getUSDTData.data.lastPrice / 0.99,
        BTCPrice: getUSDTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getUSDTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getUSDTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getUSDTData.data.lowPrice,
        HighPrice: getUSDTData.data.highPrice,
        Favourite: favCurrencies.includes("USDT") ? true : false,
      };

      let SOLData = {
        Name: "Solana",
        Symbol: "SOL",
        Price: getSOLData.data.lastPrice,
        Volume: volumesSOL,
        Change: getSOLData.data.priceChangePercent,
        IUSDPrice: getSOLData.data.lastPrice / 0.99,
        BTCPrice: getSOLData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getSOLData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getSOLData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getSOLData.data.lowPrice,
        HighPrice: getSOLData.data.highPrice,
        Favourite: favCurrencies.includes("SOL") ? true : false,
      };

      let TRXData = {
        Name: "Tron",
        Symbol: "TRX",
        Price: getTRXData.data.lastPrice,
        Volume: volumesTRX,
        Change: getTRXData.data.priceChangePercent,
        IUSDPrice: getTRXData.data.lastPrice / 0.99,
        BTCPrice: getTRXData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTRXData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTRXData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getTRXData.data.lowPrice,
        HighPrice: getTRXData.data.highPrice,
        Favourite: favCurrencies.includes("TRX") ? true : false,
      };

      let IN500Data = {
        Name: "Indexx500",
        Symbol: "IN500",
        Price: 3.86,
        Volume: volumesIN500,
        Change: -0.41,
        IUSDPrice: 3.86 / 0.99,
        BTCPrice: 3.86 / getBTCData.data.lastPrice,
        ETHPrice: 3.86 / getETHData.data.lastPrice,
        BNBPrice: 3.86 / getBNBData.data.lastPrice,
        MarketCap: "$1.838M",
        CirculatingSupply: "66.5M",
        LowPrice: 3.8,
        HighPrice: 3.88,
        Favourite: favCurrencies.includes("IN500") ? true : false,
      };

      let INEXData = {
        Name: "Indexx Exchange",
        Symbol: "INEX",
        Price: INEXPrice.buyPrice,
        Volume: volumesINEX,
        Change: 10,
        IUSDPrice: INEXPrice.buyPrice / 0.99,
        BTCPrice: INEXPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: INEXPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: INEXPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.11M",
        CirculatingSupply: "1.01M",
        LowPrice: 0.1,
        HighPrice: INEXPrice.buyPrice,
        Favourite: favCurrencies.includes("INEX") ? true : false,
      };

      let BTCYData = {
        Name: "Bitcoin Yay",
        Symbol: "BTCY",
        Price: getBTCData.data.lastPrice / 1_000_000,
        Volume: volumesBTCY,
        Change: getBTCData.data.priceChangePercent,
        IUSDPrice: BTCYPrice.buyPrice / 0.99,
        BTCPrice: BTCYPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: BTCYPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: BTCYPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.0M",
        CirculatingSupply: "100K",
        LowPrice: 0.1,
        HighPrice: getBTCData.data.lastPrice / 1_000_000,
        Favourite: favCurrencies.includes("BTCY") ? true : false,
      };

      let WIBSData = {
        Name: "WhoIsBitcoinSatoshi",
        Symbol: "WIBS",
        Price: wibsPrice,
        Volume: volumesWIBS,
        Change: 0,
        IUSDPrice: wibsPrice / 0.99,
        BTCPrice: wibsPrice / getBTCData.data.lastPrice,
        ETHPrice: wibsPrice / getETHData.data.lastPrice,
        BNBPrice: wibsPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.11M",
        CirculatingSupply: "210B",
        LowPrice: 0.00021,
        HighPrice: wibsPrice,
        Favourite: favCurrencies.includes("WIBS") ? true : false,
      };

      let INXCData = {
        Name: "IndexxCrypto",
        Symbol: "INXC",
        Price: INXCPrice.buyPrice,
        Volume: volumesINXC,
        Change: -1.2,
        IUSDPrice: INXCPrice.buyPrice / 0.99,
        BTCPrice: INXCPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: INXCPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: INXCPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$3.86B",
        CirculatingSupply: "2.07M",
        LowPrice: 1.86,
        HighPrice: 2.08,
        Favourite: favCurrencies.includes("INXC") ? true : false,
      };

      let IUSDPData = {
        Name: "Indexx USD+",
        Symbol: "IUSDP",
        Price: USDPPrice.buyPrice,
        Volume: volumesIUSDP,
        Change: 0.05,
        IUSDPrice: USDPPrice.buyPrice / 0.99,
        BTCPrice: USDPPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: USDPPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: USDPPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$1.073B",
        CirculatingSupply: "1.07M",
        LowPrice: 1,
        HighPrice: 1,
        Favourite: favCurrencies.includes("IUSD+") ? true : false,
      };

      let INXPData = {
        Name: "Indexx Phoenix",
        Symbol: "INXP",
        Price: INXPPrice.buyPrice,
        Volume: volumesINXP,
        Change: 0.0,
        IUSDPrice: INXPPrice.buyPrice / 0.99,
        BTCPrice: INXPPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: INXPPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: INXPPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "0",
        CirculatingSupply: "0",
        LowPrice: 1,
        HighPrice: 1,
        Favourite: favCurrencies.includes("INXP") ? true : false,
      };

      let FTTData = {
        Name: "FTX Token",
        Symbol: "FTT",
        Price: 1,
        Volume: volumesFTT,
        Change: 0.0,
        IUSDPrice: 1 / 0.99,
        BTCPrice: 1 / getBTCData.data.lastPrice,
        ETHPrice: 1 / getETHData.data.lastPrice,
        BNBPrice: 1 / getBNBData.data.lastPrice,
        MarketCap: "0",
        CirculatingSupply: "0",
        LowPrice: 1,
        HighPrice: 1,
        Favourite: favCurrencies.includes("FTT") ? true : false,
      };

      res.statusCode = 200;
      let results = [
        BTCData,
        ETHData,
        LTCData,
        BNBData,
        IN500Data,
        INEXData,
        INXCData,
        //BTCYData,
        IUSDPData,
        INXPData,
        FTTData,
        DOGEData,
        XRPData,
        USDCData,
        USDTData,
        SOLData,
        TRXData,
        THETAData,
        //TONData,
        LINKData,
        SHIBData,
        DAIData,
        TUSDData,
        //LEOData,
        BCHData,
        MATICData,
        //CROData,
        DOTData,
        EQSTKData,
        ALCRYPData,
        TOBData,
        CRYC10Data,
        INDXXFData,
        WIBSData,
        CHZData,
        NOTData,
        FTMData,
        RUNEData,
        NEARData,
        AAVEData,
        INJData,
        PYTHData,
        BEAMData,
        VETData,
        AVAXData,
        ADAData,
        XLMData,
        SUIData,
        MANAData,
      ];

      // Sort by 'Change' for top gainers (descending)
      let topGainers = [...results]
        .sort((a, b) => b.Change - a.Change) // Sort by change (descending)
        .slice(0, 10); // Get top 10

      // Sort by 'Change' for top losers (ascending)
      let topLosers = [...results]
        .sort((a, b) => a.Change - b.Change) // Sort by change (ascending)
        .slice(0, 10); // Get top 10

      // Sort by 'Volume' for highest trading volumes (descending)
      let topVolumes = [...results]
        .sort((a, b) => b.Volume - a.Volume) // Sort by volume (descending)
        .slice(0, 10); // Get top 10
      // Cache the results for 12 hours
      const cacheValue = {
        data: results,
        topGainers,
        topLosers,
        topVolumes,
      };

      await redisClient.set(cacheKey, JSON.stringify(cacheValue));
      await redisClient.expire(cacheKey, 43200); // cache for 12 hours

      // Send the response
      return res.status(200).send({
        status: 200,
        data: results,
        topGainers,
        topLosers,
        topVolumes,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async newListingData(req: any, res: any) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }

      const cacheKey = `new_listing_market_data`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData !== null) {
        const cachedResult = JSON.parse(cachedData);
        return res.status(200).send({
          status: 200,
          data: cachedResult.data,
          topGainers: cachedResult.topGainers,
          topLosers: cachedResult.topLosers,
          topVolumes: cachedResult.topVolumes,
        });
      }
      let BTCYPrice = await currencyService.findOne({ code: "BTCY", type: "BUY" });
      const priceOps = new PriceOperations(req, res);
      const nlSymbols = [
        "CHZ","VET","AVAX","THETA","NOT","FTM","BTCY","RUNE","NEAR",
        "AAVE","INJ","PYTH","BEAM","XLM","ADA","MANA"
      ];
      const nlVols = await Promise.all(nlSymbols.map(async (s) => ({ s, v: await priceOps.volumes(s) })));
      const nlv: any = Object.fromEntries(nlVols.map(({ s, v }) => [s, v]));
      let volumesCHZ = nlv["CHZ"]; let volumesVET = nlv["VET"]; let volumesAVAX = nlv["AVAX"]; let volumesTHETA = nlv["THETA"]; let volumesNOT = nlv["NOT"]; let volumesFTM = nlv["FTM"]; let volumesBTCY = nlv["BTCY"]; let volumesRUNE = nlv["RUNE"]; let volumesNEAR = nlv["NEAR"]; let volumesAAVE = nlv["AAVE"]; let volumesINJ = nlv["INJ"]; let volumesPYTH = nlv["PYTH"]; let volumesBEAM = nlv["BEAM"]; let volumesXLM = nlv["XLM"]; let volumesADA = nlv["ADA"]; let volumesMANA = nlv["MANA"]; 

      const [
        getBTCData,
        getETHData,
        getBNBData,
        getCHZData,
        getVETData,
        getAVAXData,
        getTHETAData,
        getNOTData,
        getFTMData,
        getRUNEData,
        getNEARData,
        getAAVEData,
        getINJData,
        getPYTHData,
        getBEAMData,
        getADAData,
        getXLMData,
        getMANAMData,
      ] = await Promise.all([
        getCryptoPriceBySymobl("BTC"),
        getCryptoPriceBySymobl("ETH"),
        getCryptoPriceBySymobl("BNB"),
        getCryptoPriceBySymobl("CHZ"),
        getCryptoPriceBySymobl("VET"),
        getCryptoPriceBySymobl("AVAX"),
        getCryptoPriceBySymobl("THETA"),
        getCryptoPriceBySymobl("NOT"),
        getCryptoPriceBySymobl("FTM"),
        getCryptoPriceBySymobl("RUNE"),
        getCryptoPriceBySymobl("NEAR"),
        getCryptoPriceBySymobl("AAVE"),
        getCryptoPriceBySymobl("INJ"),
        getCryptoPriceBySymobl("PYTH"),
        getCryptoPriceBySymobl("BEAMX"),
        getCryptoPriceBySymobl("ADA"),
        getCryptoPriceBySymobl("XLM"),
        getCryptoPriceBySymobl("MANA"),
      ]);

      let CHZData = {
        Name: "Chiliz",
        Symbol: "CHZ",
        Price: getCHZData.data.lastPrice,
        Volume: volumesCHZ,
        Change: getCHZData.data.priceChangePercent,
        IUSDPrice: getCHZData.data.lastPrice / 0.99,
        BTCPrice: getCHZData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getCHZData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getCHZData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getCHZData.data.lowPrice,
        HighPrice: getCHZData.data.highPrice,
      };

      let BTCYData = {
        Name: "Bitcoin Yay",
        Symbol: "BTCY",
        Price: getBTCData.data.lastPrice / 1_000_000,
        Volume: volumesBTCY,
        Change: getBTCData.data.priceChangePercent,
        IUSDPrice: BTCYPrice.buyPrice / 0.99,
        BTCPrice: BTCYPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: BTCYPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: BTCYPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.0M",
        CirculatingSupply: "100K",
        LowPrice: 0.1,
        HighPrice: getBTCData.data.lastPrice / 1_000_000,
      };

      let VETData = {
        Name: "VeChain",
        Symbol: "VET",
        Price: getVETData.data.lastPrice,
        Volume: volumesVET,
        Change: getVETData.data.priceChangePercent,
        IUSDPrice: getVETData.data.lastPrice / 0.99,
        BTCPrice: getVETData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getVETData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getVETData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getVETData.data.lowPrice,
        HighPrice: getVETData.data.highPrice,
      };
      let AVAXData = {
        Name: "Avalanche",
        Symbol: "AVAX",
        Price: getAVAXData.data.lastPrice,
        Volume: volumesAVAX,
        Change: getAVAXData.data.priceChangePercent,
        IUSDPrice: getAVAXData.data.lastPrice / 0.99,
        BTCPrice: getAVAXData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getAVAXData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getAVAXData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getAVAXData.data.lowPrice,
        HighPrice: getAVAXData.data.highPrice,
      };

      let THETAData = {
        Name: "Theta Network",
        Symbol: "THETA",
        Price: getTHETAData.data.lastPrice,
        Volume: volumesTHETA,
        Change: getTHETAData.data.priceChangePercent,
        IUSDPrice: getTHETAData.data.lastPrice / 0.99,
        BTCPrice: getTHETAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTHETAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTHETAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$16.67B",
        CirculatingSupply: "409.91M",
        LowPrice: getTHETAData.data.lowPrice,
        HighPrice: getTHETAData.data.highPrice,
      };

      let NOTData = {
        Name: "NotCoin",
        Symbol: "NOT",
        Price: getNOTData.data.lastPrice,
        Volume: volumesNOT,
        Change: getNOTData.data.priceChangePercent,
        IUSDPrice: getNOTData.data.lastPrice / 0.99,
        BTCPrice: getNOTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getNOTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getNOTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNOTData.data.lowPrice,
        HighPrice: getNOTData.data.highPrice,
      };

      let FTMData = {
        Name: "Fantom",
        Symbol: "FTM",
        Price: getFTMData.data.lastPrice,
        Volume: volumesFTM,
        Change: getFTMData.data.priceChangePercent,
        IUSDPrice: getFTMData.data.lastPrice / 0.99,
        BTCPrice: getFTMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getFTMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getFTMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getFTMData.data.lowPrice,
        HighPrice: getFTMData.data.highPrice,
      };

      let RUNEData = {
        Name: "Thor Chain",
        Symbol: "RUNE",
        Price: getRUNEData.data.lastPrice,
        Volume: volumesRUNE,
        Change: getRUNEData.data.priceChangePercent,
        IUSDPrice: getRUNEData.data.lastPrice / 0.99,
        BTCPrice: getRUNEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getRUNEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getRUNEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getRUNEData.data.lowPrice,
        HighPrice: getRUNEData.data.highPrice,
      };

      let NEARData = {
        Name: "Near Protocol",
        Symbol: "NEAR",
        Price: getNEARData.data.lastPrice,
        Volume: volumesNEAR,
        Change: getNEARData.data.priceChangePercent,
        IUSDPrice: getNEARData.data.lastPrice / 0.99,
        BTCPrice: getNEARData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getNEARData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getNEARData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNEARData.data.lowPrice,
        HighPrice: getNEARData.data.highPrice,
      };

      // let CROData = {
      //   Name: "Cronos",
      //   Symbol: "CRO",
      //   Price: getCROData.data.lastPrice,
      //   Volume: volumesCRO,
      //   Change: getCROData.data.priceChangePercent,
      //   IUSDPrice: getCROData.data.lastPrice / 0.99,
      //   BTCPrice: getCROData.data.lastPrice / getBTCData.data.lastPrice,
      //   ETHPrice: getCROData.data.lastPrice / getETHData.data.lastPrice,
      //   BNBPrice: getCROData.data.lastPrice / getBNBData.data.lastPrice,
      //   MarketCap: "$4.62B",
      //   CirculatingSupply: "26.91B",
      //   LowPrice: getCROData.data.lowPrice,
      //   HighPrice: getCROData.data.highPrice,
      // };

      let AAVEData = {
        Name: "Aave Coin",
        Symbol: "AAVE",
        Price: getAAVEData.data.lastPrice,
        Volume: volumesAAVE,
        Change: getAAVEData.data.priceChangePercent,
        IUSDPrice: getAAVEData.data.lastPrice / 0.99,
        BTCPrice: getAAVEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getAAVEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getAAVEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getAAVEData.data.lowPrice,
        HighPrice: getAAVEData.data.highPrice,
      };

      let INJData = {
        Name: "Injective",
        Symbol: "INJ",
        Price: getINJData.data.lastPrice,
        Volume: volumesINJ,
        Change: getINJData.data.priceChangePercent,
        IUSDPrice: getINJData.data.lastPrice / 0.99,
        BTCPrice: getINJData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getINJData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getINJData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getINJData.data.lowPrice,
        HighPrice: getINJData.data.highPrice,
      };

      let PYTHData = {
        Name: "Pyth Network",
        Symbol: "PYTH",
        Price: getPYTHData.data.lastPrice,
        Volume: volumesPYTH,
        Change: getPYTHData.data.priceChangePercent,
        IUSDPrice: getPYTHData.data.lastPrice / 0.99,
        BTCPrice: getPYTHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getPYTHData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getPYTHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getPYTHData.data.lowPrice,
        HighPrice: getPYTHData.data.highPrice,
      };

      let BEAMData = {
        Name: "Beam",
        Symbol: "BEAM",
        Price: getBEAMData.data.lastPrice,
        Volume: volumesBEAM,
        Change: getBEAMData.data.priceChangePercent,
        IUSDPrice: getBEAMData.data.lastPrice / 0.99,
        BTCPrice: getBEAMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBEAMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBEAMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getBEAMData.data.lowPrice,
        HighPrice: getBEAMData.data.highPrice,
      };

      let ADAData = {
        Name: "Cardano",
        Symbol: "ADA",
        Price: getADAData.data.lastPrice,
        Volume: volumesADA,
        Change: getADAData.data.priceChangePercent,
        IUSDPrice: getADAData.data.lastPrice / 0.99,
        BTCPrice: getADAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getADAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getADAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$30.82B",
        CirculatingSupply: "35.13B",
        LowPrice: getADAData.data.lowPrice,
        HighPrice: getADAData.data.highPrice,
      };

      let XLMData = {
        Name: "Steller",
        Symbol: "XLM",
        Price: getXLMData.data.lastPrice,
        Volume: volumesXLM,
        Change: getXLMData.data.priceChangePercent,
        IUSDPrice: getXLMData.data.lastPrice / 0.99,
        BTCPrice: getXLMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getXLMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getXLMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$10.67B",
        CirculatingSupply: "30.91B",
        LowPrice: getXLMData.data.lowPrice,
        HighPrice: getXLMData.data.highPrice,
      };

      let MANAData = {
        Name: "Decentraland",
        Symbol: "MANA",
        Price: getMANAMData.data.lastPrice,
        Volume: volumesMANA,
        Change: getMANAMData.data.priceChangePercent,
        IUSDPrice: getMANAMData.data.lastPrice / 0.99,
        BTCPrice: getMANAMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getMANAMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getMANAMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$915.67M",
        CirculatingSupply: "1.95B",
        LowPrice: getMANAMData.data.lowPrice,
        HighPrice: getMANAMData.data.highPrice,
      };

      res.statusCode = 200;
      let results = [
        // CHZData,
        // NOTData,
        // FTMData,
        //RUNEData,
        //THETAData,
        //BTCYData,
        NEARData,
        AAVEData,
        INJData,
        PYTHData,
        BEAMData,
        AVAXData,
        VETData,
        ADAData,
        MANAData,
        XLMData,
      ];

      // Sort by 'Change' for top gainers (descending)
      let topGainers = [...results]
        .sort((a, b) => b.Change - a.Change) // Sort by change (descending)
        .slice(0, 10); // Get top 10

      // Sort by 'Change' for top losers (ascending)
      let topLosers = [...results]
        .sort((a, b) => a.Change - b.Change) // Sort by change (ascending)
        .slice(0, 10); // Get top 10

      // Sort by 'Volume' for highest trading volumes (descending)
      let topVolumes = [...results]
        .sort((a, b) => b.Volume - a.Volume) // Sort by volume (descending)
        .slice(0, 10); // Get top 10
      // Cache the results for 12 hours
      const cacheValue = {
        data: results,
        topGainers,
        topLosers,
        topVolumes,
      };

      await redisClient.set(cacheKey, JSON.stringify(cacheValue));
      await redisClient.expire(cacheKey, 43200); // cache for 12 hours

      // Send the response
      return res.status(200).send({
        status: 200,
        data: results,
        topGainers,
        topLosers,
        topVolumes,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async hotTokensData(req: any, res: any) {
    try {
      // Serve from short-lived cache if available
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        const cached = await redisClient.get(`hot_tokens_data`);
        if (cached !== null) {
          const parsed = JSON.parse(cached);
          res.status(200).send({ status: 200, data: parsed });
          return;
        }
      } catch {}

      // Fetch static prices concurrently
      const [INEXPrice, DaCrazyPrice, BTCYPrice, wibsRespHot] = await Promise.all([
        currencyService.findOne({ code: "INEX", type: "BUY" }),
        currencyService.findOne({ code: "DaCrazy", type: "BUY" }),
        currencyService.findOne({ code: "BTCY", type: "BUY" }),
        getPriceByName("WIBS"),
      ]);
      const wibsPriceHot = Number((wibsRespHot as any)?.data ?? 0);
      const priceOps = new PriceOperations(req, res);
      const volumeSymbols = [
        "BTC","ETH","BNB","LTC","XRP","USDC","DOGE","SOL","TRX",
        "CHZ","AVAX","THETA","VET","NOT","FTM","RUNE","NEAR","AAVE",
        "INJ","PYTH","BEAM","DAI","SHIB","LINK","USDT","TUSD","BCH",
        "MATIC","DOT","IN500","INEX","WIBS","BTCY","INXC","IUSD+",
        "INXP","XLM","ADA","MANA","Dacrazy"
      ];
      const volResults = await Promise.all(
        volumeSymbols.map(async (s) => ({ s, v: await priceOps.volumes(s) }))
      );
      const volumes: any = Object.fromEntries(volResults.map(({ s, v }) => [s, v]));
      const volumesBTC = volumes["BTC"]; const volumesETH = volumes["ETH"]; const volumesBNB = volumes["BNB"]; const volumesLTC = volumes["LTC"]; const volumesXRP = volumes["XRP"]; const volumesUSDC = volumes["USDC"]; const volumesDOGE = volumes["DOGE"]; const volumesSOL = volumes["SOL"]; const volumesTRX = volumes["TRX"]; const volumesCHZ = volumes["CHZ"]; const volumesAVAX = volumes["AVAX"]; const volumesTHETA = volumes["THETA"]; const volumesVET = volumes["VET"]; const volumesNOT = volumes["NOT"]; const volumesFTM = volumes["FTM"]; const volumesRUNE = volumes["RUNE"]; const volumesNEAR = volumes["NEAR"]; const volumesAAVE = volumes["AAVE"]; const volumesINJ = volumes["INJ"]; const volumesPYTH = volumes["PYTH"]; const volumesBEAM = volumes["BEAM"]; const volumesDAI = volumes["DAI"]; const volumesSHIB = volumes["SHIB"]; const volumesLINK = volumes["LINK"]; const volumesUSDT = volumes["USDT"]; const volumesTUSD = volumes["TUSD"]; const volumesBCH = volumes["BCH"]; const volumesMATIC = volumes["MATIC"]; const volumesDOT = volumes["DOT"]; const volumesIN500 = volumes["IN500"]; const volumesINEX = volumes["INEX"]; const volumesWIBS = volumes["WIBS"]; const volumesBTCY = volumes["BTCY"]; const volumesINXC = volumes["INXC"]; const volumesIUSDP = volumes["IUSD+"]; const volumesINXP = volumes["INXP"]; const volumesXLM = volumes["XLM"]; const volumesADA = volumes["ADA"]; const volumesMANA = volumes["MANA"]; const volumesDaCrazy = volumes["Dacrazy"]; 

      const [
        getBTCData,
        getETHData,
        getLTCData,
        getBNBData,
        getDOGEData,
        getUSDCData,
        getUSDTData,
        getSOLData,
        getCHZData,
        getVETData,
        getAVAXData,
        getTHETAData,
        getNOTData,
        getFTMData,
        getRUNEData,
        getNEARData,
        getAAVEData,
        getINJData,
        getPYTHData,
        getBEAMData,
        getTRXData,
        getXRPData,
        getDAIData,
        getSHIBData,
        getLINKData,
        getTUSDData,
        getBCHData,
        getMATICData,
        getADAData,
        getXLMData,
        getMANAMData,
        getDOTData,
      ] = await Promise.all([
        getCryptoPriceBySymobl("BTC"),
        getCryptoPriceBySymobl("ETH"),
        getCryptoPriceBySymobl("LTC"),
        getCryptoPriceBySymobl("BNB"),
        getCryptoPriceBySymobl("DOGE"),
        getCryptoPriceBySymobl("USDC"),
        getCryptoPriceBySymobl("USDT"),
        getCryptoPriceBySymobl("SOL"),
        getCryptoPriceBySymobl("CHZ"),
        getCryptoPriceBySymobl("VET"),
        getCryptoPriceBySymobl("AVAX"),
        getCryptoPriceBySymobl("THETA"),
        getCryptoPriceBySymobl("NOT"),
        getCryptoPriceBySymobl("FTM"),
        getCryptoPriceBySymobl("RUNE"),
        getCryptoPriceBySymobl("NEAR"),
        getCryptoPriceBySymobl("AAVE"),
        getCryptoPriceBySymobl("INJ"),
        getCryptoPriceBySymobl("PYTH"),
        getCryptoPriceBySymobl("BEAMX"),
        getCryptoPriceBySymobl("TRX"),
        getCryptoPriceBySymobl("XRP"),
        getCryptoPriceBySymobl("DAI"),
        getCryptoPriceBySymobl("SHIB"),
        getCryptoPriceBySymobl("LINK"),
        getCryptoPriceBySymobl("TUSD"),
        getCryptoPriceBySymobl("BCH"),
        getCryptoPriceBySymobl("MATIC"),
        getCryptoPriceBySymobl("ADA"),
        getCryptoPriceBySymobl("XLM"),
        getCryptoPriceBySymobl("MANA"),
        getCryptoPriceBySymobl("DOT"),
      ]);

      // parallel batch fetched above
      let userData = await userService.findOne({ email: req.body.email });
      let favCurrencies =
        userData?.favouriteCurrencies === null ||
          userData?.favouriteCurrencies === undefined
          ? []
          : userData?.favouriteCurrencies;
      console.log("favCurrencies", favCurrencies);

      let CHZData = {
        Name: "Chiliz",
        Symbol: "CHZ",
        Price: getCHZData.data.lastPrice,
        Volume: volumesCHZ,
        Change: getCHZData.data.priceChangePercent,
        IUSDPrice: getCHZData.data.lastPrice / 0.99,
        BTCPrice: getCHZData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getCHZData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getCHZData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getCHZData.data.lowPrice,
        HighPrice: getCHZData.data.highPrice,
        Favourite: favCurrencies.includes("CHZ") ? true : false,
      };

      let VETData = {
        Name: "VeChain",
        Symbol: "VET",
        Price: getVETData.data.lastPrice,
        Volume: volumesVET,
        Change: getVETData.data.priceChangePercent,
        IUSDPrice: getVETData.data.lastPrice / 0.99,
        BTCPrice: getVETData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getVETData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getVETData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getVETData.data.lowPrice,
        HighPrice: getVETData.data.highPrice,
      };

      let AVAXData = {
        Name: "Avalanche",
        Symbol: "AVAX",
        Price: getAVAXData.data.lastPrice,
        Volume: volumesAVAX,
        Change: getAVAXData.data.priceChangePercent,
        IUSDPrice: getAVAXData.data.lastPrice / 0.99,
        BTCPrice: getAVAXData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getAVAXData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getAVAXData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getAVAXData.data.lowPrice,
        HighPrice: getAVAXData.data.highPrice,
      };

      let THETAData = {
        Name: "Theta Network",
        Symbol: "THETA",
        Price: getTHETAData.data.lastPrice,
        Volume: volumesTHETA,
        Change: getTHETAData.data.priceChangePercent,
        IUSDPrice: getTHETAData.data.lastPrice / 0.99,
        BTCPrice: getTHETAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTHETAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTHETAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$16.67B",
        CirculatingSupply: "409.91M",
        LowPrice: getTHETAData.data.lowPrice,
        HighPrice: getTHETAData.data.highPrice,
      };

      let NOTData = {
        Name: "NotCoin",
        Symbol: "NOT",
        Price: getNOTData.data.lastPrice,
        Volume: volumesNOT,
        Change: getNOTData.data.priceChangePercent,
        IUSDPrice: getNOTData.data.lastPrice / 0.99,
        BTCPrice: getNOTData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNOTData.data.lowPrice,
        HighPrice: getNOTData.data.highPrice,
        Favourite: favCurrencies.includes("NOT") ? true : false,
      };

      let FTMData = {
        Name: "Fantom",
        Symbol: "FTM",
        Price: getFTMData.data.lastPrice,
        Volume: volumesFTM,
        Change: getFTMData.data.priceChangePercent,
        IUSDPrice: getFTMData.data.lastPrice / 0.99,
        BTCPrice: getFTMData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getFTMData.data.lowPrice,
        HighPrice: getFTMData.data.highPrice,
        Favourite: favCurrencies.includes("FTM") ? true : false,
      };

      let RUNEData = {
        Name: "Thor Chain",
        Symbol: "RUNE",
        Price: getRUNEData.data.lastPrice,
        Volume: volumesRUNE,
        Change: getRUNEData.data.priceChangePercent,
        IUSDPrice: getRUNEData.data.lastPrice / 0.99,
        BTCPrice: getRUNEData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getRUNEData.data.lowPrice,
        HighPrice: getRUNEData.data.highPrice,
        Favourite: favCurrencies.includes("RUNE") ? true : false,
      };

      let NEARData = {
        Name: "Near Protocol",
        Symbol: "NEAR",
        Price: getNEARData.data.lastPrice,
        Volume: volumesNEAR,
        Change: getNEARData.data.priceChangePercent,
        IUSDPrice: getNEARData.data.lastPrice / 0.99,
        BTCPrice: getNEARData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getNEARData.data.lowPrice,
        HighPrice: getNEARData.data.highPrice,
        Favourite: favCurrencies.includes("NEAR") ? true : false,
      };

      let AAVEData = {
        Name: "Aave Coin",
        Symbol: "AAVE",
        Price: getAAVEData.data.lastPrice,
        Volume: volumesAAVE,
        Change: getAAVEData.data.priceChangePercent,
        IUSDPrice: getAAVEData.data.lastPrice / 0.99,
        BTCPrice: getAAVEData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getAAVEData.data.lowPrice,
        HighPrice: getAAVEData.data.highPrice,
        Favourite: favCurrencies.includes("AAVE") ? true : false,
      };

      let INJData = {
        Name: "Injective",
        Symbol: "INJ",
        Price: getINJData.data.lastPrice,
        Volume: volumesINJ,
        Change: getINJData.data.priceChangePercent,
        IUSDPrice: getINJData.data.lastPrice / 0.99,
        BTCPrice: getINJData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getINJData.data.lowPrice,
        HighPrice: getINJData.data.highPrice,
        Favourite: favCurrencies.includes("INJ") ? true : false,
      };

      let PYTHData = {
        Name: "Pyth Network",
        Symbol: "PYTH",
        Price: getPYTHData.data.lastPrice,
        Volume: volumesPYTH,
        Change: getPYTHData.data.priceChangePercent,
        IUSDPrice: getPYTHData.data.lastPrice / 0.99,
        BTCPrice: getPYTHData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getPYTHData.data.lowPrice,
        HighPrice: getPYTHData.data.highPrice,
        Favourite: favCurrencies.includes("PYTH") ? true : false,
      };

      let BEAMData = {
        Name: "Beam",
        Symbol: "BEAM",
        Price: getBEAMData.data.lastPrice,
        Volume: volumesBEAM,
        Change: getBEAMData.data.priceChangePercent,
        IUSDPrice: getBEAMData.data.lastPrice / 0.99,
        BTCPrice: getBEAMData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "92.91M",
        LowPrice: getBEAMData.data.lowPrice,
        HighPrice: getBEAMData.data.highPrice,
        Favourite: favCurrencies.includes("BEAM") ? true : false,
      };

      let ADAData = {
        Name: "Cardano",
        Symbol: "ADA",
        Price: getADAData.data.lastPrice,
        Volume: volumesADA,
        Change: getADAData.data.priceChangePercent,
        IUSDPrice: getADAData.data.lastPrice / 0.99,
        BTCPrice: getADAData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getADAData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getADAData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$30.82B",
        CirculatingSupply: "35.13B",
        LowPrice: getADAData.data.lowPrice,
        HighPrice: getADAData.data.highPrice,
        Favourite: favCurrencies.includes("ADA") ? true : false,
      };

      let XLMData = {
        Name: "Steller",
        Symbol: "XLM",
        Price: getXLMData.data.lastPrice,
        Volume: volumesXLM,
        Change: getXLMData.data.priceChangePercent,
        IUSDPrice: getXLMData.data.lastPrice / 0.99,
        BTCPrice: getXLMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getXLMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getXLMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$10.67B",
        CirculatingSupply: "30.91B",
        LowPrice: getXLMData.data.lowPrice,
        HighPrice: getXLMData.data.highPrice,
        Favourite: favCurrencies.includes("XLM") ? true : false,
      };

      let MANAData = {
        Name: "Decentraland",
        Symbol: "MANA",
        Price: getMANAMData.data.lastPrice,
        Volume: volumesMANA,
        Change: getMANAMData.data.priceChangePercent,
        IUSDPrice: getMANAMData.data.lastPrice / 0.99,
        BTCPrice: getMANAMData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getMANAMData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getMANAMData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$915.67M",
        CirculatingSupply: "1.95B",
        LowPrice: getMANAMData.data.lowPrice,
        HighPrice: getMANAMData.data.highPrice,
        Favourite: favCurrencies.includes("MANA") ? true : false,
      };

      let BTCData = {
        Name: "Bitcoin",
        Symbol: "BTC",
        Price: getBTCData.data.lastPrice,
        Volume: volumesBTC,
        Change: getBTCData.data.priceChangePercent,
        IUSDPrice: getBTCData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getBTCData.data.lastPrice,
        BTCPrice: getBTCData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBTCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBTCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$316.67B",
        CirculatingSupply: "18.63M",
        LowPrice: getBTCData.data.lowPrice,
        HighPrice: getBTCData.data.highPrice,
        Favourite: favCurrencies.includes("BTC") ? true : false,
      };

      let ETHData = {
        Name: "Ethereum",
        Symbol: "ETH",
        Price: getETHData.data.lastPrice,
        Volume: volumesETH,
        Change: getETHData.data.priceChangePercent,
        IUSDPrice: getETHData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getETHData.data.lastPrice,
        BTCPrice: getETHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getETHData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getETHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$149.8B",
        CirculatingSupply: "112.5M",
        LowPrice: getETHData.data.lowPrice,
        HighPrice: getETHData.data.highPrice,
        Favourite: favCurrencies.includes("ETH") ? true : false,
      };

      let LTCData = {
        Name: "Litecoin",
        Symbol: "LTC",
        Price: getLTCData.data.lastPrice,
        Volume: volumesLTC,
        Change: getLTCData.data.priceChangePercent,
        IUSDPrice: getLTCData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getLTCData.data.lastPrice,
        BTCPrice: getLTCData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getLTCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getLTCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getLTCData.data.lowPrice,
        HighPrice: getLTCData.data.highPrice,
        Favourite: favCurrencies.includes("LTC") ? true : false,
      };

      let BNBData = {
        Name: "Binance Coin",
        Symbol: "BNB",
        Price: getBNBData.data.lastPrice,
        Volume: volumesBNB,
        Change: getBNBData.data.priceChangePercent,
        IUSDPrice: getBNBData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getBNBData.data.lastPrice,
        BTCPrice: getBNBData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBNBData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBNBData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getBNBData.data.lowPrice,
        HighPrice: getBNBData.data.highPrice,
        Favourite: favCurrencies.includes("BNB") ? true : false,
      };

      let DOGEData = {
        Name: "Dogecoin",
        Symbol: "DOGE",
        Price: getDOGEData.data.lastPrice,
        Volume: volumesDOGE,
        Change: getDOGEData.data.priceChangePercent,
        IUSDPrice: getDOGEData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getDOGEData.data.lastPrice,
        BTCPrice: getDOGEData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDOGEData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDOGEData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDOGEData.data.lowPrice,
        HighPrice: getDOGEData.data.highPrice,
        Favourite: favCurrencies.includes("DOGE") ? true : false,
      };

      let XRPData = {
        Name: "Ripple",
        Symbol: "XRP",
        Price: getXRPData.data.lastPrice,
        Volume: volumesXRP,
        Change: getXRPData.data.priceChangePercent,
        IUSDPrice: getXRPData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getXRPData.data.lastPrice,
        BTCPrice: getXRPData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getXRPData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getXRPData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getXRPData.data.lowPrice,
        HighPrice: getXRPData.data.highPrice,
        Favourite: favCurrencies.includes("XRP") ? true : false,
      };

      let TUSDData = {
        Name: "True USD",
        Symbol: "TUSD",
        Price: getTUSDData.data.lastPrice,
        Volume: volumesTUSD,
        Change: getTUSDData.data.priceChangePercent,
        IUSDPrice: getTUSDData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getTUSDData.data.lastPrice,
        BTCPrice: getTUSDData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTUSDData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTUSDData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getTUSDData.data.lowPrice,
        HighPrice: getTUSDData.data.highPrice,
        Favourite: favCurrencies.includes("TUSD") ? true : false,
      };

      // let LEOData = {
      //   Name: "UNUS SED LEO",
      //   Symbol: "LEO",
      //   Price: getLEOData.data.lastPrice,
      //   Volume: volumesLEO,
      //   Change: getLEOData.data.priceChangePercent,
      //   IUSDPrice: getLEOData.data.lastPrice / 0.99,
      //   BTCPrice: getLEOData.data.lastPrice / getBTCData.data.lastPrice,
      //   MarketCap: "$44.6B",
      //   CirculatingSupply: "66.5M",
      //   LowPrice: getLEOData.data.lowPrice,
      //   HighPrice: getLEOData.data.highPrice,
      //   Favourite: favCurrencies.includes("LEO") ? true : false,
      // };

      let BCHData = {
        Name: "Bitcoin Cash",
        Symbol: "BCH",
        Price: getBCHData.data.lastPrice,
        Volume: volumesBCH,
        Change: getBCHData.data.priceChangePercent,
        IUSDPrice: getBCHData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getBCHData.data.lastPrice,
        BTCPrice: getBCHData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getBCHData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getBCHData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getBCHData.data.lowPrice,
        HighPrice: getBCHData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      let MATICData = {
        Name: "Polygon",
        Symbol: "MATIC",
        Price: getMATICData.data.lastPrice,
        Volume: volumesMATIC,
        Change: getMATICData.data.priceChangePercent,
        IUSDPrice: getMATICData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getMATICData.data.lastPrice,
        BTCPrice: getMATICData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getMATICData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getMATICData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getMATICData.data.lowPrice,
        HighPrice: getMATICData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      let DOTData = {
        Name: "Polkadot",
        Symbol: "DOT",
        Price: getDOTData.data.lastPrice,
        Volume: volumesDOT,
        Change: getDOTData.data.priceChangePercent,
        IUSDPrice: getDOTData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getDOTData.data.lastPrice,
        BTCPrice: getDOTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDOTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDOTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDOTData.data.lowPrice,
        HighPrice: getDOTData.data.highPrice,
        Favourite: favCurrencies.includes("LEO") ? true : false,
      };

      // let TONData = {
      //   Name: "Toncoin",
      //   Symbol: "TON",
      //   Price: getTONData.data.lastPrice,
      //   Volume: volumesTON,
      //   Change: getTONData.data.priceChangePercent,
      //   IUSDPrice: getTONData.data.lastPrice / 0.99,
      //   BTCPrice: getTONData.data.lastPrice / getBTCData.data.lastPrice,
      //   MarketCap: "$44.6B",
      //   CirculatingSupply: "66.5M",
      //   LowPrice: getTONData.data.lowPrice,
      //   HighPrice: getTONData.data.highPrice,
      //   Favourite: favCurrencies.includes("TON") ? true : false,
      // };

      let DAIData = {
        Name: "DAI",
        Symbol: "DAI",
        Price: getDAIData.data.lastPrice,
        Volume: volumesDAI,
        Change: getDAIData.data.priceChangePercent,
        IUSDPrice: getDAIData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getDAIData.data.lastPrice,
        BTCPrice: getDAIData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getDAIData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getDAIData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getDAIData.data.lowPrice,
        HighPrice: getDAIData.data.highPrice,
        Favourite: favCurrencies.includes("DAI") ? true : false,
      };

      let SHIBData = {
        Name: "Shiba Inu",
        Symbol: "SHIB",
        Price: getSHIBData.data.lastPrice,
        Volume: volumesSHIB,
        Change: getSHIBData.data.priceChangePercent,
        IUSDPrice: getSHIBData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getSHIBData.data.lastPrice,
        BTCPrice: getSHIBData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getSHIBData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getSHIBData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getSHIBData.data.lowPrice,
        HighPrice: getSHIBData.data.highPrice,
        Favourite: favCurrencies.includes("SHIB") ? true : false,
      };

      let LINKData = {
        Name: "ChainLink",
        Symbol: "LINK",
        Price: getLINKData.data.lastPrice,
        Volume: volumesLINK,
        Change: getLINKData.data.priceChangePercent,
        IUSDPrice: getLINKData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getLINKData.data.lastPrice,
        BTCPrice: getLINKData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getLINKData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getLINKData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getLINKData.data.lowPrice,
        HighPrice: getLINKData.data.highPrice,
        Favourite: favCurrencies.includes("LINK") ? true : false,
      };

      let USDCData = {
        Name: "USDC",
        Symbol: "USDC",
        Price: getUSDCData.data.lastPrice,
        Volume: volumesUSDC,
        Change: getUSDCData.data.priceChangePercent,
        IUSDPrice: getUSDCData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getUSDCData.data.lastPrice,
        BTCPrice: getUSDCData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getUSDCData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getUSDCData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getUSDCData.data.lowPrice,
        HighPrice: getUSDCData.data.highPrice,
        Favourite: favCurrencies.includes("USDC") ? true : false,
      };

      let USDTData = {
        Name: "Tether",
        Symbol: "USDT",
        Price: getUSDTData.data.lastPrice,
        Volume: volumesUSDT,
        Change: getUSDTData.data.priceChangePercent,
        IUSDPrice: getUSDTData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getUSDTData.data.lastPrice,
        BTCPrice: getUSDTData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getUSDTData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getUSDTData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getUSDTData.data.lowPrice,
        HighPrice: getUSDTData.data.highPrice,
        Favourite: favCurrencies.includes("USDT") ? true : false,
      };

      let SOLData = {
        Name: "Solana",
        Symbol: "SOL",
        Price: getSOLData.data.lastPrice,
        Volume: volumesSOL,
        Change: getSOLData.data.priceChangePercent,
        IUSDPrice: getSOLData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getSOLData.data.lastPrice,
        BTCPrice: getSOLData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getSOLData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getSOLData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getSOLData.data.lowPrice,
        HighPrice: getSOLData.data.highPrice,
        Favourite: favCurrencies.includes("SOL") ? true : false,
      };

      let TRXData = {
        Name: "Tron",
        Symbol: "TRX",
        Price: getTRXData.data.lastPrice,
        Volume: volumesTRX,
        Change: getTRXData.data.priceChangePercent,
        IUSDPrice: getTRXData.data.lastPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / getTRXData.data.lastPrice,
        BTCPrice: getTRXData.data.lastPrice / getBTCData.data.lastPrice,
        ETHPrice: getTRXData.data.lastPrice / getETHData.data.lastPrice,
        BNBPrice: getTRXData.data.lastPrice / getBNBData.data.lastPrice,
        MarketCap: "$44.6B",
        CirculatingSupply: "66.5M",
        LowPrice: getTRXData.data.lowPrice,
        HighPrice: getTRXData.data.highPrice,
        Favourite: favCurrencies.includes("TRX") ? true : false,
      };

      let IN500Data = {
        Name: "Indexx500",
        Symbol: "IN500",
        Price: 3.86,
        Volume: volumesIN500,
        Change: -0.41,
        IUSDPrice: 3.86 / 0.99,
        INEXPrice: 3.86 / INEXPrice.buyPrice,
        BTCPrice: 3.86 / getBTCData.data.lastPrice,
        ETHPrice: 3.86 / getETHData.data.lastPrice,
        BNBPrice: 3.86 / getBNBData.data.lastPrice,
        MarketCap: "$1.838M",
        CirculatingSupply: "66.5M",
        LowPrice: 3.8,
        HighPrice: 3.88,
        Favourite: favCurrencies.includes("IN500") ? true : false,
      };

      let INEXData = {
        Name: "Indexx Exchange",
        Symbol: "INEX",
        Price: INEXPrice.buyPrice,
        Volume: volumesINEX,
        Change: 10,
        IUSDPrice: INEXPrice.buyPrice / 0.99,
        INEXPrice: 1,
        BTCPrice: INEXPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: INEXPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: INEXPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.11M",
        CirculatingSupply: "1.01M",
        LowPrice: 0.1,
        HighPrice: INEXPrice.buyPrice,
        Favourite: favCurrencies.includes("INEX") ? true : false,
      };

      let BTCYData = {
        Name: "Bitcoin Yay",
        Symbol: "BTCY",
        Price: getBTCData.data.lastPrice / 1_000_000,
        Volume: volumesBTCY,
        Change: getBTCData.data.priceChangePercent,
        IUSDPrice: BTCYPrice.buyPrice / 0.99,
        BTCPrice: BTCYPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: BTCYPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: BTCYPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.0M",
        CirculatingSupply: "100K",
        LowPrice: 0.1,
        HighPrice: getBTCData.data.lastPrice / 1_000_000,
        Favourite: favCurrencies.includes("BTCY") ? true : false,
      };


      let WIBSData = {
        Name: "WhoIsBitcoinSatoshi",
        Symbol: "WIBS",
        Price: wibsPriceHot,
        Volume: volumesWIBS,
        Change: 0,
        IUSDPrice: wibsPriceHot / 0.99,
        INEXPrice: INEXPrice.buyPrice / wibsPriceHot,
        BTCPrice: wibsPriceHot / getBTCData.data.lastPrice,
        ETHPrice: wibsPriceHot / getETHData.data.lastPrice,
        BNBPrice: wibsPriceHot / getBNBData.data.lastPrice,
        MarketCap: "$0.11M",
        CirculatingSupply: "210B",
        LowPrice: 0.00021,
        HighPrice: wibsPriceHot,
        Favourite: favCurrencies.includes("WIBS") ? true : false,
      };

      let DaCrazyData = {
        Name: "DaCrazyHawaiian",
        Symbol: "DaCrazy",
        Price: DaCrazyPrice.buyPrice,
        Volume: volumesDaCrazy,
        Change: 0,
        IUSDPrice: DaCrazyPrice.buyPrice / 0.99,
        INEXPrice: INEXPrice.buyPrice / DaCrazyPrice.buyPrice,
        BTCPrice: DaCrazyPrice.buyPrice / getBTCData.data.lastPrice,
        ETHPrice: DaCrazyPrice.buyPrice / getETHData.data.lastPrice,
        BNBPrice: DaCrazyPrice.buyPrice / getBNBData.data.lastPrice,
        MarketCap: "$0.11M",
        CirculatingSupply: "10B",
        LowPrice: 0.00081,
        HighPrice: DaCrazyPrice.buyPrice,
        Favourite: favCurrencies.includes("DaCrazy") ? true : false,
      };

      // let CROData = {
      //   Name: "Cronos",
      //   Symbol: "CRO",
      //   Price: getCROData.data.lastPrice,
      //   Volume: volumesCRO,
      //   Change: getCROData.data.priceChangePercent,
      //   IUSDPrice: getCROData.data.lastPrice / 0.99,
      //   BTCPrice: getCROData.data.lastPrice / getBTCData.data.lastPrice,
      //   ETHPrice: getCROData.data.lastPrice / getETHData.data.lastPrice,
      //   BNBPrice: getCROData.data.lastPrice / getBNBData.data.lastPrice,
      //   MarketCap: "$4.62B",
      //   CirculatingSupply: "26.91B",
      //   LowPrice: getCROData.data.lowPrice,
      //   HighPrice: getCROData.data.highPrice,
      //   Favourite: favCurrencies.includes("CRO") ? true : false,
      // };

      res.statusCode = 200;
      let results = [
        //BTCYData,
        BTCData,
        ETHData,
        LTCData,
        BNBData,
        IN500Data,
        INEXData,
        DOGEData,
        XRPData,
        USDCData,
        USDTData,
        SOLData,
        TRXData,
        THETAData,
        DaCrazyData,
        //TONData,
        LINKData,
        SHIBData,
        DAIData,
        TUSDData,
        //CROData,
        //LEOData,
        BCHData,
        MATICData,
        DOTData,
        WIBSData,
        CHZData,
        NOTData,
        FTMData,
        RUNEData,
        NEARData,
        AAVEData,
        INJData,
        PYTHData,
        BEAMData,
        AVAXData,
        VETData,
        ADAData,
        XLMData,
        MANAData,
      ];
      // Set short-lived cache (5 minutes)
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        await redisClient.set(`hot_tokens_data`, JSON.stringify(results));
        await redisClient.expire(`hot_tokens_data`, 300);
      } catch {}

      res.send({ status: 200, data: results });
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async hotStockTokensData(req: any, res: any) {
    try {
      // Short cache for stock hot tokens
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        const cached = await redisClient.get(`hot_stock_tokens_data`);
        if (cached) {
          return res.status(200).send({ status: 200, data: JSON.parse(cached) });
        }
      } catch {}

      const tokens = [
        "APPL",
        "AMZN",
        "BCM",
        "GOOGL",
        "META",
        "MSFT",
        "NVDA",
        "PEP",
      ];

      const prices = await Promise.all(
        tokens.map(async (token) => {
          const priceData = await getsStockPriceByName(token);
          return {
            Name: token,
            Symbol: token,
            Price: priceData?.price || 0,
            Change: priceData?.priceChangePercentage || 0,
            LowPrice: priceData?.lowPrice || 0,
            HighPrice: priceData?.highPrice || 0,
            Favourite: false, // Update as per your logic if you have user favourites
          };
        })
      );

      // Cache for 5 minutes
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        await redisClient.set(`hot_stock_tokens_data`, JSON.stringify(prices));
        await redisClient.expire(`hot_stock_tokens_data`, 300);
      } catch {}

      res.status(200).send({ status: 200, data: prices });
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async hotETFTokensData(req: any, res: any) {
    try {
      // Short cache for ETF hot tokens
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        const cached = await redisClient.get(`hot_etf_tokens_data`);
        if (cached) {
          return res.status(200).send({ status: 200, data: JSON.parse(cached) });
        }
      } catch {}

      const priceOps = new PriceOperations(req, res);
      const [volALCRYP, volEQSTK, volINDXXF, volCRYC10, volTOB] = await Promise.all([
        priceOps.volumes("ALCRYP"),
        priceOps.volumes("EQSTK"),
        priceOps.volumes("INDXXF"),
        priceOps.volumes("CRYC10"),
        priceOps.volumes("TOB"),
      ]);
      const [getBTCData, getEQSTKData, getCRYC10Data, getALCRYPData, getINDXXFData, getTOBData, userData] = await Promise.all([
        getCryptoPriceBySymobl("BTC"),
        getLatestPriceOfETF("EQSTK"),
        getLatestPriceOfETF("CRYC10"),
        getLatestPriceOfETF("ALCRYP"),
        getLatestPriceOfETF("INDXXF"),
        getLatestPriceOfETF("TOB"),
        userService.findOne({ email: req.body.email }),
      ]);
      let favCurrencies =
        userData?.favouriteCurrencies === null ||
          userData?.favouriteCurrencies === undefined
          ? []
          : userData?.favouriteCurrencies;
      console.log("favCurrencies", favCurrencies);

      let EQSTKData = {
        Name: "EqStocks ETF",
        Symbol: "EQSTK",
        Price: getEQSTKData.data.totalETFPrice,
        Volume: volEQSTK,
        Change: "0",
        IUSDPrice: getEQSTKData.data.totalETFPrice / 0.99,
        BTCPrice: getEQSTKData.data.totalETFPrice / getBTCData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getEQSTKData.data.totalETFPrice,
        HighPrice: getEQSTKData.data.totalETFPrice,
        Favourite: favCurrencies.includes("EQSTK") ? true : false,
        allStockPrice: getEQSTKData.data.individualPrices,
      };

      let INDXXFData = {
        Name: "Indexx Focus ETF",
        Symbol: "INDXXF",
        Price: getINDXXFData.data.totalETFPrice,
        Volume: volINDXXF,
        Change: "0",
        IUSDPrice: getINDXXFData.data.totalETFPrice / 0.99,
        BTCPrice: getINDXXFData.data.totalETFPrice / getBTCData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getINDXXFData.data.totalETFPrice,
        HighPrice: getINDXXFData.data.totalETFPrice,
        Favourite: favCurrencies.includes("INDXXF") ? true : false,
        allStockPrice: getINDXXFData.data.individualPrices,
      };

      let CRYC10Data = {
        Name: "CryptoCap 10 ETF",
        Symbol: "CRYC10",
        Price: getCRYC10Data.data.totalETFPrice,
        Volume: volCRYC10,
        Change: "0",
        IUSDPrice: getCRYC10Data.data.totalETFPrice / 0.99,
        BTCPrice: getCRYC10Data.data.totalETFPrice / getBTCData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getCRYC10Data.data.totalETFPrice,
        HighPrice: getCRYC10Data.data.totalETFPrice,
        Favourite: favCurrencies.includes("CRYC10") ? true : false,
        allStockPrice: getCRYC10Data.data.individualPrices,
      };

      let ALCRYPData = {
        Name: "AlphaCrypto ETF",
        Symbol: "ALCRYP",
        Price: getALCRYPData.data.totalETFPrice,
        Volume: volALCRYP,
        Change: "0",
        IUSDPrice: getALCRYPData.data.totalETFPrice / 0.99,
        BTCPrice: getALCRYPData.data.totalETFPrice / getBTCData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getALCRYPData.data.totalETFPrice,
        HighPrice: getALCRYPData.data.totalETFPrice,
        Favourite: favCurrencies.includes("ALCRYP") ? true : false,
        allStockPrice: getALCRYPData.data.individualPrices,
      };

      let TOBData = {
        Name: "Token Blend ETF",
        Symbol: "TOB",
        Price: getTOBData.data.totalETFPrice,
        Volume: volTOB,
        Change: "0",
        IUSDPrice: getTOBData.data.totalETFPrice / 0.99,
        BTCPrice: getTOBData.data.totalETFPrice / getBTCData.data.lastPrice,
        MarketCap: "$4.10B",
        CirculatingSupply: "66.5M",
        LowPrice: getTOBData.data.totalETFPrice,
        HighPrice: getTOBData.data.totalETFPrice,
        Favourite: favCurrencies.includes("TOB") ? true : false,
        allStockPrice: getTOBData.data.individualPrices,
      };

      res.statusCode = 200;
      let results = [EQSTKData, ALCRYPData, TOBData, CRYC10Data, INDXXFData];
      // Cache for 5 minutes
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        await redisClient.set(`hot_etf_tokens_data`, JSON.stringify(results));
        await redisClient.expire(`hot_etf_tokens_data`, 300);
      } catch {}
      res.send({ status: 200, data: results });
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async stockMarketsData(req: any, res: any) {
    try {
      const symbol = req.params.symbol;
      console.log("symbol", symbol);
      if (symbol == undefined || !symbol) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }

      let getMarketData = await fetchStockData(symbol);
      console.log("getMarketData", getMarketData);
      let data = {
        Name: getMarketData?.name,
        Symbol: symbol,
        Price: getMarketData?.price,
        Volume: getMarketData?.volume,
        Change: getMarketData?.percentChange,
        Change24H: getMarketData?.percentChange,
        Change7D: getMarketData?.percentChange,
        IUSDPrice: Number(getMarketData?.price) / 0.99,
        BTCPrice: getMarketData?.price,
        MarketCap: "$316.67B",
        CirculatingSupply: "18.63M",
        LowPrice: getMarketData?.low,
        HighPrice: getMarketData?.high,
        AllTimeHighPrice: getMarketData?.highPrice52Week,
        Favourite: false,
      };

      res.statusCode = 200;

      res.send({
        status: 200,
        data: data,
      });
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async stockMarketsDataWithHistory(req: any, res: any) {
    try {
      const symbol = req.params.symbol;
      console.log("symbol", symbol);
      if (!symbol) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }

      let getMarketData = await fetchStockDataWithHistory(symbol);
      console.log("getMarketData", getMarketData);
      let data = {
        Name: getMarketData?.name,
        Symbol: symbol,
        Price: getMarketData?.price,
        Volume: getMarketData?.volume,
        Change: getMarketData?.percentChange,
        Change24H: getMarketData?.percentChange, // Assuming percentChange is 24H change
        Change7D: getMarketData?.sevenDaysExchangeRate,
        SevenDaysexchangeRate: getMarketData?.sevenDaysAgoPrice,
        OneMonthExchangeRate: getMarketData?.oneMonthAgoPrice,
        ThreeMonthsExchangeRate: getMarketData?.threeMonthsAgoPrice,
        IUSDPrice: Number(getMarketData?.price) / 0.99,
        BTCPrice: getMarketData?.price,
        MarketCap: "$316.67B", // This should be dynamically calculated or fetched
        CirculatingSupply: "18.63M", // This should be dynamically calculated or fetched
        LowPrice: getMarketData?.low,
        HighPrice: getMarketData?.high,
        AllTimeHighPrice: getMarketData?.highPrice52Week,
        Favourite: false,
      };

      res.statusCode = 200;
      res.send({
        status: 200,
        data: data,
      });
      return;
    } catch (err) {
      console.log(err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async createBug(req: any, res: any) {
    try {
      let { email, description, bugfiles } = req.body;
      if (
        !email ||
        !description ||
        !bugfiles ||
        email === "" ||
        description === "" ||
        bugfiles === "" ||
        email === undefined ||
        description === undefined ||
        bugfiles === undefined
      ) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "Missing required fields" },
        });
        return;
      }
      let userOps = new UserOperations(req, res);
      let dataResults = await userOps.createBug(req, res);
      res.statusCode = dataResults.status;
      res.send({
        status: dataResults.status,
        data: dataResults,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getBugs(req: any, res: any) {
    try {
      let userOps = new UserOperations(req, res);
      let dataResults = await userOps.getBugs(req, res);
      res.statusCode = dataResults.status;
      res.send({
        status: 200,
        data: dataResults,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getBug(req: any, res: any) {
    try {
    } catch (err) { }
  }

  async updateBug(req: any, res: any) {
    try {
      let { status, bugId, adminEmail } = req.body;
      if (
        !status ||
        !bugId ||
        !adminEmail ||
        status === "" ||
        bugId === "" ||
        adminEmail === "" ||
        status === undefined ||
        bugId === undefined ||
        adminEmail === undefined
      ) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "Missing required fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.updateBug(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async uploadBugFile(req: any, res: any) {
    try {
      const file = req.files;
      if (file == undefined || !file) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      // await userOps.uploadBugFile(req, res, file);
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async getTaskCenterDetails(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.getTaskCenterDetails(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async enableTradeToEarn(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.enableTradeToEarn(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async getPaypalOrder(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.getPaypalOrder(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async validatedReferralCode(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.validateReferralCode(req, res);
      res.statusCode = 200;
      res.send(
        results,
      );
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async getReferralsByEmail(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.getReferralsByUser(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }


  async getPaypalSubscription(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.getPaypalSubscription(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async getPermissionsForCaptains(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.getPermissions(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results.data,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async updatePermissionsForCaptains(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.updatePermissions(req, res);
      res.statusCode = results.status;
      res.send({
        status: results.status,
        data: results,
      });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: err } });
    }
  }

  async saveUserProfile(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.saveUserProfile(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateUserProfile(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.updateUserProfile(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUserProfile(req: any, res: any) {
    try {
      const email = req.params?.email;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.getUserProfile(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateUserLanguage(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.updateUserLanguage(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async addPhoneNumber(req: any, res: any) {
    try {
      console.log("i am here");
      let { email, phoneNumber } = req.body;
      console.log(email, phoneNumber)
      if (!email || email == undefined || !phoneNumber) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.addPhoneNumber(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async reportCompromisedAccount(req: any, res: any) {
    try {
      let { email, additionalDetails } = req.body;
      console.log(req.body)
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.reportCompromisedAccount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async reportFakeAccount(req: any, res: any) {
    try {
      let { email, additionalDetails } = req.body;
      console.log(req.body)
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.selfReportFakeAccount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async deleteAccount(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Bad Request", data: null });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.deleteAccount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }


  async deleteAccountWithEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Bad Request", data: null });
        return;
      }
      const userOps = new UserOperations(req, res);
      const results = await userOps.deleteAccountWithEmail(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getReferredUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getReferredUserDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAllHoneyBeeDashboardData(req: Request, res: Response) {
    try {
      let { username } = req.params;
      if (!username || username == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserDashboardData(req, res, username);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async requestPermissionsByCaptain(req: Request, res: Response) {
    try {
      let { captainBeeEmail, honeyBeeEmail, requestType } = req.body;
      if (
        !captainBeeEmail ||
        captainBeeEmail == undefined ||
        !honeyBeeEmail ||
        honeyBeeEmail == undefined ||
        !requestType ||
        requestType == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.requestPermissions(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updatePowerPackDetail(req: Request, res: Response) {
    try {
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async postPublicMessages(req: Request, res: Response) {
    try {
      let { email, message } = req.body;
      if (!email || email == undefined || !message || message == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.postPublicMessages(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getPublicMessages(req: Request, res: Response) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getPublicMessages(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getPublicMessagesByUsername(req: Request, res: Response) {
    try {
      let username = req.params.name;
      if (!username || username == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getPublicMessagesByName(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async stakeCryptoCoin(req: Request, res: Response) {
    try {
      let { email, coin, type, amount, percentage } = req.body;
      if (
        !email ||
        email == undefined ||
        !coin ||
        coin == undefined ||
        !type ||
        type == undefined ||
        !amount ||
        amount == undefined ||
        !percentage ||
        percentage == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.stakeCoin(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async smartApyInvest(req: Request, res: Response) {
    try {
      let { email, coin, duration, amount, percentage } = req.body;
      if (
        !email ||
        email == undefined ||
        !coin ||
        coin == undefined ||
        !duration ||
        duration == undefined ||
        !amount ||
        amount == undefined ||
        !percentage ||
        percentage == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.smartApyInvest(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async runWithdrawSmartAPYForSpecificUser(req: Request, res: Response) {
    try {
      let { email, smartApyId } = req.body;
      if (
        !email ||
        email == undefined ||
        !smartApyId ||
        smartApyId == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.runWithdrawSmartAPYForSpecificUser(
        req,
        res
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async reinvestUserSmartApy(req: Request, res: Response) {
    try {
      let { email, smartApyId } = req.body;
      if (
        !email ||
        email == undefined ||
        !smartApyId ||
        smartApyId == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.reinvestSmartAPY(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async calculateStakeReward(req: Request, res: Response) {
    try {
      let { coin, type, amount, percentage } = req.body;
      if (
        !coin ||
        coin == undefined ||
        !type ||
        type == undefined ||
        !amount ||
        amount == undefined ||
        !percentage ||
        percentage == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.calculateReward(
        amount,
        coin,
        type,
        percentage
      );
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getstakedCryptoCoin(req: Request, res: Response) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getStakedCoinsByEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getSmartAPYInvestments(req: Request, res: Response) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getSmartAPYInvestmentByEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getCommissionHistory(req: Request, res: Response) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getCommissionHistoryByEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUserByUsername(req: Request, res: Response) {
    try {
      let { username } = req.params;
      if (!username || username == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserByUserName(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUserByEmail(req: Request, res: Response) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getUserByEmail1(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async participateInLottery(req: Request, res: Response) {
    try {
      //Payment coin = INEX ||| IUSD+
      //networkType == Binance Smart Chain || Polygon
      let {
        email,
        lotteryId,
        tickets,
        userType,
        cartId,
        paymentCoin,
        networkType,
        discountAmount = 0,
      } = req.body;
      if (
        !email ||
        email === undefined ||
        !lotteryId ||
        lotteryId === undefined ||
        !tickets ||
        tickets === undefined ||
        !userType ||
        userType === undefined ||
        paymentCoin === undefined ||
        !paymentCoin ||
        networkType === undefined ||
        !networkType
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }

      email = String(email).toLowerCase();
      const getLottery = await lotteryService.findOne({
        uniqueCode: lotteryId,
      });
      if (
        getLottery.status === "completed" ||
        new Date(getLottery.closeDate) < new Date()
      ) {
        return res
          .status(403)
          .send({ status: 403, data: "Lottery is closed or completed" });
      } else {
        let orderId = "";

        let totalCost = getLottery.price * tickets.length;

        const iusdPrice = await currencyService.findOne({
          code: "IUSD+",
          type: "BUY",
        });

        const inexPrice = await currencyService.findOne({
          code: "INEX",
          type: "BUY",
        });

        let lotteryPriceInPaymentCoin;
        if (paymentCoin === "INEX") {
          console.log("inexPrice.buyPrice", inexPrice.buyPrice);
          // get price of INEX
          lotteryPriceInPaymentCoin = getLottery.price / inexPrice.buyPrice;
          totalCost = lotteryPriceInPaymentCoin * tickets.length; // this is the cost in inex if INEX is payment coin
          console.log("totalCost", totalCost);
          console.log("lotteryPriceInInex", lotteryPriceInPaymentCoin);
        } else if (paymentCoin === "BTCY") {
          const btcyPrice = await currencyService.findOne({
            code: "BTCY",
            type: "BUY"
          })
          // get price of BTCY
          lotteryPriceInPaymentCoin = getLottery.price;
          totalCost = lotteryPriceInPaymentCoin * tickets.length; // this is the cost in BTCY if BTCY is payment coin
          console.log("totalCost", totalCost);
          console.log("lotteryPriceInInex", lotteryPriceInPaymentCoin);
        }
        console.log("networkType", networkType);
        console.log("paymentCoin", paymentCoin);
        // Apply discount
        totalCost = Math.max(totalCost - discountAmount, 0); // Ensure totalCost doesn't go negative after discount

        let getUserByEmail = await userService.findOne({
          email: email,
        });
        let userWallets = getUserByEmail.userWallets;
        //get required wallet
        let findLotteryTokenWallet = userWallets.find(
          (x) => x.coinSymbol === paymentCoin && x.coinNetwork === networkType
        ) as UserWallet;
        console.log("findLotteryTokenWallet", findLotteryTokenWallet);
        if (
          !findLotteryTokenWallet ||
          findLotteryTokenWallet.coinBalance < totalCost
        ) {
          return res.status(403).json({
            message: "Insufficient funds to participate in the lottery.",
          });
        }

        if (findLotteryTokenWallet.coinBalance >= totalCost) {
          let updateUserWallet = await userService.updatePart(
            {
              email: email,
              userWallets: {
                $elemMatch: {
                  coinSymbol: paymentCoin,
                  coinNetwork: networkType,
                },
              },
            },
            {
              $inc: {
                "userWallets.$.coinBalance": totalCost * -1,
              },
              $set: {
                "userWallets.$.coinLastUsedOn": new Date(),
              },
            }
          );

          //transfer to wallet@azooca.com
          let updateUserWalletOfAdmin = await userService.updatePart(
            {
              email: "wallet@azooca.com",
              userWallets: {
                $elemMatch: {
                  coinSymbol: paymentCoin,
                  coinNetwork: networkType,
                },
              },
            },
            {
              $inc: {
                "userWallets.$.coinBalance": totalCost * 1,
              },
              $set: {
                "userWallets.$.coinLastUsedOn": new Date(),
              },
            }
          );

          const newTx = await txservice.create({
            email: "wallet@azooca.com",
            orderId: uuidv1(),
            extRef: "",
            txId: "",
            from: email,
            to: "wallet@azooca.com",
            amount: totalCost,
            exchangeName: "CEX",
            info: "Lottery Purchased amount from User",
            status: OrderStatus.Completed,
            currencyRef: paymentCoin,
            walletType: "ASSET_WALLET",
            transactionType: "USER_LOTTERY_BUY",
            txDate: new Date(),
            benificaryAddress: "",
          });
          console.log("updateUserWallet", updateUserWallet);
          // Extract ticket numbers from the tickets array
          let ticketDocument = {
            name: getLottery.name,
            lotteryId: getLottery.uniqueCode,
            totalTickets: tickets.length,
            ticketNumbers: tickets,
            email: email,
            userType: userType, // CaptainBee | HoneyBee | WebWallet | Normal
            ticketBuyDate: new Date(),
            isWinner: false,
            buyCurrency: paymentCoin,
            buyAmount:
              paymentCoin === "IUSD+"
                ? String(getLottery.price)
                : String(lotteryPriceInPaymentCoin),
            totalCost: String(totalCost),
            discountCode: req.body?.discountCode ? req.body?.discountCode : "",
            discountAmount: req.body?.discountAmount
              ? req.body?.discountAmount
              : "0",
            finalAmountAfterdiscount: req.body?.finalAmountAfterdiscount
              ? req.body?.finalAmountAfterdiscount
              : "",
            orderId: orderId,
          } as Ticket;

          const creatNewLottery = await ticketService.create(ticketDocument);

          //create order called
          let userLite = {
            userId: getUserByEmail._id,
            email: getUserByEmail.email,
            firstName: "",
            lastName: "",
            // role: user.role,
            isVerified: getUserByEmail.verification.activated,
            language: getUserByEmail.language,
          } as UserLite;

          let getRate = {
            currency: paymentCoin,
            rate:
              paymentCoin === "IUSD+" ? iusdPrice.buyPrice : inexPrice.buyPrice,
          } as Rates;

          let orderBreakdown = {
            inCurrenyName: paymentCoin,
            inAmount: totalCost,
            outCurrencyName: paymentCoin,
            outAmount: totalCost,
          } as OrderBreakdown;
          let transactionAccount = {} as TransactionAccount;
          let orderId0 = Math.floor(10000000 + Math.random() * 90000000);
          let newOrder = {
            orderId: orderId.toString(),
            status: OrderStatus.LotteryBuy,
            orderType: "LotteryBuy",
            orderRate: getRate, //Latest rate at which the order is received
            receiverAccount: transactionAccount,
            paymentType: PaymentTypes.DirectCrypto,
            breakdown: orderBreakdown as OrderBreakdown,
            user: userLite,
            created: new Date(),
            exchangeFees: Number(0),
            isCaptainPerformingOrder: false,
            captainBeeEmail: "",
            blockchainName: networkType,
          } as Order;

          let order = await orderService.create(newOrder);

          const participationResult = await lotteryService.updatePart(
            {
              email,
              uniqueCode: lotteryId,
            },
            {
              $push: { tickets: ticketDocument },
              $inc: { participantsCount: 1 },
            }
          );

          const getCartId = (await userCartTicketService.findOne({
            cartId,
          })) as any;
          console.log("card data", cartId, getCartId);

          const cartObjectId = String(getCartId?._id).toString();
          console.log("cartObjectId", cartObjectId);

          const result = await userCartTicketService.delete(cartObjectId);

          console.log("res delete chart", result);
          const updateLottery =
            await //const part = await lotteryService.create()
              res.status(200).json({
                message: "Participation successful",
                data: participationResult,
              });
        } else {
          res.status(403).json({
            message: "Insufficient  funds to participate in the lottery.",
          });
        }
      }
    } catch (error: any) {
      console.log("err", error);
      res.status(500).json({
        message: "Error participating in lottery",
        error: error.message,
      });
    }
  }

  async participatedLotteries(req: Request, res: Response) {
    try {
      const { email } = req.params;
      if (!email) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }

      // Fetch all lotteries
      const getAllLotteries = await lotteryService.find({});

      const participatedLotteries = getAllLotteries.filter((lottery) =>
        lottery.tickets.some(
          (ticket) =>
            String(ticket.email).toLowerCase() === String(email).toLowerCase()
        )
      );

      res.status(200).json({
        message: "Participated lottery details successfully fetched",
        data: participatedLotteries,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error participating in lottery",
        error: error.message,
      });
    }
  }

  async addLotteryTicketsToCart(req: Request, res: Response) {
    try {
      let { email, lotteryId, tickets, userType } = req.body;
      if (
        !email ||
        email === undefined ||
        !lotteryId ||
        lotteryId === undefined ||
        !tickets ||
        tickets === undefined ||
        !userType ||
        userType === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      email = String(email).toLowerCase();
      const cartId = uuidv1();
      const getLotteryData: Lottery = (await lotteryService.findOne({
        lotteryId,
      })) as Lottery;
      const newCartItems = {
        email,
        tickets,
        updatedAt: new Date(),
        lotteryId,
        userType,
        cartId,
        price: getLotteryData.price,
      };
      let result = await userCartTicketService.create(newCartItems);
      res.status(200).json({
        message: "Added tickets to chart successful",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error participating in lottery",
        error: error.message,
      });
    }
  }

  async getLotteryTicketsInCart(req: Request, res: Response) {
    try {
      const { cartId, email } = req.query; // Assuming cartId and lotteryId are passed as query parameters

      // Validate input
      if (!cartId || !email) {
        return res.status(400).json({ message: "Missing cartId or lotteryId" });
      }

      // Find the cart by cartId and match lotteryId in the tickets array
      const cart = await userCartTicketService.findOne({
        cartId,
        email,
      });

      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      // Extract tickets that match the lotteryId
      const tickets = cart.tickets;

      if (tickets.length === 0) {
        return res.status(404).json({
          message: "No tickets found for the specified lotteryId in the cart",
        });
      }

      // Successfully found tickets
      res.json({
        message: "Lottery tickets retrieved successfully",
        data: tickets,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error retrieving lottery tickets in cart",
        error: error.message,
      });
    }
  }

  async getLotteryTicketsInCartByEmail(req: Request, res: Response) {
    try {
      const { email } = req.query; // Assuming cartId and lotteryId are passed as query parameters

      // Validate input
      if (!email) {
        return res.status(400).json({ message: "Missing cartId or lotteryId" });
      }

      // Find the cart by cartId and match lotteryId in the tickets array
      const carts = await userCartTicketService.find({
        email,
      });

      if (!carts) {
        return res.status(404).json({ message: "Cart not found" });
      }

      // Prepare to enrich carts with lottery price information
      // const cartsWithPrice = await Promise.all(
      //   carts.map(async (cart) => {
      //     const cartObj = cart; // Convert Mongoose document to plain object, if necessary
      //     const lottery = await lotteryService.findOne({
      //       lotteryId: cartObj.lotteryId,
      //     });
      //     console.log("cartsWithPrice", lottery),
      //       // Attach price information to the cart
      //       (cartObj.price = lottery?.price || 0);

      //     return cartObj;
      //   })
      // );

      // Prepare to enrich carts with lottery price information
      const cartsWithPrice = await Promise.all(
        carts.map(async (cart: any) => {
          const lottery = await lotteryService.findOne({
            uniqueCode: cart.lotteryId,
          });

          // Make sure to clone the cart object if it's a Mongoose document
          const cartObj = cart.toObject ? cart.toObject() : { ...cart };

          console.log("cartsWithPrice", cartObj),
            // Attach price information to the cart
            (cartObj.price = lottery?.price || 0);

          return cartObj;
        })
      );

      // Successfully found tickets and included price
      res.json({
        message: "Lottery tickets retrieved successfully",
        data: cartsWithPrice, // Send the modified array
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error retrieving lottery tickets in cart",
        error: error.message,
      });
    }
  }

  async updateLotteryTicketsInCart(req: Request, res: Response) {
    try {
      const { cartId, tickets, lotteryId } = req.body;
      if (
        !tickets ||
        tickets === undefined ||
        !lotteryId ||
        lotteryId === undefined ||
        !cartId ||
        cartId === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }

      // Find the existing cart by cartId and update the tickets for the given lotteryId
      let updatedCart = await userCartTicketService.updatePart(
        { cartId, "tickets.lotteryId": lotteryId },
        { $set: { tickets: tickets } }
      );

      res.status(200).json({
        message: "Cart updated successfully",
        data: updatedCart,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error participating in lottery",
        error: error.message,
      });
    }
  }

  async claimFreeTokens(req: Request, res: Response) {
    try {
      let { email, tokenName } = req.body;
      if (
        !email ||
        email === undefined ||
        !tokenName ||
        tokenName === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      email = String(email).toLowerCase();
      let getUser = await userService.findOne({
        email: email,
      });
      let getClaimTokensData = getUser.coinClaims as CoinClaim[];
      console.log("getClaimTokensData", getClaimTokensData);
      let filterRequiredClaimToken = getClaimTokensData.find(
        (item) => item.coinSymbol == tokenName
      );
      let getUserWallets = getUser.userWallets;
      let filterRequiredWallet = getUserWallets.find(
        (x) => x.coinSymbol === tokenName
      );
      if (filterRequiredClaimToken?.claimStatus === "Completed") {
        return res
          .status(404)
          .json({ message: `${tokenName} free tokens already claimed` });
      }

      // Update the wallet balance
      await userService.updatePart(
        {
          email: email,
          "userWallets.coinSymbol": tokenName,
        },
        {
          $set: {
            "userWallets.$.coinBalance":
              Number(filterRequiredWallet?.coinBalance) +
              Number(filterRequiredClaimToken?.totalFreeCoins),
          },
        }
      );

      // Update the claim status
      await userService.updatePart(
        {
          email: email,
          "coinClaims.coinSymbol": tokenName,
        },
        {
          $set: {
            "coinClaims.$.claimStatus": "Completed",
            "coinClaims.$.claimedDate": new Date(), // Set the claimed date to now
          },
        }
      );

      //add a transaction
      await txservice.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: "",
        to: "",
        amount: Number(filterRequiredClaimToken?.totalFreeCoins),
        exchangeName: "CEX",
        info: "Free token claimed by user",
        status: OrderStatus.Completed,
        currencyRef: tokenName,
        walletType: "ASSET_WALLET",
        transactionType: "FREE_TOKENS_CLAIMED",
        txDate: new Date(),
        benificaryAddress: "",
      });

      res.status(200).json({ message: "Tokens claimed successfully" });
    } catch (error: any) {
      console.log("err", error);
      res.status(500).json({
        message: "Error in claiming",
        error: error.message,
      });
    }
  }

  async getClaimFreeTokens(req: Request, res: Response) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();
      if (!email || email === undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }

      let getUser = await userService.findOne({
        email: email,
      });
      let getClaimTokensData = getUser.coinClaims as CoinClaim[];
      res.status(200).json({
        message: "Tokens claimed successfully",
        data: getClaimTokensData,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error getting claimed token",
        error: error.message,
      });
    }
  }

  async getShortToken(req: Request, res: Response) {
    try {
      const { email } = req.params;
      if (!email || email === undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }

      let getUser = await userService.findOne({
        email: String(email).toLowerCase(),
      });

      let userType = await checkUserType(String(email).toLowerCase());
      console.log("userType", userType);

      // Set userType
      getUser.userType = userType;

      const tokenResponse = await new JwtAuthUtil().createShortToken(getUser);
      res.status(200).json({
        message: "Short Token created successfully",
        data: tokenResponse,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error getting claimed token",
        error: error.message,
      });
    }
  }

  async groupRewards(req: Request, res: Response) {
    try {
      const { emails, tokenName, numberOfCoins } = req.body;

      // Validate request body
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).send({
          status: 400,
          data: "Bad Request: 'emails' must be a non-empty array.",
        });
      }

      let errorEmails = [];

      for (let email of emails) {
        email = String(email).toLowerCase();
        let user = await userService.findOne({ email: email });

        // Check if user does not exist
        if (!user) {
          errorEmails.push({ email: email, error: "Email does not exist." });
          continue;
        }

        // Check if user has already participated in group reward
        if (user.isParticipatedInGroupReward) {
          errorEmails.push({
            email: email,
            error: "Email has already participated in group reward.",
          });
          continue;
        }

        let getUserWallets = user.userWallets;
        let filterRequiredWallet = getUserWallets.find(
          (x) => x.coinSymbol === tokenName
        );

        // Update the claim status for eligible user
        await userService.updatePart(
          {
            email: email,
            "userWallets.coinSymbol": tokenName,
          },
          {
            $set: {
              isParticipatedInGroupReward: true, // Mark as having participated
              "userWallets.$.coinBalance":
                Number(filterRequiredWallet?.coinBalance) +
                Number(numberOfCoins) / emails.length,
            },
          }
        );
      }

      if (errorEmails.length > 0) {
        // Return an error response indicating specific issues with emails
        return res.status(400).json({
          message: "Issues with processing some emails.",
          errors: errorEmails,
        });
      }

      // If all goes well
      res.status(200).json({
        message: "Group rewards successfully updated for all eligible emails.",
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error processing group rewards",
        error: error.message,
      });
    }
  }

  async registerUserWithPhone(req: any, res: any) {
    try {
      const { phone, password, username, referralCode, email } = req.body;

      if (!phone || !password || !email) {
        res.statusCode = 400;
        res.send({
          status: 400,
          message: "Phone number, email, and password are required"
        });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.registerUserWithPhone(req, res);

      console.log("dataResults", dataResults)
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (err) {
      console.log("err", err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async sendOtpToPhone(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Phone number is required" });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.sendOtpToPhone(req, res);

      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async validatePhoneOtp(req: any, res: any) {
    try {
      const { phone, code } = req.body;

      if (!phone || !code) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Phone number and OTP code are required" });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.validatePhoneOtp(req, res);

      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async loginWithPhone(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Phone number is required" });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.issueTokenWithPhone(req, res);

      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async fallbackToEmailLogin(req: any, res: any) {
    try {
      const { phone } = req.body;

      if (!phone) {
        res.statusCode = 400;
        res.send({ status: 400, message: "Phone number is required" });
        return;
      }

      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.fallbackToEmailLogin(req, res);

      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;

    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateFirebaseToken(req: any, res: any) {
    try {
      const { token, type, model, email } = req.body;
      if (!token || !type || !email || !model) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.updateUserDeviceInfo(req, res);

      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async requestLinkedAccount(req: any, res: Response) {
    try {
      const mainEmail = String(req.user?.email || "").trim().toLowerCase();
      const secondaryRaw = String(req.body?.secondaryEmail || "").trim().toLowerCase();

      if (!mainEmail) {
        return res.status(401).json({ status: 401, message: "Authentication required" });
      }
      if (!secondaryRaw) {
        return res.status(400).json({ status: 400, message: "secondaryEmail is required" });
      }
      if (mainEmail === secondaryRaw) {
        return res.status(400).json({ status: 400, message: "Cannot link the same account" });
      }

      const [mainUser, secondaryUser] = await Promise.all([
        userService.findOneSelect({ email: mainEmail }, { email: 1 }),
        userService.findOneSelect({ email: secondaryRaw }, { email: 1 }),
      ]);

      if (!mainUser) {
        return res.status(404).json({ status: 404, message: "Main account not found" });
      }
      if (!secondaryUser) {
        return res.status(404).json({ status: 404, message: "Secondary account not found" });
      }

      const activeCount = await linkedAccountService.countActive(mainEmail);
      if (activeCount >= 5) {
        return res.status(400).json({ status: 400, message: "Maximum linked accounts reached (5)" });
      }

      const existingForSecondary = await linkedAccountService.findActiveForSecondary(secondaryRaw);
      if (existingForSecondary && existingForSecondary.mainEmail !== mainEmail) {
        return res.status(400).json({ status: 400, message: "This account is already linked to another main account" });
      }
      const pendingForSecondary = await linkedAccountService.findPendingForSecondary(secondaryRaw);
      if (pendingForSecondary && pendingForSecondary.mainEmail !== mainEmail) {
        return res.status(400).json({ status: 400, message: "This account has a pending link request with another main account" });
      }

      const existing = await linkedAccountService.findActiveOrPending(mainEmail, secondaryRaw);
      if (existing && existing.status === "active") {
        return res.status(200).json({
          status: 200,
          message: "Account already linked",
          data: existing,
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      let record;
      if (existing) {
        await linkedAccountService.updatePart(
          { _id: existing._id },
          {
            $set: {
              status: "pending",
              otpHash,
              otpExpiresAt,
              percentage: 0,
            },
            $unset: {
              linkedAt: "",
              removedAt: "",
            },
          }
        );
        record = await linkedAccountService.findOne({ _id: existing._id });
      } else {
        record = await linkedAccountService.create({
          mainEmail,
          secondaryEmail: secondaryRaw,
          status: "pending",
          otpHash,
          otpExpiresAt,
          percentage: 0,
        });
      }

      await notificationEmailService.sendLinkedAccountOtp(secondaryRaw, mainEmail, otp);

      return res.status(200).json({
        status: 200,
        message: "OTP sent to secondary account",
        data: {
          requestId: record?._id,
          expiresAt: otpExpiresAt,
        },
      });
    } catch (error: any) {
      console.error("requestLinkedAccount error:", error);
      return res.status(500).json({ status: 500, message: error.message || "Failed to initiate linked account request" });
    }
  }

  async verifyLinkedAccount(req: any, res: Response) {
    try {
      const mainEmail = String(req.user?.email || "").trim().toLowerCase();
      const { requestId, otp } = req.body || {};

      if (!mainEmail) {
        return res.status(401).json({ status: 401, message: "Authentication required" });
      }
      if (!requestId || !otp) {
        return res.status(400).json({ status: 400, message: "requestId and otp are required" });
      }

      const record = await linkedAccountService.findOne({ _id: requestId });
      if (!record || record.mainEmail !== mainEmail) {
        return res.status(404).json({ status: 404, message: "Link request not found" });
      }
      if (record.status === "removed") {
        return res.status(400).json({ status: 400, message: "Link request has been removed" });
      }
      if (record.status === "active") {
        return res.status(400).json({ status: 400, message: "Account already linked" });
      }
      if (!record.otpHash || !record.otpExpiresAt || record.otpExpiresAt < new Date()) {
        return res.status(400).json({ status: 400, message: "OTP expired, please request again" });
      }

      const isValidOtp = await bcrypt.compare(String(otp), record.otpHash);
      if (!isValidOtp) {
        return res.status(400).json({ status: 400, message: "Invalid OTP" });
      }

      await linkedAccountService.updatePart(
        { _id: record._id },
        {
          $set: {
            status: "active",
            linkedAt: new Date(),
          },
          $unset: {
            otpHash: "",
            otpExpiresAt: "",
          },
        }
      );

      await linkedAccountService.recalculatePercentagesForMain(mainEmail);

      const updated = await linkedAccountService.findOne({ _id: record._id });

      return res.status(200).json({
        status: 200,
        message: "Linked account verified successfully",
        data: updated,
      });
    } catch (error: any) {
      console.error("verifyLinkedAccount error:", error);
      return res.status(500).json({ status: 500, message: error.message || "Failed to verify linked account" });
    }
  }

  async getLinkedAccounts(req: any, res: Response) {
    try {
      const mainEmail = String(req.user?.email || "").trim().toLowerCase();
      if (!mainEmail) {
        return res.status(401).json({ status: 401, message: "Authentication required" });
      }

      const records = await linkedAccountService.find({
        mainEmail,
        status: { $ne: "removed" },
      });

      const includeHistory =
        String(req.query?.includeBonusHistory ?? "false").toLowerCase() ===
        "true";
      const historyLimitRaw = Number(req.query?.bonusHistoryLimit);
      const historyLimit =
        Number.isFinite(historyLimitRaw) && historyLimitRaw > 0
          ? Math.min(50, Math.floor(historyLimitRaw))
          : 5;

      const sanitizeRecord = (record: any) => {
        const obj = record.toObject ? record.toObject() : record;
        const { otpHash, ...rest } = obj;
        return {
          ...rest,
          totalBonusEarned: Number(rest.totalBonusEarned ?? 0),
        };
      };

      let plainRecords = records.map(sanitizeRecord);

      const needsPercentageBackfill = plainRecords.some(
        (record: any) =>
          record.status === "active" &&
          (typeof record.percentage !== "number" || record.percentage <= 0)
      );

      if (needsPercentageBackfill) {
        await linkedAccountService.recalculatePercentagesForMain(mainEmail);
        const refreshedRecords = await linkedAccountService.find({
          mainEmail,
          status: { $ne: "removed" },
        });
        plainRecords = refreshedRecords.map(sanitizeRecord);
      }

      const aggregatedTotals =
        plainRecords.length > 0
          ? await linkedAccountBonusLogService.sumTotalsByMain(mainEmail)
          : {};

      const bonusHistoryBySecondary: Record<
        string,
        Array<{ amount: number; coinSymbol: string; earnedAt: Date; source?: string }>
      > = {};
      if (includeHistory && plainRecords.length > 0) {
        await Promise.all(
          plainRecords.map(async (rec) => {
            const secondaryEmail = String(rec.secondaryEmail || "").toLowerCase();
            if (!secondaryEmail) {
              return;
            }
            const logs =
              await linkedAccountBonusLogService.findRecentForPair(
                mainEmail,
                secondaryEmail,
                historyLimit
              );
            bonusHistoryBySecondary[secondaryEmail] = logs.map((log) => ({
              amount: log.amount,
              coinSymbol: log.coinSymbol,
              earnedAt: log.earnedAt,
              source: log.source,
            }));
          })
        );
      }

      const sanitized = plainRecords.map((record: any) => {
        const secondaryEmail = String(record.secondaryEmail || "").toLowerCase();
        const storedTotal = Number(record.totalBonusEarned ?? 0);
        const aggregatedTotal = Number(aggregatedTotals[secondaryEmail] ?? 0);
        const totalBonusEarned =
          aggregatedTotal > 0 ? aggregatedTotal : storedTotal;
        return {
          ...record,
          totalBonusEarned,
          storedBonusEarned: storedTotal,
          aggregatedBonusEarned: aggregatedTotal,
          bonusEarnedFromSecondary: totalBonusEarned,
          ...(includeHistory
            ? {
                recentBonusHistory:
                  bonusHistoryBySecondary[secondaryEmail] || [],
              }
            : {}),
        };
      });

      return res.status(200).json({ status: 200, data: sanitized });
    } catch (error: any) {
      console.error("getLinkedAccounts error:", error);
      return res.status(500).json({ status: 500, message: error.message || "Failed to fetch linked accounts" });
    }
  }

  async removeLinkedAccount(req: any, res: Response) {
    try {
      const mainEmail = String(req.user?.email || "").trim().toLowerCase();
      const { linkId } = req.params;

      if (!mainEmail) {
        return res.status(401).json({ status: 401, message: "Authentication required" });
      }
      if (!linkId) {
        return res.status(400).json({ status: 400, message: "linkId is required" });
      }

      const record = await linkedAccountService.findOne({ _id: linkId });
      if (!record || record.mainEmail !== mainEmail) {
        return res.status(404).json({ status: 404, message: "Linked account not found" });
      }
      if (record.status === "removed") {
        return res.status(200).json({ status: 200, message: "Linked account already removed" });
      }

      await linkedAccountService.updatePart(
        { _id: record._id },
        {
          $set: {
            status: "removed",
            removedAt: new Date(),
            percentage: 0,
          },
          $unset: {
            otpHash: "",
            otpExpiresAt: "",
          },
        }
      );

      await linkedAccountService.recalculatePercentagesForMain(mainEmail);

      return res.status(200).json({ status: 200, message: "Linked account removed successfully" });
    } catch (error: any) {
      console.error("removeLinkedAccount error:", error);
      return res.status(500).json({ status: 500, message: error.message || "Failed to remove linked account" });
    }
  }
}
