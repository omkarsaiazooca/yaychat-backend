import axios from "axios";
import { Request, Response } from "express";
import { createClient } from "redis";
import { sorektPriceData } from "../helpers/sorekt.pricedata";
import {
  adjustForNonWorkingDays,
  isHoliday,
  isWeekend,
} from "../helpers/twelveDataLatestPrice";
import { AppSettingsService } from "../services/appSettings.service";
import { decryptData } from "../services/crypto.service";
import { CurrencyService } from "../services/currency.service";
import { UserOperations } from "../platform/user.operations";
import { LotteryService } from "../services/lottery.service";
import { Lottery } from "../data/lottery";
import { addFakeTicketsToLottery } from "../helpers/lottery";
import mongo, { ensureMongoConnected } from "../db/connection";
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});
const moment = require("moment");
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { OrderService } from "../services/order.service";
import { SendEmail } from "../platform/email.operations";
import { AirdropContentService } from "../services/airdropContent.service";
import { AirdropCampaignService } from "../services/airdropCampaign.service";
import { TutorialWatchService } from "../services/tutorialWatch.service";
import { MiningService } from "../services/mining.service";
import { BtcyLoyaltyAirdrop2026Service } from "../services/btcyLoyaltyAirdrop2026.service";
import { UserService } from "../services/user.service";

const currencyService: CurrencyService = new CurrencyService();
const appSettingsService: AppSettingsService = new AppSettingsService();
const lotteryService: LotteryService = new LotteryService();
const airdropCampaignService: AirdropCampaignService =
  new AirdropCampaignService();
const tutorialWatchService: TutorialWatchService = new TutorialWatchService();
const miningService: MiningService = new MiningService();
const btcyLoyaltyAirdrop2026Service: BtcyLoyaltyAirdrop2026Service =
  new BtcyLoyaltyAirdrop2026Service();
const userService: UserService = new UserService();
const DEFAULT_TUTORIAL_APP = "BTCY";
const PLAN_TUTORIAL_APP = "BTCY_PLAN";

type MongoHealthStatus = "healthy" | "degraded" | "unavailable";

const mongoStateLabels: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const mongoStatusPriority: Record<MongoHealthStatus, number> = {
  healthy: 0,
  degraded: 1,
  unavailable: 2,
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export class BasicController {
  constructor() {
    this.getTutorialStatus = this.getTutorialStatus.bind(this);
    this.getPlanTutorialStatus = this.getPlanTutorialStatus.bind(this);
    this.getTutorialStatusBoth = this.getTutorialStatusBoth.bind(this);
    this.upsertTutorialStatus = this.upsertTutorialStatus.bind(this);
    this.upsertPlanTutorialStatus = this.upsertPlanTutorialStatus.bind(this);
  }

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

  async btcyAppSettings(req: Request, res: Response) {
    try {
      const settings = await appSettingsService.btcyAppSettings();
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

  async getMongoHealthStatus(req: Request, res: Response) {
    const connection = mongo?.primary?.connection;
    const initialReadyState = connection?.readyState ?? 0;
    const payload = {
      timestamp: new Date().toISOString(),
      status: "healthy" as MongoHealthStatus,
      message: "MongoDB is healthy",
      assetDataReliable: true,
      mongo: {
        state: mongoStateLabels[initialReadyState] ?? "unknown",
        readyState: initialReadyState,
        connected: initialReadyState === 1,
        busy: false,
        backupInProgress: false,
        latencyMs: null as number | null,
        queuedOperations: null as number | null,
        issues: [] as string[],
      },
    };

    const updateStatus = (nextStatus: MongoHealthStatus, message?: string) => {
      const currentPriority = mongoStatusPriority[payload.status];
      const nextPriority = mongoStatusPriority[nextStatus];
      if (nextPriority > currentPriority) {
        payload.status = nextStatus;
        if (message) {
          payload.message = message;
        }
      } else if (message && nextPriority === currentPriority) {
        payload.message = message;
      }
    };

    const finalize = () => {
      payload.assetDataReliable = payload.status === "healthy";
      if (!payload.message) {
        if (payload.status === "healthy") {
          payload.message = "MongoDB is healthy";
        } else if (payload.status === "degraded") {
          payload.message =
            "MongoDB is responding but currently busy; displayed asset values may lag.";
        } else {
          payload.message =
            "MongoDB is unavailable; data resources are offline and asset values are unreliable.";
        }
      }
      const httpStatus = payload.status === "healthy" ? 200 : 503;
      return res.status(httpStatus).json(payload);
    };

    if (!connection) {
      updateStatus(
        "unavailable",
        "MongoDB connection handle has not been initialized."
      );
      payload.mongo.issues.push("mongo.primary.connection is undefined");
      return finalize();
    }

    try {
      const connected = await ensureMongoConnected();
      if (!connected) {
        updateStatus("unavailable", "MongoDB is not connected.");
        payload.mongo.issues.push("ensureMongoConnected returned false");
        payload.mongo.connected = false;
        payload.mongo.state =
          mongoStateLabels[connection.readyState] ?? payload.mongo.state;
        payload.mongo.readyState = connection.readyState;
        return finalize();
      }
    } catch (error) {
      updateStatus("unavailable", "Failed to verify MongoDB connectivity.");
      payload.mongo.issues.push(
        error instanceof Error ? error.message : String(error)
      );
      return finalize();
    }

    const refreshedReadyState = connection.readyState;
    payload.mongo.state =
      mongoStateLabels[refreshedReadyState] ?? payload.mongo.state;
    payload.mongo.readyState = refreshedReadyState;
    payload.mongo.connected = refreshedReadyState === 1;

    if (!payload.mongo.connected) {
      updateStatus(
        "unavailable",
        `MongoDB is ${payload.mongo.state}.`
      );
      payload.mongo.issues.push(`Ready state: ${refreshedReadyState}`);
      return finalize();
    }

    const adminDb = connection.db?.admin();
    if (!adminDb) {
      updateStatus(
        "unavailable",
        "Unable to access MongoDB admin commands."
      );
      payload.mongo.issues.push("connection.db.admin() returned undefined");
      return finalize();
    }

    try {
      const pingStart = Date.now();
      await withTimeout(adminDb.command({ ping: 1 }), 2000);
      payload.mongo.latencyMs = Date.now() - pingStart;
      if ((payload.mongo.latencyMs ?? 0) > 800) {
        payload.mongo.busy = true;
        updateStatus("degraded", "MongoDB ping latency is elevated.");
        payload.mongo.issues.push(
          `Ping latency ${payload.mongo.latencyMs}ms`
        );
      }
    } catch (error) {
      payload.mongo.busy = true;
      updateStatus("unavailable", "MongoDB ping failed.");
      payload.mongo.issues.push(
        error instanceof Error ? error.message : String(error)
      );
      return finalize();
    }

    try {
      const serverStatus: any = await withTimeout(
        adminDb.command({ serverStatus: 1 }),
        2500
      );
      const backupInProgress = Boolean(
        serverStatus?.storageEngine?.backupInProgress ||
          serverStatus?.fsyncLocked ||
          serverStatus?.lockInfo?.fsyncLock
      );
      const queuedOperations = Number(
        serverStatus?.globalLock?.queue?.total ?? 0
      );
      payload.mongo.backupInProgress = backupInProgress;
      payload.mongo.queuedOperations = queuedOperations;

      if (backupInProgress) {
        updateStatus(
          "degraded",
          "MongoDB reports a backup or fsync lock in progress."
        );
        payload.mongo.issues.push("backupInProgress/fsync lock detected");
      }

      if (queuedOperations > 100) {
        payload.mongo.busy = true;
        updateStatus(
          "degraded",
          "MongoDB has a high number of queued operations."
        );
        payload.mongo.issues.push(`Queued operations: ${queuedOperations}`);
      }
    } catch (error) {
      payload.mongo.issues.push(
        `Unable to read serverStatus: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      updateStatus(
        "degraded",
        "MongoDB responded but server metrics were unavailable."
      );
    }

    if (payload.status === "healthy" && payload.mongo.busy) {
      updateStatus(
        "degraded",
        "MongoDB is healthy but currently under heavy load."
      );
    }

    return finalize();
  }

  async orderMinMax(req: Request, res: Response) {
    try {
      console.log("code", req.body.currency);
      console.log("code", req.body.orderType);
      let currency = req.body.currency;
      if (req.body.currency === "APPL") {
        currency = "AAPL";
      }
      const settings = await currencyService.findOne({
        code: currency,
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

  async indexxBlogs(req: Request, res: Response) {
    try {
      const settings = await appSettingsService.getSettingsBykey("MediumPost");
      const data = JSON.parse(settings.data.description);
      if (settings) {
        return res.status(200).json(data);
      } else {
        return res.status(500).json({} as any);
      }
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async soRektPriceData(req: Request, res: Response) {
    try {
      return res.status(200).json({ prices: sorektPriceData.prices });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async decryptoPrivateKey(req: Request, res: Response) {
    try {
      let { privateKey } = req.body;
      let decryptPrivateKey = await decryptData(privateKey);
      return res.status(200).json({ prices: "1e" + decryptPrivateKey + "da" });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async stockData(req: Request, res: Response) {
    let { interval, symbol } = req.query;

    // Calculate start and end dates based on interval
    let startDate: any, endDate: any, dataInterval: string;
    console.log(redisClient.isOpen, "conn");
    // Establish a connection
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    if (symbol === "SNP500") {
      symbol = "SPX";
    }

    let currentDate = moment();
    if ((await isHoliday(currentDate)) || isWeekend(currentDate)) {
      currentDate = await adjustForNonWorkingDays(currentDate);
    }

    switch (interval) {
      case "1hour":
        dataInterval = "1min";

        // Adjust for weekend or holidays
        if ((await isHoliday(currentDate)) || isWeekend(currentDate)) {
          currentDate = moment(currentDate).day(5).hour(16); // Set to Friday, 4:00 PM
        }

        // Adjust if time is outside market operating hours
        if (
          currentDate.hour() < 9 ||
          (currentDate.hour() === 9 && currentDate.minute() < 30)
        ) {
          currentDate.subtract(1, "days").hour(16); // Set to the end of the trading hours of the previous trading day
        } else if (
          currentDate.hour() > 16 ||
          (currentDate.hour() === 16 && currentDate.minute() > 0)
        ) {
          currentDate.hour(16); // Set to 4:00 PM of the current trading day
        }

        endDate = currentDate.format("YYYY-MM-DD HH:mm:ss");
        startDate = currentDate
          .clone()
          .subtract(1, "hours")
          .format("YYYY-MM-DD HH:mm:ss");

        console.log("start date:", startDate);
        console.log("end date:", endDate);
        break;

      case "1day":
        dataInterval = "1min";

        // Adjust for weekend or holidays
        if ((await isHoliday(currentDate)) || isWeekend(currentDate)) {
          currentDate = moment(currentDate).day(5); // Set to Friday
        }

        // Adjust if time is before the market's opening hours
        if (
          currentDate.hour() < 9 ||
          (currentDate.hour() === 9 && currentDate.minute() < 30)
        ) {
          currentDate.subtract(1, "days"); // Set to the previous trading day
        }

        endDate = currentDate.format("YYYY-MM-DD") + " 16:00:00"; // End of the trading day
        startDate = currentDate.format("YYYY-MM-DD") + " 09:30:00"; // Start of the trading day

        console.log("start date:", startDate);
        console.log("end date:", endDate);
        break;
      case "1week":
        dataInterval = "4h";
        startDate = moment().subtract(7, "days").format("YYYY-MM-DD HH:mm:ss");
        endDate = moment().format("YYYY-MM-DD HH:mm:ss");
        break;
      case "1month":
        dataInterval = "1day";
        startDate = moment()
          .subtract(1, "months")
          .format("YYYY-MM-DD HH:mm:ss");
        endDate = moment().format("YYYY-MM-DD HH:mm:ss");
        break;
      case "1year":
        dataInterval = "1month";
        startDate = moment().subtract(1, "years").format("YYYY-MM-DD HH:mm:ss");
        endDate = moment().format("YYYY-MM-DD HH:mm:ss");
        break;
      default:
        return res.status(400).json({ error: "Invalid interval specified." });
    }
    // Create a unique Redis key based on the interval and symbol
    const redisKey = `stockData:${symbol}:${interval}`;
    console.log(startDate);
    console.log(endDate);
    let cachedResult = await redisClient.get(redisKey);
    if (cachedResult !== null) {
      // if (redisClient.isOpen) {
      //   await redisClient.quit();
      // }
      res.status(200).json(JSON.parse(cachedResult));
      return;
    }

    // Otherwise, fetch data from the API
    try {
      const response = await axios.get(
        "https://api.twelvedata.com/time_series",
        {
          params: {
            apikey: process.env.TWELVE_DATA_API_KEY,
            interval: dataInterval,
            symbol,
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      if (response.data) {
        // Store the data in Redis for future requests
        redisClient.set(redisKey, JSON.stringify(response.data));
        redisClient.expire(redisKey, 86400);
        // if (redisClient.isOpen) {
        //   await redisClient.quit();
        // }

        res.json(response.data);
      } else {
        // if (redisClient.isOpen) {
        //   await redisClient.quit();
        // }
        res.status(400).json({ error: "Failed to retrieve stock data." });
      }
    } catch (error) {
      // if (redisClient.isOpen) {
      //   await redisClient.quit();
      // }
      console.error("Error fetching data from API:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }

  async airdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.airDropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async wallstreetInexAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.wallstreetInexAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async bitcoinAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.bitcoinAirDropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async whoIsBitcoinSatoshiAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.whoIsBitcoinSatoshiAirDropRegister(
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

  async whoIsBitcoinSatoshiAirdrop27MayRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.whoIsBitcoinSatoshiAirDropRegisterMay27(
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

  async whoIsBitcoinSatoshiAirdrop16JunRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.whoIsBitcoinSatoshiAirDropRegisterJun16(
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

  async dacrazyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.dacrazyAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }


  async btcyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.btcyAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async btcyNewYear2026AirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.btcyNewYear2026AirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async btcyLoyaltyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.btcyLoyaltyAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async btcySocialPostAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      const dataResults = await userOps.btcySocialPostAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }


  async getbtcyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allBtcyAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  
  async getbtcyLoyaltyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allBtcyLoyaltyAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getbtcyNewYear2026AirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allBtcyNewYear2026AirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getbtcy4thJlyAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allBtcy4thJlyAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getbtcyLottoAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getbtcyLottoAirdropRegister(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getWIBSAirdropRegister(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allWIBSAirdropSep29RegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getActiveAirdropStatus(req: Request, res: Response) {
    try {
      const activeCampaign = await airdropCampaignService.findActive();
      if (!activeCampaign) {
        return res.status(200).json({
          status: 200,
          data: {
            active: false,
            name: "",
            title: "",
          },
        });
      }
      return res.status(200).json({
        status: 200,
        data: {
          active: Boolean(activeCampaign.active),
          name: activeCampaign.name || "",
          title: activeCampaign.title || "",
        },
      });
    } catch (err: any) {
      res.status(500).json({
        status: 500,
        data: { message: "Failed to fetch airdrop status", error: err.message },
      });
    }
  }

  async getTutorialStatus(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "").trim();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const app = String(req.query.app || DEFAULT_TUTORIAL_APP).trim();
      const data = await this.fetchTutorialStatus(email, app);
      return res.status(200).json({ status: 200, data });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to fetch tutorial status", error: err.message },
      });
    }
  }

  async getPlanTutorialStatus(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "").trim();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const data = await this.fetchTutorialStatus(email, PLAN_TUTORIAL_APP);
      return res.status(200).json({ status: 200, data });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to fetch plan tutorial status", error: err.message },
      });
    }
  }

  async getTutorialStatusBoth(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "").trim();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const [main, plan] = await Promise.all([
        this.fetchTutorialStatus(email, DEFAULT_TUTORIAL_APP),
        this.fetchTutorialStatus(email, PLAN_TUTORIAL_APP),
      ]);

      return res.status(200).json({
        status: 200,
        data: {
          email,
          main,
          plan,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to fetch tutorial statuses", error: err.message },
      });
    }
  }

  async getBtcyLoyaltyAirdropStatus(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const tokenName = "BTCY";
      const eventType = "BTCYLoyaltyAirdrop2026";
      const existing =
        await btcyLoyaltyAirdrop2026Service.isAirDropUserExistByEmailAndEvent(
          email,
          tokenName,
          eventType
        );

      return res.status(200).json({
        status: 200,
        data: {
          email,
          participated: existing ? "yes" : "no",
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: {
          message: "Failed to check BTCY Loyalty Airdrop status",
          error: err.message,
        },
      });
    }
  }

  async upsertTutorialStatus(req: Request, res: Response) {
    try {
      const email = String(req.body.email || "").trim();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const app = String(req.body.app || DEFAULT_TUTORIAL_APP).trim();
      const watched = Boolean(req.body.watched ?? true);
      const watchedAt = watched ? new Date() : null;
      const emailLower = email.toLowerCase();

      if (watched && app === DEFAULT_TUTORIAL_APP) {
        const miningData = await miningService.getMiningData(
          emailLower,
          "BTCY"
        );
        // if (miningData?.isMiningActive) {
        //   return res.status(409).json({
        //     status: 409,
        //     data: {
        //       message:
        //         "Mining cycle active. Please wait unit mining cycle has concluded to rewatch tutorial",
        //     },
        //   });
        // }
      }

      const updated = await tutorialWatchService.upsertOneAndGet(
        { emailLower, app },
        {
          $set: {
            email,
            emailLower,
            app,
            watched,
            watchedAt,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        }
      );

      if (watched && app === DEFAULT_TUTORIAL_APP) {
        try {
          await userService.updatePart(
            { email: emailLower },
            { $set: { tutorialWatched: true } }
          );
        } catch (e) {
          console.error("upsertTutorialStatus -> tutorialWatched update failed (ignored):", e);
        }
      }

      return res.status(200).json({
        status: 200,
        data: this.formatTutorialStatus(updated, email, app),
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to update tutorial status", error: err.message },
      });
    }
  }

  async upsertPlanTutorialStatus(req: Request, res: Response) {
    try {
      const email = String(req.body.email || "").trim();
      if (!email) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const watched = Boolean(req.body.watched ?? true);
      const watchedAt = watched ? new Date() : null;
      const emailLower = email.toLowerCase();
      const app = PLAN_TUTORIAL_APP;

      const updated = await tutorialWatchService.upsertOneAndGet(
        { emailLower, app },
        {
          $set: {
            email,
            emailLower,
            app,
            watched,
            watchedAt,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        }
      );

      return res.status(200).json({
        status: 200,
        data: this.formatTutorialStatus(updated, email, app),
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to update plan tutorial status", error: err.message },
      });
    }
  }

  private formatTutorialStatus(existing: any, fallbackEmail: string, app: string) {
    if (!existing) {
      return {
        email: fallbackEmail,
        app,
        watched: false,
        watchedAt: null,
      };
    }

    return {
      email: existing.email || fallbackEmail,
      app: existing.app || app,
      watched: Boolean(existing.watched),
      watchedAt: existing.watchedAt || null,
    };
  }

  private async fetchTutorialStatus(email: string, app: string) {
    const emailLower = email.toLowerCase();
    const existing = await tutorialWatchService.findOne({
      emailLower,
      app,
    });

    return this.formatTutorialStatus(existing, email, app);
  }

  async upsertAirdropCampaign(req: Request, res: Response) {
    try {
      const payload = {
        name: String(req.body.name || "").trim(),
        title: req.body.title ? String(req.body.title).trim() : "",
        imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : "",
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        active: Boolean(req.body.active),
        body: req.body.body ? String(req.body.body).trim() : "",
        termsUrl: req.body.termsUrl ? String(req.body.termsUrl).trim() : "",
        ctaText: req.body.ctaText ? String(req.body.ctaText).trim() : "",
        ctaUrl: req.body.ctaUrl ? String(req.body.ctaUrl).trim() : "",
        updatedAt: new Date(),
      };

      if (!payload.name) {
        return res
          .status(400)
          .json({ status: 400, data: { message: "name is required" } });
      }

      if (req.body._id) {
        const updated = await airdropCampaignService.updatePart(
          { _id: req.body._id },
          { $set: payload }
        );
        return res.status(200).json({
          status: 200,
          data: updated,
        });
      }

      const created = await airdropCampaignService.create({
        ...payload,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: created,
      });
    } catch (err: any) {
      res.status(500).json({
        status: 500,
        data: { message: "Failed to save airdrop campaign", error: err.message },
      });
    }
  }

  async getAirdropCampaign(req: Request, res: Response) {
    try {
      const name = String(req.query.name || "").trim();
      if (name) {
        const campaign = await airdropCampaignService.findOne({ name });
        return res.status(200).json({ status: 200, data: campaign || null });
      }

      const activeCampaign = await airdropCampaignService.findActive();
      return res.status(200).json({ status: 200, data: activeCampaign || null });
    } catch (err: any) {
      res.status(500).json({
        status: 500,
        data: { message: "Failed to fetch airdrop campaign", error: err.message },
      });
    }
  }

  async emailSubscription(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.emailSubscription(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async contactUs(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.contactUs(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async academyConfirmEmail(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.academyConfirmationEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async academyInstructorRequest(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.sendAcademyInstructorRequest(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async academyContactUs(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.sendAcademyContactFormEmail(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getSmartCryptoPackages(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getAllSmartCryptoPackages(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getSpecificSmartCryptoPackage(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.getSpecificSmartCryptoPackage(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateSpecificSmartCryptoPackage(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.updateSpecificSmartCryptoPackage(
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

  async allAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async allBitcoinAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allBitcoinAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async allWIBSAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allWIBSAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async allMayWIBSAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allMayWIBSAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async allJunWIBSAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allJunWIBSAirdropRegisterData(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async allDacrazyAirdropRegisterUsers(req: Request, res: Response) {
    try {
      const userOps = new UserOperations(req, res);
      let dataResults = await userOps.allDacrazyAirdropRegisterUsers(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllLotteryDetails(req: Request, res: Response) {
    try {
      let dataResults = await lotteryService.find({});

      const updatedLotteries = dataResults.map((lottery: Lottery): Lottery => {
        if (lottery.coinName === "BTCY") {
          // Skip adding fake tickets for BTCY
          return lottery;
        }

        // if (lottery.maximumTickets || lottery.participantsCount) {
        //   return addFakeTicketsToLottery(lottery);
        // }
        return lottery;
      });

      res.statusCode = 200;
      res.send(updatedLotteries);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getLotteryDetailsById(req: Request, res: Response) {
    try {
      const { lotteryId } = req.params;
      if (!lotteryId) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      let dataResults = await lotteryService.findOne({
        uniqueCode: lotteryId,
      });
      res.statusCode = 200;
      res.send(dataResults);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getS3PresignedUrl(req: Request, res: Response) {
    try {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        },
      });

      console.log(req.query)
      // Safely handle fileType parameter
      const rawFileType = req.query.fileType;
      const isMarketingEmailImage = req.query.folder === "email-marketing";
      const marketingImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
      if (
        isMarketingEmailImage &&
        (typeof rawFileType !== "string" || !marketingImageTypes.has(rawFileType.toLowerCase()))
      ) {
        res.status(400).json({
          status: 400,
          message: "Only JPG, PNG, GIF, and WebP marketing email images are supported.",
        });
        return;
      }
      let fileExtension = 'bin';

      if (typeof rawFileType === 'string') {
        const parts = rawFileType.split('/');
        if (parts.length > 1) {
          fileExtension = parts[1];
        }
      }

      const uploadPrefix = isMarketingEmailImage
        ? "indexx-exchange/email-marketing"
        : "uploads";
      const fileKey = `${uploadPrefix}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

      const preSignedUrl = await createPresignedPost(s3, {
        Bucket: process.env.AWS_BUCKET_NAME as string,
        Key: fileKey,
        Expires: 3600, // 1 hour expiration
        Conditions: [
          ["content-length-range", 0, isMarketingEmailImage ? 10485760 : 5368709120],
          ["starts-with", "$Content-Type", ""], // Allow any content type
        ],
      });

      res.status(200).json({
        status: 200,
        data: {
          url: preSignedUrl.url,
          fields: {
            ...preSignedUrl.fields,
            key: fileKey,
            'Content-Type': typeof rawFileType === 'string' ? rawFileType : 'application/octet-stream'
          }
        }
      });
    } catch (err) {
      console.error("Error generating presigned URL:", err);
      res.status(500).json({
        status: 500,
        message: "Failed to generate presigned URL",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  async getS3PresignedUrlForMobile(req: Request, res: Response) {
    try {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        },
      });

      // Safely handle fileType with type checking
      const rawFileType = req.query.fileType;
      console.log("rawFileType", rawFileType)
      let fileType = 'application/octet-stream';
      let fileExtension = 'bin';

      if (typeof rawFileType === 'string') {
        fileType = rawFileType;
        const typeParts = rawFileType.split('/');
        if (typeParts.length > 1) {
          fileExtension = typeParts[1];
        }
      }

      const fileKey = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME as string,
        Key: fileKey,
        ContentType: fileType,
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      res.status(200).json({
        status: 200,
        data: {
          url,
          key: fileKey,
          contentType: fileType
        }
      });
    } catch (err) {
      console.error("Error generating presigned URL:", err);
      res.status(500).json({
        status: 500,
        message: "Failed to generate presigned URL",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  async resendOrderEmail(req: any, res: any) {
    try {
      const orderId = req.body.orderId;

      if (!orderId) {
        res.statusCode = 400;
        return res.send({ status: 400, message: "Order ID is required" });
      }

      const orderService = new OrderService();
      const userOrder = await orderService.findOne({ orderId: orderId });

      if (!userOrder) {
        res.statusCode = 404;
        return res.send({ status: 404, message: "Order not found" });
      }

      console.log("Order details:", JSON.stringify({
        orderType: userOrder.orderType,
        rate: userOrder.orderRate?.rate,
        inAmount: userOrder.breakdown?.inAmount,
        exchangeFees: userOrder.exchangeFees
      }));

      // Determine the type of order and send the appropriate email
      const emailSender = new SendEmail();

      if (userOrder.orderType === "SmartAPY") {
        await emailSender.sendUSDToIUSDOrderCompleted(
          userOrder.user.email,
          userOrder.user.firstName || "User",
          userOrder.breakdown.outAmount || 0,
          String(userOrder.smartAPYduration || ""),
          userOrder.orderRate?.rate || 0,
          userOrder.breakdown.inAmount || 0,
          { APY: userOrder.smartAPYPercentage || 0 },
          userOrder.orderId
        );
      } else {
        // Calculate the amount in USD safely
        const inAmount = userOrder.breakdown?.inAmount || 0;
        const exchangeFees = Number(userOrder?.exchangeFees || 0);
        const amountInUSD = inAmount - (inAmount * exchangeFees) / 100;

        await emailSender.sendOrderCompleted(
          userOrder.user.email,
          userOrder.user.firstName || "User",
          userOrder.breakdown.outAmount || 0,
          userOrder.breakdown.outCurrencyName || "",
          userOrder.orderType || "Unknown",
          userOrder.orderRate?.rate || 0,
          amountInUSD,
          "",
          userOrder.orderId
        );
      }

      res.statusCode = 200;
      res.send({
        status: 200,
        message: "Order email resent successfully",
        data: {
          email: userOrder.user.email,
          orderId: userOrder.orderId
        }
      });
    } catch (err: any) {
      console.error("Error resending order email:", err);
      res.statusCode = 500;
      res.send({ status: 500, message: "Failed to resend order email", error: err.message });
    }
  }

  async getAirdropLottoContent(req: Request, res: Response) {
    try {
      const airdropService = new AirdropContentService();
      const content = await airdropService.findOne({});

      if (!content) {
        res.status(404).send({ status: 404, message: 'Airdrop content not found' });
        return;
      }

      res.status(200).send({ status: 200, message: 'Airdrop content fetched successfully', data: content });
    } catch (err: any) {
      console.error('Error fetching airdrop content:', err);
      res.status(500).send({ status: 500, message: 'Failed to fetch airdrop content', error: err.message });
    }
  };

}
