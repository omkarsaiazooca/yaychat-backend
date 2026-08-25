import { AuthProviders, Currency, Languages } from "../data/common";
import { MessageConstants } from "../data/constants";
import { CoreWallet } from "../data/coreWallet";
import { User, UserLite, UserRoleTypes, UserVerification } from "../data/user";
import { SendEmail } from "../platform/email.operations";
import { UserOperations } from "../platform/user.operations";
import { WalletOperations } from "../platform/wallet.operations";
import { WalletUserOperations } from "../platform/walletuser.operations";
import { AffilateService } from "../services/affiliate.service";
import { CoreWalletService } from "../services/coreWallet.service";
import { OrderService } from "../services/order.service";
import { UserService } from "../services/user.service";
import { WalletUserService } from "../services/walletUser.service";
import { TransactionService } from "../services/transaction.service";
import { StakingService } from "../services/staking.service";
import { getPriceByName } from "./priceAPI";
import { getPrevDayPriceByName } from "./priceAPI";
import { createClient } from "redis";

let wuserservice: WalletUserService = new WalletUserService();
let emailService: SendEmail = new SendEmail();
let uservice: UserService = new UserService();
let affilateService: AffilateService = new AffilateService();
let orderService: OrderService = new OrderService();

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com",
    port: 11678,
  },
});

export class WalletController {
  constructor() {}

  private insufficientBalanceResponse(coin: string) {
    return {
      status: 400,
      data: `Insufficient ${coin || "crypto"} balance`,
    };
  }

  private async validateCryptoWithdrawalBalance(
    email: string,
    coin: string,
    amount: number,
    fromWalletAddress: string = ""
  ) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCoin = String(coin || "").trim();
    const normalizedFromWalletAddress = String(fromWalletAddress || "").trim();

    if (!normalizedEmail || normalizedEmail === "undefined") {
      return { status: 400, data: "email is required" };
    }

    if (!normalizedCoin) {
      return { status: 400, data: "coin is required" };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return { status: 400, data: "amount must be greater than 0" };
    }

    const user = await wuserservice.findOneSelect(
      { email: normalizedEmail },
      { userWallets: 1 }
    );
    if (!user) {
      return { status: 500, data: "User not found" };
    }

    const requestedCoin = normalizedCoin.toLowerCase();
    const userWallet = (user.userWallets || []).find((wallet: any) => {
      const walletCoin = String(wallet?.coinSymbol || "").trim().toLowerCase();
      const walletAddress = String(wallet?.coinWalletAddress || "").trim();
      return (
        walletCoin === requestedCoin &&
        (!normalizedFromWalletAddress ||
          walletAddress === normalizedFromWalletAddress)
      );
    });

    if (!userWallet) {
      return { status: 500, data: "Wallet not found" };
    }

    const walletBalance = Number(userWallet.coinBalance || 0);
    if (!Number.isFinite(walletBalance) || walletBalance < amount) {
      return this.insufficientBalanceResponse(normalizedCoin);
    }

    return null;
  }

  async createWallet(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let coin = req.params.coin;
      let email = req.params.email;
      email = String(email).toLowerCase();

      if (req.params.coin == "BTC") {
        dataResults = await walletOps.createBitcoinWallet(email, coin);
      } else if (req.params.coin == "ETH") {
        dataResults = await walletOps.createEthereumWallet(email, coin);
      } else if (req.params.coin == "BNB") {
        dataResults = await walletOps.createBinanceWallet(email, coin);
      } else if (req.params.coin == "IN500") {
        dataResults = await walletOps.createIN500Wallet(email, coin);
      } else if (req.params.coin == "INXC") {
        dataResults = await walletOps.createINXCWallet(email, coin);
      } else if (req.params.coin == "IUSDP") {
        dataResults = await walletOps.createIUSDPWallet(email, coin);
      } else if (req.params.coin == "BUSD") {
        dataResults = await walletOps.createBUSDWallet(email, coin);
      } else if (req.params.coin == "INEX") {
        dataResults = await walletOps.createINEXWallet(email, coin);
      } else if (req.params.coin == "DaCrazy") {
        dataResults = await walletOps.createINEXWallet(email, coin);
      } else if (req.params.coin == "LTC") {
        dataResults = await walletOps.createLitecoinWallet(email, coin);
      }

      if (dataResults) {
        res.statusCode = dataResults.status;
        res.send(dataResults);
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {}
  }

  async verifyWallet(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let coin = req.params.coin;
      let email = req.params.email;
      email = String(email).toLowerCase();

      let address = req.body.address;
      if (req.params.coin == "BTC") {
        dataResults = await walletOps.verifyBitcoinWallet(email, coin, address);
      } else if (req.params.coin == "ETH") {
        dataResults = await walletOps.verifyEthereumWallet(
          email,
          coin,
          address
        );
      } else if (req.params.coin == "BNB") {
        dataResults = await walletOps.verifyBinanceWallet(email, coin, address);
      } else if (req.params.coin == "IN500" || req.params.coin == "iN500") {
        dataResults = await walletOps.verifyIN500Wallet(email, coin, address);
      } else if (req.params.coin == "INXC" || req.params.coin == "iNXC") {
        dataResults = await walletOps.verifyINXCWallet(email, coin, address);
      } else if (req.params.coin == "IUSD+" || req.params.coin == "iUSD+") {
        dataResults = await walletOps.verifyIUSDPWallet(email, coin, address);
      } else if (req.params.coin == "BUSD") {
        dataResults = await walletOps.verifyBUSDWallet(email, coin, address);
      } else if (req.params.coin == "INEX" || req.params.coin == "iNEX") {
        dataResults = await walletOps.verifyINEXWallet(email, coin, address);
      }

      if (dataResults) {
        res.statusCode = dataResults.status;
        res.send(dataResults);
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {}
  }

  async sendCrypto(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let email = req.params.email || req.body.email;
      email = String(email).toLowerCase();

      let coin = req.body.coin;
      let address = req.body.address;
      let chain = req.body.chain;
      let amount = Number(req.body.amount);
      const balanceValidation = await this.validateCryptoWithdrawalBalance(
        email,
        coin,
        amount
      );
      if (balanceValidation) {
        res.statusCode = balanceValidation.status;
        res.send(balanceValidation);
        return;
      }
      console.log("amount", amount);
      if (req.body.coin == "BTC") {
        dataResults = await walletOps.sendBitcoin1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "ETH") {
        dataResults = await walletOps.sendEthereum1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "BNB") {
        dataResults = await walletOps.sendBinance1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "IN500" || req.body.coin == "iN500") {
        dataResults = await walletOps.sendIN500(email, coin, address, amount);
      } else if (req.body.coin == "INXC" || req.body.coin == "iNXC") {
        dataResults = await walletOps.sendINXC(email, coin, address, amount);
      } else if (req.body.coin == "IUSD+" || req.body.coin == "iUSD+") {
        dataResults = await walletOps.sendIUSDP(email, coin, address, amount);
      } else if (req.body.coin == "BUSD") {
        dataResults = await walletOps.sendBUSD(email, coin, address, amount);
      } else if (req.body.coin == "INEX" || req.body.coin == "iNEX") {
        dataResults = await walletOps.sendINEX(email, coin, address, amount);
      } else if (
        (req.body.coin == "IN500" || req.body.coin == "iN500") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendIN500OnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "INXC" || req.body.coin == "iNXC") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendINXCOnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "IUSD+" || req.body.coin == "iUSD+") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendIUSDPOnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "INEX" || req.body.coin == "iNEX") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendINEXOnETH(
          email,
          coin,
          address,
          amount
        );
      }

      const responseBody =
        dataResults ?? { status: 500, data: "Internal Server Error" };
      const responseStatus =
        typeof responseBody?.status === "number"
          ? responseBody.status
          : Number(responseBody?.status) || 500;

      await emailService.sendWithdrawalRequestNotification({
        userEmail: email,
        coin,
        amount,
        address,
        chain,
        statusCode: responseStatus,
        responseBody,
      });

      res.statusCode = responseStatus;
      res.send(responseBody);
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async sendCryptoFromWalletUser(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let email = String(req.body.email).toLowerCase();
      let coin = req.body.coin;
      let address = req.body.address;
      let amount = Number(req.body.amount);
      let chain = req.body.chain;
      const balanceValidation = await this.validateCryptoWithdrawalBalance(
        email,
        coin,
        amount
      );
      if (balanceValidation) {
        res.statusCode = balanceValidation.status;
        res.send(balanceValidation);
        return;
      }
      console.log("amount", amount);
      if (req.body.coin == "BTC") {
        dataResults = await walletOps.sendBitcoin1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "ETH") {
        dataResults = await walletOps.sendEthereum1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "BNB") {
        dataResults = await walletOps.sendBinance1(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "IN500" || req.body.coin == "iN500") &&
        chain === "BNB"
      ) {
        dataResults = await walletOps.sendIN500(email, coin, address, amount);
      } else if (
        (req.body.coin == "INXC" || req.body.coin == "iNXC") &&
        chain === "BNB"
      ) {
        dataResults = await walletOps.sendINXC(email, coin, address, amount);
      } else if (
        (req.body.coin == "IUSD+" || req.body.coin == "iUSD+") &&
        chain === "BNB"
      ) {
        dataResults = await walletOps.sendIUSDP(email, coin, address, amount);
      } else if (req.body.coin == "BUSD") {
        dataResults = await walletOps.sendBUSD(email, coin, address, amount);
      } else if (
        (req.body.coin == "INEX" || req.body.coin == "iNEX") &&
        chain === "BNB"
      ) {
        dataResults = await walletOps.sendINEX(email, coin, address, amount);
      } else if (req.body.coin == "MATIC") {
        dataResults = await walletOps.sendMatic(email, coin, address, amount);
      } else if (
        (req.body.coin == "IN500" || req.body.coin == "iN500") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendIN500OnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "INXC" || req.body.coin == "iNXC") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendINXCOnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "IUSD+" || req.body.coin == "iUSD+") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendIUSDPOnETH(
          email,
          coin,
          address,
          amount
        );
      } else if (
        (req.body.coin == "INEX" || req.body.coin == "iNEX") &&
        chain === "ETH"
      ) {
        dataResults = await walletOps.sendINEXOnETH(
          email,
          coin,
          address,
          amount
        );
      }

      if (dataResults) {
        res.statusCode = dataResults.status;
        res.send(dataResults);
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async sendCryptoForFromWalletUser(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let email = String(String(req.body.email).toLowerCase()).toLowerCase();
      let coin = req.body.coin;
      let address = req.body.address;
      let userWallerAddress = req.body.fromWalletAddress;
      let amount = Number(req.body.amount);
      const balanceValidation = await this.validateCryptoWithdrawalBalance(
        email,
        coin,
        amount,
        userWallerAddress
      );
      if (balanceValidation) {
        res.statusCode = balanceValidation.status;
        res.send(balanceValidation);
        return;
      }
      console.log("amount", amount);
      if (req.body.coin == "BTC") {
        dataResults = await walletOps.sendBitcoin1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "ETH") {
        dataResults = await walletOps.sendEthereum1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "BNB") {
        dataResults = await walletOps.sendBinance1(
          email,
          coin,
          address,
          amount
        );
      } else if (req.body.coin == "IN500" || req.body.coin == "iN500") {
        dataResults = await walletOps.sendIN500(email, coin, address, amount);
      } else if (req.body.coin == "INXC" || req.body.coin == "iNXC") {
        dataResults = await walletOps.sendINXC(email, coin, address, amount);
      } else if (req.body.coin == "IUSD+" || req.body.coin == "iUSD+") {
        dataResults = await walletOps.sendIUSDP(email, coin, address, amount);
      } else if (req.body.coin == "BUSD") {
        dataResults = await walletOps.sendBUSD(email, coin, address, amount);
      } else if (req.body.coin == "INEX" || req.body.coin == "iNEX") {
        dataResults = await walletOps.sendINEX(email, coin, address, amount);
      } else if (req.body.coin == "MATIC") {
        dataResults = await walletOps.sendMatic(
          email,
          coin,
          address,
          amount,
          userWallerAddress
        );
      }

      if (dataResults) {
        res.statusCode = dataResults.status;
        res.send(dataResults);
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async saveUserMnemonic(req: any, res: any) {
    try {
      let mnemonic = req.body.mnemonic;
      let userRandomEmail = String(
        String(req.body.email).toLowerCase()
      ).toLowerCase();
      let userRandomPassword = req.body.password;
      let referralCode = req.body.referralCode;

      let getUserData = await wuserservice.findOne({
        email: userRandomEmail,
      });
      let register = await uservice.findOne({ email: userRandomEmail });

      let createUser: User = {} as User;
      let email: string = "";
      console.log("getUserData", getUserData);
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
        res.statusCode = 500;
        res.send({
          status: 500,
          message: message,
        });
      } else if (getUserData) {
        email = getUserData.email;
      } else {
        let basicDetails = {};
        const newUser: User = {
          email: String(userRandomEmail).toLowerCase(),
          role: UserRoleTypes.Standard,
          authProviders: [
            {
              provider: AuthProviders.Local,
            },
          ],
          baseCurrency: Currency.USD,
          basic: basicDetails,
          userMnemonic: mnemonic,
          password: userRandomPassword,
        } as User;
        createUser = await wuserservice.create(newUser);
        email = createUser.email;
      }
      // check for existing record with same random number and update it or insert a new one?
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults = await walletOps.createBitcoinWalletForWalletUser(email);
      dataResults = await walletOps.createEthereumWalletForWalletUser(email);
      dataResults = await walletOps.createBinanceWalletForWalletUser(email);
      dataResults = await walletOps.createMaticWalletForWalletUser(email);

      await walletOps.createeINEXWalletForWalletUser(email);
      await walletOps.createeIN500WalletForWalletUser(email);
      await walletOps.createeINXCWalletForWalletUser(email);
      await walletOps.createeIUSDPWalletForWalletUser(email);
      await walletOps.createETHINEXWalletForWalletUser(email);
      await walletOps.createETHWIBSWalletForWalletUser(email);
      await walletOps.createETHIN500WalletForWalletUser(email);
      await walletOps.createETHINXCWalletForWalletUser(email);
      await walletOps.createETHIUSDPWalletForWalletUser(email);
      await walletOps.createMATICINEXWalletForWalletUser(email);
      //link the email, password to exchange
      const userOps = new UserOperations(req, res);
      let dataResults2 = await userOps.registerUser(
        req,
        res,
        email,
        userRandomPassword,
        "username",
        referralCode,
        false,
        referralCode ? "HoneyBeeRegister" : "",
        "WebWallet"
      );
      res.statusCode = 200;
      res.send({
        status: 200,
        message: "Wallet and user created",
      });
    } catch (err) {
      console.log("Error in saving mnemonic", err);
    }
  }

  async getUserByMnemonic(req: any, res: any) {
    try {
      let mnemonic = req.body.mnemonic;

      let getUserData = await wuserservice.findOne({
        userMnemonic: mnemonic,
      });
      console.log(getUserData);

      if (getUserData) {
        res.statusCode = 200;
        res.send({
          status: 200,
          data: getUserData,
        });
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {
      console.log("Error in saving mnemonic", err);
    }
  }

  async getWallet(req: any, res: any) {}

  async createCoreWallet(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let coin = req.params.coin;
      let isAdmin = await this.checkIsAdmin(
        String(req.body.email).toLowerCase()
      );
      if (isAdmin) {
        if (req.params.coin == "BTC") {
          dataResults = await walletOps.createBitcoinCoreWallet("", coin);
        } else if (req.params.coin == "ETH") {
          dataResults = await walletOps.createEthereumCoreWallet();
        } else if (req.params.coin == "BNB") {
          dataResults = await walletOps.createBinanceCoreWallet();
        } else if (req.params.coin == "INEX") {
          dataResults = await walletOps.createIndexxExCoreWallet();
        } else if (req.param.coin == "INXC") {
          dataResults = await walletOps.createIndexxCryptoCoreWallet();
        } else if (req.param.coin == "IN500") {
          dataResults = await walletOps.createIndexx500CoreWallet();
        } else if (req.param.coin == "INUSD+") {
          dataResults = await walletOps.createIndexxUSDPCoreWallet();
        } else if (req.param.coin == "BTCY") {
          dataResults = await orderService.createBitcoinYahWallet(
            req.body.email,
            coin
          );
        }
        if (dataResults) {
          res.statusCode = dataResults.status;
          res.send(dataResults);
        } else {
          res.statusCode = 500;
          res.send({ status: 500, data: "Internal Server Error" });
        }
      } else {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: "User not allowed to create wallet only admin can create wallet",
        });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async getCoreWallet(req: any, res: any) {
    try {
      let email = String(req.body.email).toLowerCase();
      let coin = req.params.coin;
      let isAdmin = await this.checkIsAdmin(email);
      if (isAdmin) {
        let coreWalletService: CoreWalletService = new CoreWalletService();
        let coreWallet = await coreWalletService.findOneSelect(
          { coin: coin },
          {}
        );
        if (coreWallet) {
          res.statusCode = 200;
          res.send(coreWallet);
        } else {
          res.send({ status: 500, data: "Internal Server Error " });
        }
      } else {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: "User not allowed to get wallet only admin can get wallet",
        });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async getFTTWallet(req: any, res: any) {
    try {
      let coreWalletService: CoreWalletService = new CoreWalletService();
      let coreWallet = await coreWalletService.findOneSelect(
        { coin: "FTT" },
        {
          coinPrivateKey: 0,
        }
      );
      if (coreWallet) {
        res.statusCode = 200;
        res.send(coreWallet);
      } else {
        res.send({ status: 500, data: "Internal Server Error " });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async addAccount(req: any, res: any) {
    try {
      let { privateKey, coinName, email } = req.body;
      console.log(email);
      if (
        !email ||
        email == undefined ||
        !privateKey ||
        privateKey == undefined ||
        !coinName ||
        coinName == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.addAccount(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async addBridgeCoins(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.addBridgeCoins(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async updateBridgeCoins(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.updateBridgeCoins(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async findBridgeCoins(req: any, res: any) {
    try {
      let { email } = req.body;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.findBridgeCoins(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async createChainExchange(req: any, res: any) {
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
      console.log(
        fromAmount,
        flow,
        payoutAddress,
        fromCurrency,
        toCurrency,
        fromNetwork,
        toNetwork
      );
      if (
        !fromAmount ||
        fromAmount == undefined ||
        !flow ||
        flow == undefined ||
        !fromNetwork ||
        fromNetwork == undefined ||
        !payoutAddress ||
        payoutAddress == undefined ||
        !fromAmount ||
        fromAmount == undefined ||
        !fromCurrency ||
        fromCurrency == undefined ||
        !toCurrency ||
        toCurrency == undefined ||
        !toNetwork ||
        toNetwork == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.createBridgeCoinExchange(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async getBridgeTxDetails(req: any, res: any) {
    try {
      const { txId } = req.params;
      if (!txId || txId === undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.getBridgeByTxId(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }
  async sendFromCoreWallet(req: any, res: any) {
    try {
    } catch (err) {}
  }

  async createAllWallet(req: any, res: any) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults;
      let email = req.params.email;
      email = String(email).toLowerCase();

      dataResults = await walletOps.createBitcoinWalletForWalletUser(email);
      dataResults = await walletOps.createEthereumWalletForWalletUser(email);
      dataResults = await walletOps.createBinanceWalletForWalletUser(email);
      dataResults = await walletOps.createeIN500WalletForWalletUser(email);
      dataResults = await walletOps.createeINXCWalletForWalletUser(email);
      dataResults = await walletOps.createeIUSDPWalletForWalletUser(email);
      dataResults = await walletOps.createeINEXWalletForWalletUser(email);
      //dataResults = await walletOps.createLitecoinWallet(email);
      dataResults = await walletOps.createMakerWalletForWalletUser(email);
      dataResults = await walletOps.createMaticWalletForWalletUser(email);

      if (dataResults) {
        res.statusCode = dataResults.status;
        res.send(dataResults);
      } else {
        res.statusCode = 500;
        res.send({ status: 500, data: "Internal Server Error" });
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
    }
  }

  async createUser(req: any, res: any) {
    try {
      console.log(req.body, "req.body");
      console.log(req.body.user.providerData, "req.body");
      let userEmail = req.body.user.email;
      let user = await wuserservice.findOne({ email: userEmail });
      if (user) {
        console.log("user exists", user);
      } else {
        let basicDetails = {};
        if (req.body.user.providerData[0].providerId) {
          basicDetails = {
            email: String(userEmail).toLowerCase(),
            firstName: String(req.body.user.displayName).split(" ")[0],
            lastName: String(req.body.user.displayName).split(" ")[1],
            role: UserRoleTypes.Standard,
            isVerified: req.body.user.emailVerified,
            language: Languages.US,
            profilePhoto: req.body.user.photoUrl,
          } as UserLite;
        }
        const newUser: User = {
          email: String(userEmail).toLowerCase(),
          role: UserRoleTypes.Standard,
          authProviders: [
            {
              provider: String(
                req.body.user.providerData[0].providerId
              ).includes("facebook")
                ? AuthProviders.Facebook
                : String(req.body.user.providerData[0].providerId).includes(
                    "google"
                  )
                ? AuthProviders.Google
                : AuthProviders.Local,
            },
          ],
          verification: {
            emailVerified: req.body.user.emailVerified,
          } as UserVerification,
          baseCurrency: Currency.USD,
          basic: basicDetails,
        } as User;
        let createUser = await wuserservice.create(newUser);

        console.log("createduser", user);
        const walletOps: WalletOperations = new WalletOperations(req, res);
        let email = createUser.email;
        let dataResults = await walletOps.createBitcoinWalletForWalletUser(
          email
        );
        dataResults = await walletOps.createEthereumWalletForWalletUser(email);
        dataResults = await walletOps.createBinanceWalletForWalletUser(email);
        /*
        dataResults = await walletOps.createeIN500WalletForWalletUser(email);
        dataResults = await walletOps.createeINXCWalletForWalletUser(email);
        dataResults = await walletOps.createeIUSDPWalletForWalletUser(email);
        dataResults = await walletOps.createeINEXWalletForWalletUser(email);
        */
        dataResults = await walletOps.createMaticWalletForWalletUser(email);
        //dataResults = await walletOps.createMakerWalletForWalletUser(email);

        /* send email */
        let sendEmail = await emailService.sendWalletWelcomeEmail(
          email,
          "User"
        );
        console.log({
          status: 200,
          message: "Wallet and user created",
        });
        return {
          status: 200,
          message: "Wallet and user created",
        };
      }
    } catch (err) {
      console.log(err, "err in createUser");
      res.statusCode = 500;
      res.send({ status: 500, data: "Internal Server Error " + err });
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
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.getUserWallets1(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async getUserSpecificWallet(req: any, res: any) {
    try {
      let { email, coinName } = req.params;
      if (!email || email == undefined || !coinName || coinName == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.getUserSpecificWallet(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }
  async getUserSpecificWalletKey(req: any, res: any) {
    try {
      let { email, coinName } = req.params;
      if (!email || email == undefined || !coinName || coinName == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.getUserSpecificWalletKey(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (error) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async getUserTransactions(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
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

  async getUserDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.getUserDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updatePersonalDetails(req: any, res: any) {
    try {
      let { firstName, lastName, phone, photo, email } = req.body;
      console.log(email);
      email = String(email).toLowerCase();
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.updatePersonalDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateBankDetails(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new WalletUserOperations(req, res);
      const dataResults = await userOps.updateBankDetails(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  //Helpers
  async checkIsAdmin(email: string) {
    try {
      let userService: UserService = new UserService();
      let user = await userService.findOneSelect({ email: email }, {});
      if (user) {
        if (user.role == "Admin") {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  async createFirstTimeWallets(req: any, res: any, email: string) {
    try {
      const walletOps: WalletOperations = new WalletOperations(req, res);
      let dataResults = await walletOps.createBitcoinWalletForWalletUser(email);
      dataResults = await walletOps.createEthereumWalletForWalletUser(email);
      dataResults = await walletOps.createBinanceWalletForWalletUser(email);
      dataResults = await walletOps.createeIN500WalletForWalletUser(email);
      dataResults = await walletOps.createeINXCWalletForWalletUser(email);
      dataResults = await walletOps.createeIUSDPWalletForWalletUser(email);
      dataResults = await walletOps.createeINEXWalletForWalletUser(email);
      //dataResults = await walletOps.createLitecoinWallet(email);
      dataResults = await walletOps.createMakerWalletForWalletUser(email);
      dataResults = await walletOps.createMaticWalletForWalletUser(email);
      return {
        status: 200,
        message: "Wallets created",
      };
    } catch (err) {
      console.log("err in createFirstTimeWallets", err);
      return err;
    }
  }

  async getUserPerformance(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        return res
          .status(400)
          .send({ status: 400, data: { message: "badRequest" } });
      }

      // Connect to Redis if not already connected
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }

      // Create a unique cache key for this user's performance data
      const cacheKey = `user_performance:${email}`;
      
      // Try to get cached result first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData !== null) {
        console.log(`Using cached performance data for user: ${email}`);
        return res.status(200).send({ status: 200, data: JSON.parse(cachedData) });
      }

      // If no cached data, perform all calculations as before
      // Get user data with wallets
      const userService = new UserService();
      const user = await userService.findOneSelect(
        { email },
        { userWallets: 1 }
      );

      if (!user) {
        return res
          .status(404)
          .send({ status: 404, data: { message: "User not found" } });
      }

      const userWallets = user.userWallets || [];

      // Fetch all required data concurrently
      const txService = new TransactionService();
      const orderService = new OrderService();
      const stakingService = new StakingService();

      const [transactions, sellTransactions, sellOrders, stakedData] =
        await Promise.all([
          txService.find({
            email,
            transactionType: { $in: ["INVESTMENT", "PURCHASED_COINS", "BUY"] },
            status: "Completed",
          }),
          txService.find({
            email,
            transactionType: { $in: ["SELL", "SOLD_COINS"] },
            status: "Completed",
          }),
          orderService.find({
            "user.email": email,
            orderType: { $in: ["Sell", "SellETF", "BUY"] },
            status: "Completed",
          }),
          stakingService.find({
            email,
            isActive: true,
          }),
        ]);

      // Create a map of transaction IDs to their corresponding orders for quick lookup
      const sellOrderMap = new Map(
        sellOrders.map((order) => [order.orderId, order])
      );

      // Time periods for historical data
      const now = new Date();
      const timePeriods = {
        oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        oneWeekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        oneMonthAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        threeMonthsAgo: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        sixMonthsAgo: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      };

      // Special tokens that need different price handling
      const specialTokens = new Set([
        "iUSD+",
        "IUSD+",
        "INEX",
        "DaCrazy",
        "INXC",
        "WIBS",
        "IN500",
      ]);

      // Calculate current balances and pricing data
      const walletBalancePromises = userWallets
        .filter((wallet) => wallet.coinBalance > 0)
        .map(async (wallet) => {
          try {
            const priceResponse = await getPriceByName(wallet.coinSymbol);
            const currentPrice = priceResponse.data;

            let prevPrice = currentPrice;
            if (
              wallet.coinSymbol !== "USD" &&
              !specialTokens.has(wallet.coinSymbol)
            ) {
              const prevPriceData = await getPrevDayPriceByName(
                wallet.coinSymbol
              );
              prevPrice = prevPriceData.data;
            }

            return {
              current: wallet.coinBalance * currentPrice,
              prevDay: wallet.coinBalance * prevPrice,
              coinSymbol: wallet.coinSymbol,
            };
          } catch (error) {
            console.error(
              `Error fetching price for ${wallet.coinSymbol}`,
              error
            );
            return { current: 0, prevDay: 0, coinSymbol: wallet.coinSymbol };
          }
        });

      const stakedBalancePromises = stakedData.map(async (staked) => {
        try {
          const priceResponse = await getPriceByName(staked.coin);
          const price = staked.coin === "INEX" ? 2 : priceResponse.data;
          return staked.stakedAmount * price;
        } catch (error) {
          console.error(`Error fetching price for ${staked.coin}`, error);
          return 0;
        }
      });

      // Wait for all price calculations to complete
      const walletBalances = await Promise.all(walletBalancePromises);
      const stakedBalances = await Promise.all(stakedBalancePromises);

      // Sum up the balance calculations
      const estimatedBalance = walletBalances.reduce(
        (sum, item) => sum + item.current,
        0
      );
      const prevDayEstimatedBalance = walletBalances.reduce(
        (sum, item) => sum + item.prevDay,
        0
      );
      const stakedBalance = stakedBalances.reduce(
        (sum, amount) => sum + amount,
        0
      );
      const investmentAmount = transactions.reduce(
        (sum, tx) => sum + (tx.amountInvested || 0),
        0
      );

      // Helper function to calculate value of sold coins for a specific time period
      const calculateSoldCoinsValue = async (
        startDate: Date,
        endDate: Date
      ) => {
        const relevantTransactions = sellTransactions.filter((tx) => {
          const txDate = new Date(tx.txDate);
          return txDate >= startDate && txDate <= endDate;
        });

        const valuePromises = relevantTransactions.map(async (tx) => {
          try {
            const coin = tx.currencyRef || "";
            if (!coin) return 0;

            // Try to find the corresponding order for more accurate price data
            const matchingOrder = sellOrderMap.get(tx.orderId);
            let price;

            if (matchingOrder?.orderRate?.rate) {
              // Use the price recorded at the time of the order
              price = matchingOrder.orderRate.rate;
            } else {
              // Fallback to current price if order data not available
              const priceResponse = await getPriceByName(coin as string);
              price = priceResponse.data;
            }

            return tx.amount * price;
          } catch (error) {
            console.error(
              `Error calculating sold value for ${tx.currencyRef}`,
              error
            );
            return 0;
          }
        });

        const values = await Promise.all(valuePromises);
        return values.reduce((sum, value) => sum + value, 0);
      };

      // Only calculate oneDaySoldValue
      const oneDaySoldValue = await calculateSoldCoinsValue(
        timePeriods.oneDayAgo,
        now
      );

      const totalBalance = estimatedBalance + stakedBalance;
      const prevDayTotalBalance =
        prevDayEstimatedBalance + stakedBalance + oneDaySoldValue;

      // Calculate PnL
      const todayValue = totalBalance - prevDayTotalBalance;
      const todayPercentage =
        prevDayTotalBalance > 0 ? (todayValue / prevDayTotalBalance) * 100 : 0;

      const portfolioValue = totalBalance - investmentAmount;
      const portfolioPercentage =
        investmentAmount > 0 ? (portfolioValue / investmentAmount) * 100 : 0;

      // Helper function to calculate historical balance at a specific point in time
      const calculateHistoricalBalance = async (date: Date) => {
        // Start with current balance as base
        let historicalBalance = totalBalance;

        // Add the value of all assets sold after the given date
        const relevantOrders = sellOrders.filter(
          (order) => new Date(order.orderCompletedOn) > date
        );

        for (const order of relevantOrders) {
          try {
            if (
              order.breakdown?.inAmount &&
              order.breakdown?.inCurrenyName &&
              order.orderRate?.rate
            ) {
              // Add back the value of what was sold
              historicalBalance +=
                order.breakdown.inAmount * order.orderRate.rate;
            }
          } catch (error) {
            console.error(
              `Error calculating historical value for order ${order.orderId}`,
              error
            );
          }
        }

        return historicalBalance;
      };

      // Generate data points between start and end
      const generateDataPoints = async (
        startDate: Date,
        endDate: Date,
        numPoints: number
      ) => {
        // End value is the current total balance
        const endValue = totalBalance;
        // Create time intervals between start and end
        const interval =
          (endDate.getTime() - startDate.getTime()) / (numPoints - 1);

        // Generate intermittent points with a small amount of randomness
        const dataPointPromises = Array.from({ length: numPoints }).map(
          async (_, i) => {
            if (i === numPoints - 1) {
              // Last point is exactly the current balance
              return parseFloat(endValue.toFixed(2));
            } else {
              // Calculate the date for this point
              const pointDate = new Date(startDate.getTime() + interval * i);

              // Add a small random variation to make the chart look more natural
              const baseValue = await calculateHistoricalBalance(pointDate);
              const randomVariation = Math.random() * 0.04 - 0.02; // ±2% random variation
              const pointValue = baseValue * (1 + randomVariation);

              return parseFloat(pointValue.toFixed(2));
            }
          }
        );

        return Promise.all(dataPointPromises);
      };

      // Generate chart data for different time periods concurrently
      const [dailyData, weeklyData, monthlyData, quarterlyData, sixMonthData] =
        await Promise.all([
          generateDataPoints(timePeriods.oneDayAgo, now, 24),
          generateDataPoints(timePeriods.oneWeekAgo, now, 7),
          generateDataPoints(timePeriods.oneMonthAgo, now, 30),
          generateDataPoints(timePeriods.threeMonthsAgo, now, 12),
          generateDataPoints(timePeriods.sixMonthsAgo, now, 24),
        ]);

      // Format the response data
      const performanceData = {
        balances: {
          estimatedBalance: parseFloat(estimatedBalance.toFixed(2)),
          stakedBalance: parseFloat(stakedBalance.toFixed(2)),
          totalBalance: parseFloat(totalBalance.toFixed(2)),
          investmentAmount: parseFloat(investmentAmount.toFixed(2)),
        },
        pnl: {
          today: {
            value: parseFloat(todayValue.toFixed(2)),
            percentage: parseFloat(todayPercentage.toFixed(2)),
          },
          portfolio: {
            value: parseFloat(portfolioValue.toFixed(2)),
            percentage: parseFloat(portfolioPercentage.toFixed(2)),
          },
        },
        chartData: {
          "1D": {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            data: dailyData,
          },
          "1W": {
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            data: weeklyData,
          },
          "1M": {
            labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
            data: monthlyData,
          },
          "3M": {
            labels: Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`),
            data: quarterlyData,
          },
          "6M": {
            labels: Array.from({ length: 24 }, (_, i) => `Week ${i + 1}`),
            data: sixMonthData,
          },
        },
      };

      // After generating performanceData, store it in Redis with an expiration time
      await redisClient.setEx(
        cacheKey,
        900, // 15 minutes expiration
        JSON.stringify(performanceData)
      );

      return res.status(200).send({ status: 200, data: performanceData });
    } catch (err) {
      console.error("Error in getUserPerformance:", err);
      return res
        .status(500)
        .send({
          status: 500,
          data: { message: "Internal Server Error " + err },
        });
    }
  }
}
