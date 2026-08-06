import { Mining } from "../data/mining";
import { Repository } from "../db/base";
import miningSchema from "../models/mining";
import { UserMiningBalanceService } from "./userMiningBalance.service";

const userMiningBalance: UserMiningBalanceService =
  new UserMiningBalanceService();

let cachedTotalBTCYMined: number | null = null;
let cachedTotalBTCYLastUpdated: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export class MiningService extends Repository<Mining, any> {
  constructor() {
    super(miningSchema, "Mining");
  }

  /**
 * Bulk get mining data for multiple users in one query
 */
  async getMiningDataBulk(emails: string[], coinSymbol: string) {
    if (!emails?.length) return [];

    const miningDocs = await this.find({
      email: { $in: emails.map(e => e.toLowerCase()) },
      coinSymbol
    });

    // Map into a simple array or object depending on your needs
    return miningDocs.map(doc => ({
      email: doc.email.toLowerCase(),
      isMiningActive: doc.isMiningActive || false,
      miningPlan: doc.miningPlan || null,
      miningRate: doc.miningRate || 0,
      lastClaimTime: doc.lastClaimTime || null,
      totalMined: doc.totalMined || 0
    }));
  }


  async startMining(
    email: string,
    miningPlan: string,
    miningRate: number,
    coinSymbol: string
  ) {
    let getMiningData = await this.findOne({ email });
    if (getMiningData) {
      return this.updatePart(
        { email, coinSymbol },
        {
          isMiningActive: true,
          miningPlan,
          startTime: new Date(),
          lastClaimTime: new Date(),
          miningRate: miningRate,
          adsExtendedEndAt: null,
          last24HourRunAt: null,
        }
      );
    } else {
      const created = await this.create({
        email,
        isMiningActive: true,
        miningPlan,
        startTime: new Date(),
        lastClaimTime: new Date(),
        miningRate: miningRate,
        coinSymbol: coinSymbol,
        totalMined: 0,
        adsExtendedEndAt: null,
        last24HourRunAt: null,
      });
      return created;
    }
  }

  async stopMining(email: string, coinSymbol: string) {
    return this.updatePart(
      { email, coinSymbol, isMiningActive: true },
      { isMiningActive: false, adsExtendedEndAt: null }
    );
  }

  async updateMiningRewards(email: string, rewards: number) {
    return this.updatePart(
      { email },
      { $inc: { totalMined: rewards } }
    );
  }

  async getMiningData(email: string, coinSymbol: string) {
    return this.findOne({ email, coinSymbol });
  }

  async getUsersExceeding24Hours() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // now - 24h

    // Only users whose 24h window from lastClaimTime has elapsed
    return this.find({
      isMiningActive: true,
      lastClaimTime: { $lte: cutoff },
      $or: [
        { lastProcessedCycleStart: { $exists: false } },
        { lastProcessedCycleStart: null },
        { $expr: { $lt: ["$lastProcessedCycleStart", "$lastClaimTime"] } },
      ],
    });
  }

  async getUsersExceeding6Hours() {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // now - 6h

    // Only users whose 6h window from lastClaimTime has elapsed
    return this.find({
      isMiningActive: true,
      lastClaimTime: { $lte: cutoff },
      $or: [
        { lastProcessedCycleStart: { $exists: false } },
        { lastProcessedCycleStart: null },
        { $expr: { $lt: ["$lastProcessedCycleStart", "$lastClaimTime"] } },
      ],
    });
  }

  async getUsersExceeding12Hours() {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000); // now - 12h

    // Only users whose 12h window from lastClaimTime has elapsed
    return this.find({
      isMiningActive: true,
      lastClaimTime: { $lte: cutoff },
      $or: [
        { lastProcessedCycleStart: { $exists: false } },
        { lastProcessedCycleStart: null },
        { $expr: { $lt: ["$lastProcessedCycleStart", "$lastClaimTime"] } },
      ],
    });
  }

  async stopMiningAndMarkCycle(
    email: string,
    coinSymbol: string,
    cycleStart: Date,
    stopAt: Date
  ) {
    return this.updatePart(
      { email, coinSymbol, isMiningActive: true },
      {
        $set: {
          isMiningActive: false,
          lastProcessedCycleStart: cycleStart,
          lastStopAt: stopAt,
          adsExtendedEndAt: null,
        },
      }
    );
  }

  async stopAndCreditAtomic(
    email: string,
    coinSymbol: string,
    rewards: number,
    lastClaimTime: Date,
    now: Date
  ) {
    return this.updatePart(
      {
        email,
        coinSymbol,
        isMiningActive: true,
        $or: [
          { lastProcessedCycleStart: { $exists: false } },
          { lastProcessedCycleStart: { $lt: lastClaimTime } },
        ],
      },
      {
        $inc: { totalMined: rewards },
        $set: { isMiningActive: false, lastStopAt: now, adsExtendedEndAt: null },
        $max: { lastProcessedCycleStart: lastClaimTime },
      }
    );
  }


  async updateUserBalanceWhenMiningStopped(
    email: string,
    coinSymbol: string,
    rewards: number,
    referredFromKYCVerified: boolean = true
  ) {
    try {
      const balanceFieldToUpdate = referredFromKYCVerified ? "transferableBalance" : "unverifiedBalance";
      let getUserMiningBalance = await userMiningBalance.findOne({
        email: email,
        coinSymbol: coinSymbol,
      });

      if (getUserMiningBalance) {
        let updateUserBalance = await userMiningBalance.updatePart(
          {
            email: email,
            coinSymbol: coinSymbol,
          },
          { $inc: { [balanceFieldToUpdate]: rewards } }
        );
      } else {
        let createBalance = await userMiningBalance.create({
          email: email,
          transferableBalance: referredFromKYCVerified ? rewards : 0,
          unverifiedBalance: referredFromKYCVerified ? 0 : rewards,
          migratedBalance: 0,
          createdAt: new Date(),
          coinSymbol: coinSymbol,
          coinName: coinSymbol === "BTCY" ? "Bitcoin Yay" : "",
          coinNetwork: coinSymbol === "BTCY" ? "Stellar" : "",
        });
      }
      let getUserMiningBalanceAfterUpdated = await userMiningBalance.findOne({
        email: email,
        coinSymbol: coinSymbol,
      });
      return getUserMiningBalanceAfterUpdated;
    } catch (err) {
      console.error(err);
    }
  }


  async updateUserBalanceWhenMiningStoppedForScript(
    email: string,
    coinSymbol: string,
    rewards: number,
    referredFromKYCVerified: boolean = true
  ) {
    try {
      const balanceFieldToUpdate = 'transferableBalance'; //referredFromKYCVerified ? "transferableBalance" : "unverifiedBalance";
      let getUserMiningBalance = await userMiningBalance.findOne({
        email: email,
        coinSymbol: coinSymbol,
      });

      if (getUserMiningBalance) {
        let updateUserBalance = await userMiningBalance.updatePart(
          {
            email: email,
            coinSymbol: coinSymbol,
          },
          { $inc: { [balanceFieldToUpdate]: rewards } }
        );
      } else {
        let createBalance = await userMiningBalance.create({
          email: email,
          transferableBalance: referredFromKYCVerified ? rewards : 0,
          unverifiedBalance: referredFromKYCVerified ? 0 : rewards,
          migratedBalance: 0,
          createdAt: new Date(),
          coinSymbol: coinSymbol,
          coinName: coinSymbol === "BTCY" ? "Bitcoin Yay" : "",
          coinNetwork: coinSymbol === "BTCY" ? "Stellar" : "",
        });
      }
      let getUserMiningBalanceAfterUpdated = await userMiningBalance.findOne({
        email: email,
        coinSymbol: coinSymbol,
      });
      return getUserMiningBalanceAfterUpdated;
    } catch (err) {
      console.error(err);
    }
  }

  async getMiningUsersCount() {
    try {
      const count = await this.findCount({});
      return { status: 200, data: count };
    } catch (err) {
      console.error(err);
      return { status: 500, data: "Error fetching mining users count" };
    }
  }

  async getDistinctMiningEmailsCountByCoin(coinSymbol = "BTCY") {
    try {
      const pipeline = [
        {
          $match: {
            coinSymbol,
            email: { $type: "string", $ne: "" },
          },
        },
        {
          $project: {
            normalizedEmail: { $toLower: { $trim: { input: "$email" } } },
          },
        },
        {
          $match: {
            normalizedEmail: { $ne: "" },
          },
        },
        {
          $group: {
            _id: "$normalizedEmail",
          },
        },
        {
          $count: "count",
        },
      ];

      const rows: any = await this._model.aggregate(pipeline).allowDiskUse(true).exec();
      return Number(rows?.[0]?.count || 0);
    } catch (err) {
      console.error("Error fetching distinct mining email count:", err);
      throw err;
    }
  }

  async getDistinctMiningEmailsCursorByCoin(coinSymbol = "BTCY", batchSize = 2000) {
    const safeBatchSize = Number.isFinite(batchSize) ? Math.min(Math.max(Math.floor(batchSize), 100), 10000) : 2000;

    const pipeline: any[] = [
      {
        $match: {
          coinSymbol,
          email: { $type: "string", $ne: "" },
        },
      },
      {
        $project: {
          normalizedEmail: { $toLower: { $trim: { input: "$email" } } },
        },
      },
      {
        $match: {
          normalizedEmail: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$normalizedEmail",
        },
      },
      {
        $sort: {
          _id: 1 as const,
        },
      },
      {
        $project: {
          _id: 0,
          email: "$_id",
        },
      },
    ];

    return this._model
      .aggregate(pipeline)
      .allowDiskUse(true)
      .cursor({ batchSize: safeBatchSize });
  }

  async getActiveMiningUsers() {
    try {
      const activeUsers = await this.find({ isMiningActive: true });
      return { status: 200, data: activeUsers };
    } catch (err) {
      console.error(err);
      return { status: 500, data: "Error fetching active mining users" };
    }
  }

  async getAllMiningUsers() {
    try {
      const allUsers = await this.find({});
      return { status: 200, data: allUsers };
    } catch (err) {
      console.error(err);
      return { status: 500, data: "Error fetching all mining users" };
    }
  }

  async getAllMiningUsersPaginated(options: {
    page?: number;
    limit?: number;
    coinSymbol?: string;
    miningPlan?: string | string[];
    minMined?: number;
    maxMined?: number;
    search?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 50,
        coinSymbol = "BTCY",
        miningPlan,
        minMined,
        maxMined,
        search,
      } = options;

      const skip = (page - 1) * limit;
      const cond: any = { coinSymbol };

      if (miningPlan) {
        cond.miningPlan = Array.isArray(miningPlan) ? { $in: miningPlan } : miningPlan;
      }

      if (minMined !== undefined || maxMined !== undefined) {
        cond.totalMined = {};
        if (minMined !== undefined) cond.totalMined.$gte = minMined;
        if (maxMined !== undefined) cond.totalMined.$lte = maxMined;
      }

      if (search) {
        cond.email = { $regex: search, $options: "i" };
      }

      const [data, total, totalsAgg] = await Promise.all([
        this.findPaginatedSkip(limit, skip, { email: 1 }, cond, {}),
        this.findCount(cond),
        this.findAggregate<{ totalMined: number; totalUsers: number }>([
          { $match: { coinSymbol } },
          { $group: { _id: null, totalMined: { $sum: "$totalMined" }, totalUsers: { $sum: 1 } } },
        ]),
      ]);

      const agg = totalsAgg[0] ?? { totalMined: 0, totalUsers: 0 };

      return {
        status: 200,
        data,
        total,
        totals: {
          totalUsers: agg.totalUsers,
          totalMined: agg.totalMined,
        },
      };
    } catch (err) {
      console.error("Error in getAllMiningUsersPaginated:", err);
      return { status: 500, data: "Error fetching mining users" };
    }
  }

  async getTotalBTCYMined() {
    try {
      const result = await this.findAggregate([
        { $match: { coinSymbol: "BTCY" } },
        {
          $group: {
            _id: null,
            totalMinedBTCY: { $sum: "$totalMined" },
          },
        },
      ]);

      console.log("Total BTCY Mined Result:", result);
      const totalMined = result[0]?.totalMinedBTCY || 0;
      return { status: 200, totalMined };
    } catch (err) {
      console.error("Error in getTotalBTCYMined:", err);
      return { status: 500, message: "Error calculating total BTCY mined" };
    }
  }

  async getBTCYTotals() {
    try {
      // 1) Current, unwithdrawn mined amount (from mining docs)
      const curAgg: any = await this.findAggregate([
        { $match: { coinSymbol: "BTCY" } },
        { $group: { _id: null, currentUnwithdrawn: { $sum: "$totalMined" } } },
      ]);
      const currentUnwithdrawn = curAgg[0]?.currentUnwithdrawn || 0;

      // 2) Withdrawn/migrated amount (from userMiningBalance docs)
      const migAgg: any = await userMiningBalance.findAggregate([
        { $match: { coinSymbol: "BTCY" } },
        { $group: { _id: null, migrated: { $sum: "$migratedBalance" } } },
      ]);
      const migrated = migAgg[0]?.migrated || 0;

      // 3) Lifetime = current + migrated
      const lifetime = currentUnwithdrawn + migrated;

      return {
        status: 200,
        totalMined: lifetime,
      };
    } catch (err) {
      console.error("Error in getBTCYTotals:", err);
      return { status: 500, message: "Error calculating BTCY totals" };
    }
  }

  // Optional: keep your legacy method but clarify its meaning
  async getTotalBTCYMinedCurrentOnly() {
    try {
      const result = await this.findAggregate([
        { $match: { coinSymbol: "BTCY" } },
        { $group: { _id: null, totalMinedBTCY: { $sum: "$totalMined" } } },
      ]);
      const totalMined = result[0]?.totalMinedBTCY || 0;
      return { status: 200, totalMined }; // this is "current unwithdrawn"
    } catch (err) {
      console.error("Error in getTotalBTCYMinedCurrentOnly:", err);
      return { status: 500, message: "Error calculating current mined" };
    }
  }


  async getTotalBTCYMinedCached() {
    const now = Date.now();

    // If no cache or cache is older than 5 minutes, refresh it
    if (!cachedTotalBTCYMined || now - cachedTotalBTCYLastUpdated > CACHE_DURATION_MS) {
      const result = await this.getTotalBTCYMined();
      if (result.status === 200) {
        cachedTotalBTCYMined = result.totalMined ?? 0;
        cachedTotalBTCYLastUpdated = now;
      } else {
        console.error("Failed to refresh BTCY total cache:", result.message);
      }
    }

    return { status: 200, totalMined: cachedTotalBTCYMined || 0 };
  }

  // MiningService.ts
  async startMiningAtomic(
    email: string,
    miningPlan: string,
    miningRate: number,
    coinSymbol: string
  ) {
    const now = new Date();
    // Only start if NOT already active; upsert creates the doc if it doesn't exist
    const res = await this.updatePartWithOptions(
      { email, coinSymbol, isMiningActive: { $ne: true } },
      {
        $set: {
          isMiningActive: true,
          miningPlan,
          startTime: now,
          lastClaimTime: now,
          miningRate,
          adsExtendedEndAt: null,
          last24HourRunAt: null,
        },
        $setOnInsert: { email, coinSymbol, totalMined: 0 },
      },
    );

    const alreadyActive = res.matchedCount === 0 && (res as any).upsertedCount === 0;
    return { alreadyActive };
  }

  async getDailyNewUsersByObjectIdRange({
    coinSymbol = "BTCY",
    start,       // Date (UTC instant)
    end,         // Date (UTC instant, exclusive)
    tz = "Asia/Kolkata",
  }: {
    coinSymbol?: string;
    start: Date;
    end: Date;
    tz?: string;
  }) {
    return this.findAggregate([
      { $match: { coinSymbol } },
      // Convert ObjectId to a real Date (doc creation time)
      { $addFields: { createdAtFromId: { $toDate: "$_id" } } },
      // Filter into the UTC instant range
      { $match: { createdAtFromId: { $gte: start, $lt: end } } },
      // Bucket by YYYY-MM-DD in requested timezone
      {
        $addFields: {
          day: {
            $dateToString: { date: "$createdAtFromId", format: "%Y-%m-%d", timezone: tz },
          },
        },
      },
      {
        $group: {
          _id: { day: "$day", coinSymbol: "$coinSymbol" },
          emails: { $addToSet: "$email" },
        },
      },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          coinSymbol: "$_id.coinSymbol",
          newUsersCount: { $size: "$emails" },
        },
      },
      { $sort: { day: 1 } },
    ]);
  }

  /**
   * Today’s new users (first-time miners) for a coin, using ObjectId date in tz.
   */
  async getDailyNewUsersTodayByObjectId({
    coinSymbol = "BTCY",
    tz = "Asia/Kolkata",
  }: {
    coinSymbol?: string;
    tz?: string;
  }) {
    // Build [todayStart, todayEnd) in tz, then convert to UTC instants
    const now = new Date();
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now); // "YYYY-MM-DD"

    const startLocal = new Date(`${ymd}T00:00:00`);
    const endLocal = new Date(`${ymd}T00:00:00`); endLocal.setDate(endLocal.getDate() + 1);

    const start = new Date(startLocal.toLocaleString("en-US", { timeZone: "UTC" }));
    const end = new Date(endLocal.toLocaleString("en-US", { timeZone: "UTC" }));

    const rows = await this.getDailyNewUsersByObjectIdRange({ coinSymbol, start, end, tz });
    const count = rows?.[0]?.newUsersCount ?? 0;
    return { day: ymd, newUsersCount: count };
  }

}
