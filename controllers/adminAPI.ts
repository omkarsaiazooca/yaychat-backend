import { Lottery, Ticket } from "../data/lottery";
import { SmartCrypto } from "../data/smartCrypto";
import { UserRoleTypes } from "../data/user";
import { AdminOperations } from "../platform/admin.operators";
import { AlchemyOperations } from "../platform/alchemy.operations";
import { DailyOperations } from "../platform/daily.operations";
import { MiningOperations } from "../platform/mining.operations";
import { OrderOperations } from "../platform/order.operations";
import { SellConfigOperations } from "../platform/sellConfig.operations";
import { UserOperations } from "../platform/user.operations";
import { CurrencyService } from "../services/currency.service";
import { LotteryService } from "../services/lottery.service";
import { SmartCryptoService } from "../services/smartCrypto.service";
import { UserService } from "../services/user.service";
import { NotificationTemplateService } from "../services/notificationTemplate.service";
import { AdminNotificationJobService } from "../services/adminNotificationJob.service";
import { notificationQueue } from "../index";

const currencyService: CurrencyService = new CurrencyService();
const userService: UserService = new UserService();
const lotteryService: LotteryService = new LotteryService();
const smartCryptoService: SmartCryptoService = new SmartCryptoService();
const notificationTemplateService: NotificationTemplateService = new NotificationTemplateService();
const adminNotificationJobService: AdminNotificationJobService = new AdminNotificationJobService();

export class AdminController {
  constructor() { }

  async updateIndexxCoinPrice(req: any, res: any) {
    try {
      let price = req.body.price;
      let coin = req.body.coin;
      let adminEmail = req.body.email;
      adminEmail = String(adminEmail).toLowerCase();

      let getUser = await userService.findOne({
        email: adminEmail,
      });
      if (getUser.role === UserRoleTypes.Admin) {
        let updateINEXprice = await currencyService.updateMany(
          {
            code: coin,
          },
          {
            buyPrice: price,
            buyPriceUpdatedOn: new Date(),
          }
        );
        let getLatestCoinPrice = await currencyService.findOne({
          code: coin,
        });
        res.status(200).json({
          status: 200,
          message: "Price updated successfully",
          data: getLatestCoinPrice,
        });
      } else {
        res.status(200).json({
          status: 404,
          message: "You are not authorized to update price",
          data: null,
        });
      }
    } catch (err) {
      console.log(err);
    }
  }

  async issueToken(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        !req.body.password ||
        req.body.email == undefined ||
        req.body.password == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.issueTokenAdmin(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllCaptains(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllCaptainsUsers(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllBTCYMiningUsersCount(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getMiningUsersCount(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBTCYNewUsersToday(req: any, res: any) {
    try {
      const dailyOps = new DailyOperations(req, res);
      let results = await dailyOps.getBTCYNewUsersToday(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBTCYNewUsersRange(req: any, res: any) {
    try {
      const dailyOps = new DailyOperations(req, res);
      let results = await dailyOps.getBTCYNewUsersRange(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getTotalBTCYMined(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getTotalBtcyMined(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBTCYMinedRange(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getBTCYMinedRange(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getBTCYMinedWindows(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getBTCYMinedWindows(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getCompletedBtcyBuyOrders(req: any, res: any) {
    try {
      const orderOps = new OrderOperations(req, res);
      const results = await orderOps.getCompletedBtcyBuyOrders(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAlchemyAdminConfig(req: any, res: any) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const results = await alchemyOps.getAdminConfig(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getAdminAlchemySessions(req: any, res: any) {
    try {
      const requesterEmail = String(req?.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized" },
        });
      }

      const requester = await userService.findOne({ email: requesterEmail });
      if (
        !requester ||
        (requester.role !== UserRoleTypes.Admin &&
          requester.role !== UserRoleTypes.SuperAdmin)
      ) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: admin access required" },
        });
      }

      const alchemyOps = new AlchemyOperations(req, res);
      const results = await alchemyOps.listAlchemySessionsForAdmin(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateAlchemyAdminConfig(req: any, res: any) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const results = await alchemyOps.updateAdminConfig(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getSellAdminConfig(req: any, res: any) {
    try {
      const sellConfigOps = new SellConfigOperations(req, res);
      const results = await sellConfigOps.getAdminConfig(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateSellAdminConfig(req: any, res: any) {
    try {
      const sellConfigOps = new SellConfigOperations(req, res);
      const results = await sellConfigOps.updateAdminConfig(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getActiveAndTotalMiningUsers(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getActiveAndTotalMiningUsers(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllMiiningUsers(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getAllMiiningUsers(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getMiningDetails(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      let results = await miningOps.getMiningDetails(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async downloadAllUserEmails(req: any, res: any) {
    try {
      const { format } = await import("fast-csv");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `all_users_emails_${timestamp}.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");

      const csvStream = format({ headers: ["email"] });
      csvStream.pipe(res);

      const cursor = (userService as any).repo._model
        .find({}, { email: 1, _id: 0 })
        .lean()
        .cursor({ batchSize: 2000 });

      let count = 0;
      await cursor.eachAsync(
        async (doc: any) => {
          const email = typeof doc?.email === "string" ? doc.email.trim().toLowerCase() : "";
          if (!email) return;
          csvStream.write({ email });
          count++;
        },
        { parallel: 1 }
      );

      csvStream.end();
      console.log(`[AdminExport] Exported ${count} user emails`);
    } catch (err: any) {
      console.error("downloadAllUserEmails error:", err);
      if (!res.headersSent) {
        res.status(500).json({ status: 500, data: { message: "Failed to export user emails" } });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async downloadAllBTCYMiningUsersEmails(req: any, res: any) {
    try {
      const miningOps = new MiningOperations();
      await miningOps.downloadAllBTCYMiningUsersEmails(req, res);
      return;
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async getAllUsers(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllUsersData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllAdminAuditLog(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllAdminAuditLogs(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getCaptainPowerpackData(req: any, res: any) {
    try {
      let { email } = req.params;
      if (!email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.getSpecificCaptainUserPowerpackData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllUsersWithdraws(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllUsersWithdrawRequests(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllUsersCryptoWithdraws(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllUsersCryptoWithdrawRequests(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllUsersFiatDeposits(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getAllUsersFiatDepositRequests(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editUserData(req: any, res: any) {
    try {
      if (!req.body.email || req.body.email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editUserData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editAffiliateData(req: any, res: any) {
    try {
      if (!req.body.email || req.body.email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editAffiliateData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editCommissionData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        req.body.email == undefined ||
        !req.body.id ||
        req.body.id == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editCommissionData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editStakingData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        req.body.email == undefined ||
        !req.body.id ||
        req.body.id == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editStakingData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editTransactionHistoryData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        req.body.email == undefined ||
        !req.body.id ||
        req.body.id == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editTransactionHistoryData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editOrderData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        req.body.email == undefined ||
        !req.body.id ||
        req.body.id == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editOrderData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editPowerPackData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        req.body.email == undefined ||
        !req.body.id ||
        req.body.id == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "badRequest" } });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.editPowerPackData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async addPowerPackData(req: any, res: any) {
    try {
      if (
        !req.body.email ||
        !req.body.date ||
        !req.body.powerPackType ||
        !req.body.inexBonus ||
        !req.body.powerPackPrice ||
        !req.body.paymentType ||
        req.body.addToWallet == null || // Assuming addToWallet can be false, which is falsy
        req.body.stakeInex == null || // Assuming stakeInex can be false, which is falsy
        req.body.totalInexBonus == null // Assuming totalInexBonus can be 0, which is falsy
      ) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      console.log(req.body);

      const userOps = new UserOperations(req, res);
      let results = await userOps.createPowerpackData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async addSmartCryptoPortfolio(req: any, res: any) {
    try {
      const {
        portfolioName,
        totalInvestment,
        cryptocurrencies,
        createdDate,
        description,
        title,
        subTitle,
        managedBy,
      } = req.body;

      // Validate the required fields
      if (
        !portfolioName ||
        !cryptocurrencies ||
        cryptocurrencies.length === 0 ||
        totalInvestment == null ||
        !createdDate
      ) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }

      // Normalize and prepare data
      const portfolioData = {
        portfolioName,
        totalInvestment,
        cryptocurrencies,
        createdDate: new Date(createdDate),
        description,
        title,
        subTitle,
        managedBy,
        isActive: true,
      } as SmartCrypto;

      // Save to the database (assuming a service `portfolioService`)
      const newPortfolio = await smartCryptoService.create(portfolioData);

      // Respond with success
      res.statusCode = 201;
      res.send({
        status: 201,
        data: {
          message: "Portfolio created successfully",
          portfolio: newPortfolio,
        },
      });
    } catch (err: any) {
      console.error("Error creating portfolio:", err);
      res.statusCode = 500;
      res.send({
        status: 500,
        data: { message: "Unhandled error: " + err.message },
      });
    }
  }

  async updateUserWallet(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.coin || !req.body.amount) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.updateUserWallet(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUsersKYCData(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getKYCData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getPaypalOrders(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getPaypalOrders(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getInvestmentRecords(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getInvestmentRecords(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async addNewInvestment(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.addNewInvestment(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async acceptCaptainBeeRequest(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.acceptCaptainBeeRequest(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getCaptainBeeRequests(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      let results = await userOps.getCaptainBeeRequest(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getMediumPosts(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.getMediumPost(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getMediumPostById(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.getMediumPostById(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async addNewMediumPosts(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.addNewMediumPost(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async editNewMediumPosts(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.updateMediumPost(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async sendPromotionEmail(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.sendPromotionEmail(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllProfitLogs(req: any, res: any) {
    try {
      const userOps = new AdminOperations(req, res);
      let results = await userOps.getProfitLogs(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllBtcySocialPostAirdropRegistrations(req: any, res: any) {
    try {
      const userOps = new UserOperations(req, res);
      const results = await userOps.allBtcySocialPostAirdropRegisterData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async downloadBtcySocialPostAirdropRegistrations(req: any, res: any) {
    try {
      const requesterEmail = String(req?.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized" },
        });
      }

      const requester = await userService.findOne({ email: requesterEmail });
      if (
        !requester ||
        (requester.role !== UserRoleTypes.Admin &&
          requester.role !== UserRoleTypes.SuperAdmin)
      ) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: admin access required" },
        });
      }

      const userOps = new UserOperations(req, res);
      await userOps.downloadBtcySocialPostAirdropRegistrations(req, res);
      return;
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async updateUserKYC(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.isKYCPass || !req.body.kycStatus) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.updateUserKYCData(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async inexCommissionPayout(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.inexAmount) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.inexCommissionPayout(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async honeyBeeInexCommissionPayout(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.inexAmount) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.honeyBeeInexCommissionPayout(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async usdCommissionPayout(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.usdAmount) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.usdCommissionPayout(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async honeyBeeUSDCommissionPayout(req: any, res: any) {
    try {
      if (!req.body.email || !req.body.usdAmount) {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "BadRequest: Missing or invalid fields" },
        });
        return;
      }
      const userOps = new UserOperations(req, res);
      let results = await userOps.honeyBeeUSDCommissionPayout(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async declareWinner0(req: any, res: any): Promise<any> {
    try {
      const { lotteryId } = req.body;
      const lottery = (await lotteryService.findOne({
        uniqueCode: lotteryId,
      })) as Lottery;
      if (!lottery || lottery.status !== "closed") {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: { message: "Lottery not found or not closed." },
        });
      }

      // Ensure there are enough tickets for the draw
      if (lottery.tickets.length < lottery.maximumWinners) {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: { message: "Not enough tickets for the draw." },
        });
      }

      const adminOps: AdminOperations = new AdminOperations(req, res);
      // Randomly select winning tickets
      let winningTickets = [];
      let indices = new Set<number>(); // To keep track of unique indices
      while (
        winningTickets.length < lottery.maximumWinners &&
        indices.size < lottery.tickets.length
      ) {
        const index = Math.floor(Math.random() * lottery.tickets.length);
        if (!indices.has(index)) {
          indices.add(index);
          winningTickets.push(lottery.tickets[index]);
        }
      }

      // Process each winning ticket
      let winnerEmails = winningTickets.map((ticket) => ticket.email);
      for (let index = 0; index < winningTickets.length; index++) {
        await adminOps.processLotteryWinner(
          req,
          res,
          lottery,
          winningTickets[index],
          index + 1
        );
      }

      await lotteryService.updatePart(
        { uniqueCode: lotteryId },
        {
          $set: {
            status: "completed",
            // Update with appropriate winning ticket information
            winningTicket: winningTickets.map((ticket) =>
              ticket.ticketNumbers.map((tn) => tn.ticketNumbers)
            ),
          },
        }
      );

      let data = {
        winningTickets: winningTickets,
        message: "Winners declared and lottery completed now",
        winnerEmails: winnerEmails,
      };

      res.statusCode = 200;
      res.send({ status: 200, data: data });
      return;
    } catch (error: any) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async declareWinner02(req: any, res: any): Promise<any> {
    try {
      const { lotteryId } = req.body;
      const lottery = await lotteryService.findOne({ uniqueCode: lotteryId });

      if (!lottery) {
        return res
          .status(400)
          .json({ message: "Lottery not found or not closed." });
      }

      if (lottery.tickets.length < lottery.maximumWinners) {
        return res
          .status(400)
          .json({ message: "Not enough tickets for the draw." });
      }

      // Step 1: Randomly select winning tickets indices
      let winningIndices = new Set<number>();
      while (winningIndices.size < lottery.maximumWinners) {
        const index = Math.floor(Math.random() * lottery.tickets.length);
        winningIndices.add(index);
      }

      // Step 2: Mark the selected tickets as winners
      const updatedTickets = lottery.tickets.map((ticket, index) => {
        if (winningIndices.has(index)) {
          return { ...ticket, isWinningTicket: true };
        }
        return ticket;
      });

      // Assuming AdminOperations class has methods to process each winning ticket
      const adminOps: AdminOperations = new AdminOperations(req, res);
      const winnerEmails = Array.from(winningIndices).map(
        (index) => lottery.tickets[index].email
      );
      for (let index of winningIndices) {
        await adminOps.processLotteryWinner(
          req,
          res,
          lottery,
          updatedTickets[index],
          index + 1
        );
      }

      // Update the lottery document with the updated tickets array
      await lotteryService.updatePart(
        { uniqueCode: lotteryId },
        {
          $set: {
            tickets: updatedTickets,
            status: "completed",
          },
        }
      );

      res.json({
        message: "Winners declared and lottery completed.",
        winningTickets: winnerEmails,
      });
    } catch (error: any) {
      console.error(error); // Log the detailed error for debugging
      res.status(500).json({ message: "Unhandled error: " + error.message });
    }
  }

  async declareWinner(req: any, res: any): Promise<any> {
    try {
      const { lotteryId } = req.body;
      const lottery = await lotteryService.findOne({ uniqueCode: lotteryId });

      if (!lottery) {
        return res
          .status(400)
          .json({ message: "Lottery not found or not closed." });
      }

      // Flatten the ticketNumbers from all tickets
      let allTicketNumbers = lottery.tickets.flatMap((ticket) =>
        ticket.ticketNumbers.map((ticketNumber) => ({
          ...ticketNumber,
          email: ticket.email, // Assume you need the ticket owner's email
        }))
      );

      if (allTicketNumbers.length < lottery.maximumWinners) {
        return res
          .status(400)
          .json({ message: "Not enough tickets for the draw." });
      }

      // Step 1: Randomly select winning ticket numbers indices
      let winningIndices = new Set<number>();
      while (winningIndices.size < lottery.maximumWinners) {
        const index = Math.floor(Math.random() * allTicketNumbers.length);
        winningIndices.add(index);
      }

      // Mark the selected ticket numbers as winners and gather emails
      const winnerEmails = new Set<string>();
      winningIndices.forEach((index) => {
        allTicketNumbers[index].isWinningTicket = true;
        winnerEmails.add(allTicketNumbers[index].email);
      });

      console.log("winningIndices", winningIndices);
      // Assuming AdminOperations class has methods to process each winning ticket
      const adminOps: AdminOperations = new AdminOperations(req, res);
      for (let index of winningIndices) {
        const winnerTicketNumber = allTicketNumbers[index];
        await adminOps.processLotteryWinner(
          req,
          res,
          lottery,
          winnerTicketNumber,
          index + 1 // position might not be needed or could be adjusted based on your logic
        );
      }

      // Update the lottery document with the updated tickets array
      // Note: You may need to adjust this logic to properly reflect the nested structure of winning tickets
      await lotteryService.updatePart(
        { uniqueCode: lotteryId },
        {
          $set: {
            // This update logic might need adjustment to accurately reflect your database schema
            tickets: lottery.tickets, // Assuming you adjust tickets in processLotteryWinner or elsewhere
            status: "completed",
          },
        }
      );

      res.json({
        message: "Winners declared and lottery completed.",
        winningEmails: Array.from(winnerEmails), // Returning emails of winners
      });
    } catch (error: any) {
      console.error(error); // Log the detailed error for debugging
      res.status(500).json({ message: "Unhandled error: " + error.message });
    }
  }

  async startLottery(req: any, res: any) {
    try {
      const lotteryData = req.body;

      let getLotteryByUniqueCode = await lotteryService.findOne({
        uniqueCode: lotteryData.uniqueCode,
      });

      if (getLotteryByUniqueCode) {
        return res
          .status(400)
          .json({ message: "This Unique Code is already taken" });
      }

      const createLottery = {
        name: lotteryData.name,
        type: lotteryData.type, // Assuming this is also a crypto lottery
        uniqueCode: lotteryData.uniqueCode,
        coinName: "IUSD+", // Assuming the coin name
        assetType: lotteryData.type,
        status: lotteryData.status,
        price: Number(lotteryData.price),
        maximumWinners: lotteryData.maximumWinners,
        prizePool: lotteryData.prizePool, // Example for multiple winners
        tickets: [],
        images: lotteryData.images,
        winningTicket: [], // Adjusted to be an array
        drawDate: lotteryData.drawDate,
        openDate: lotteryData.openDate,
        closeDate: lotteryData.closeDate,
        openedAdminEmail: lotteryData.openedAdminEmail,
        createdBy: "admin",
        updatedBy: "admin",
        winners: [],
        participantsCount: 0,
        description: "",
      } as Lottery;
      const newLottery = await lotteryService.create(createLottery);
      let result = {
        message: "Lottery started successfully",
        data: newLottery,
      };
      res.statusCode = 200;
      res.send(result);
      return;
    } catch (error: any) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  async closeLotteryByAdmin(req: any, res: any) {
    try {
      const { lotteryId } = req.body;
      const lottery = (await lotteryService.findOne({
        uniqueCode: lotteryId,
      })) as Lottery;

      if (!lottery) {
        res.statusCode = 500;
        res.send({
          status: 500,
          data: { message: "Lottery not found or not closed." },
        });
      }
      console.log("lottery", lottery);
      const closedLottery = await lotteryService.updatePart(
        {
          uniqueCode: lotteryId,
        },
        {
          $set: {
            status: "closed",
          },
        }
      );
      let result = {
        message: "Lottery closed successfully",
        data: closedLottery,
      };
      res.statusCode = 200;
      res.send(result);
      return;
    } catch (error: any) {
      console.log("error in close lottery", error);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + error } });
    }
  }

  // Admin notification methods
  async getAdminNotificationTemplates(req: any, res: any) {
    try {
      const restrictedTypes = [""];
      const templates = await notificationTemplateService.getAdminTemplates(restrictedTypes);

      res.json({
        success: true,
        data: templates,
        restrictedTypes
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async sendAdminNotification(req: any, res: any) {
    try {
      const { title, body, imageUrl, emails, sendToAll, type } = req.body;
      const adminEmail = req.user.email;

      // get user by email
      const user = await userService.findOne({ email: adminEmail });
      if (!user) {
        return res.status(400).json({ success: false, error: 'User not found' });
      }

      if (user.role !== "Admin") {
        return res.status(400).json({ success: false, error: 'User is not an admin' });
      }

      if (!title || !body) {
        return res.status(400).json({ success: false, error: 'Title and body are required' });
      }

      const job = await adminNotificationJobService.createJob({
        title,
        body,
        imageUrl: imageUrl || "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png",
        emails: emails || [],
        sendToAll: sendToAll || false,
        type: type || 'admin_announcement',
        adminEmail,
        totalRecipients: sendToAll ? 0 : emails?.length || 0
      });

      // Add job to queue
      await notificationQueue.add('send-admin-notification', {
        jobId: job.jobId,
        notificationData: { title, body, imageUrl, type },
        emails,
        sendToAll
      });

      res.json({
        success: true,
        jobId: job.jobId,
        message: 'Notification job created successfully',
        totalRecipients: job.totalRecipients,
        estimatedTime: '2-3 minutes'
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getNotificationJobStatus(req: any, res: any) {
    try {
      const { jobId } = req.params;
      const job = await adminNotificationJobService.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      res.json({
        success: true,
        data: {
          jobId: job.jobId,
          title: job.title,
          status: job.status,
          progress: {
            totalRecipients: job.totalRecipients,
            processedCount: job.processedCount,
            successCount: job.successCount,
            failedCount: job.failedCount,
            percentage: job.totalRecipients > 0 ? Math.round((job.processedCount / job.totalRecipients) * 100) : 0
          },
          errors: job.errorMessages,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getNotificationJobHistory(req: any, res: any) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { jobs, total } = await adminNotificationJobService.getJobHistory(Number(page), Number(limit));

      res.json({
        success: true,
        data: jobs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
