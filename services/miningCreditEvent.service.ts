import {
  MiningCreditEvent,
  STOP_MINING_CREDIT_SOURCES,
} from "../data/miningCreditEvent";
import miningCreditEventSchema, {
  MiningCreditEventModel,
} from "../models/miningCreditEvent";
import { ServiceBase } from "./base";

const HOUR_MS = 60 * 60 * 1000;
const STOP_SOURCE_SET = new Set<string>(STOP_MINING_CREDIT_SOURCES);

type RecordMiningCreditInput = {
  email?: string;
  coinSymbol: string;
  amount: number;
  creditedAt?: Date;
  source: string;
  miningPlan?: string;
  miningRate?: number;
  sessionHours?: number;
  sessionStartedAt?: Date | null;
  dedupeKey?: string;
};

export class MiningCreditEventService extends ServiceBase<
  MiningCreditEvent,
  MiningCreditEventModel
> {
  constructor() {
    super(miningCreditEventSchema, "MiningCreditEvent");
  }

  buildStopDedupeKey(email: string, coinSymbol: string, sessionStartedAt: Date) {
    return `stop:${String(coinSymbol || "").trim().toUpperCase()}:${String(email || "")
      .trim()
      .toLowerCase()}:${new Date(sessionStartedAt).toISOString()}`;
  }

  async recordCredit(input: RecordMiningCreditInput) {
    const amount = Number(input.amount || 0);
    if (!Number.isFinite(amount)) {
      throw new Error("Mining credit amount must be numeric");
    }

    const creditedAt = input.creditedAt ? new Date(input.creditedAt) : new Date();
    const email = input.email ? String(input.email).trim().toLowerCase() : undefined;
    const coinSymbol = String(input.coinSymbol || "").trim().toUpperCase();
    const source = String(input.source || "").trim() || "manual_stop";
    const sessionStartedAt = input.sessionStartedAt
      ? new Date(input.sessionStartedAt)
      : undefined;

    if (!coinSymbol) {
      throw new Error("coinSymbol is required for mining credit logging");
    }

    const dedupeKey = input.dedupeKey
      ? String(input.dedupeKey)
      : email && sessionStartedAt && STOP_SOURCE_SET.has(source)
        ? this.buildStopDedupeKey(email, coinSymbol, sessionStartedAt)
        : undefined;

    const doc: MiningCreditEvent = {
      email,
      coinSymbol,
      amount,
      creditedAt,
      source,
      miningPlan: input.miningPlan,
      miningRate:
        typeof input.miningRate === "number" && Number.isFinite(input.miningRate)
          ? input.miningRate
          : undefined,
      sessionHours:
        typeof input.sessionHours === "number" && Number.isFinite(input.sessionHours)
          ? input.sessionHours
          : undefined,
      sessionStartedAt,
      dedupeKey,
    }

    if (doc.dedupeKey) {
      return this.upsertOneAndGet(
        { dedupeKey: doc.dedupeKey },
        { $setOnInsert: doc }
      );
    }

    return this.create(doc);
  }

  async getRollingTotals(
    coinSymbol: string,
    windows: number[] = [6, 12, 24],
    now = new Date(),
    email?: string
  ) {
    const normalizedCoin = String(coinSymbol || "").trim().toUpperCase();
    const normalizedEmail = email
      ? String(email).trim().toLowerCase()
      : "";
    const uniqueWindows = Array.from(
      new Set(
        (windows || [])
          .map((hours) => Number(hours))
          .filter((hours) => Number.isFinite(hours) && hours > 0)
          .map((hours) => Math.floor(hours))
      )
    ).sort((a, b) => a - b);

    if (!normalizedCoin) {
      throw new Error("coinSymbol is required");
    }

    if (!uniqueWindows.length) {
      return {
        coinSymbol: normalizedCoin,
        generatedAt: now,
        windows: [],
      };
    }

    const maxHours = uniqueWindows[uniqueWindows.length - 1];
    const earliestCutoff = new Date(now.getTime() - maxHours * HOUR_MS);
    const groupStage: Record<string, any> = { _id: null };
    const match: Record<string, any> = {
      coinSymbol: normalizedCoin,
      creditedAt: { $gte: earliestCutoff, $lte: now },
      source: { $in: STOP_MINING_CREDIT_SOURCES },
    };

    if (normalizedEmail) {
      match.email = normalizedEmail;
    }

    for (const hours of uniqueWindows) {
      const cutoff = new Date(now.getTime() - hours * HOUR_MS);
      groupStage[`total_${hours}`] = {
        $sum: {
          $cond: [{ $gte: ["$creditedAt", cutoff] }, "$amount", 0],
        },
      };
      groupStage[`events_${hours}`] = {
        $sum: {
          $cond: [{ $gte: ["$creditedAt", cutoff] }, 1, 0],
        },
      };
    }

    const rows = await this.findAggregate<Record<string, unknown>>([
      {
        $match: match,
      },
      {
        $group: groupStage,
      },
    ]);

    const summary: Record<string, unknown> = rows?.[0] ?? {};
    return {
      coinSymbol: normalizedCoin,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      generatedAt: now,
      windows: uniqueWindows.map((hours) => ({
        hours,
        from: new Date(now.getTime() - hours * HOUR_MS),
        to: now,
        totalMined: Number(summary[`total_${hours}`] || 0),
        rewardEvents: Number(summary[`events_${hours}`] || 0),
      })),
    };
  }

  async getRewardSummary(email: string, coinSymbol: string) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCoin = String(coinSymbol || "").trim().toUpperCase();

    if (!normalizedEmail) throw new Error("email is required");
    if (!normalizedCoin) throw new Error("coinSymbol is required");

    const rows = await this.findAggregate<Record<string, unknown>>([
      {
        $match: {
          email: normalizedEmail,
          coinSymbol: normalizedCoin,
          source: { $in: STOP_MINING_CREDIT_SOURCES },
        },
      },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalMined: { $sum: "$amount" },
                totalEvents: { $sum: 1 },
                firstCreditedAt: { $min: "$creditedAt" },
                lastCreditedAt: { $max: "$creditedAt" },
                avgPerSession: { $avg: "$amount" },
                maxSession: { $max: "$amount" },
              },
            },
          ],
          bySource: [
            {
              $group: {
                _id: "$source",
                totalMined: { $sum: "$amount" },
                events: { $sum: 1 },
                lastCreditedAt: { $max: "$creditedAt" },
              },
            },
            { $sort: { totalMined: -1 } },
          ],
          byPlan: [
            {
              $group: {
                _id: "$miningPlan",
                totalMined: { $sum: "$amount" },
                events: { $sum: 1 },
              },
            },
            { $sort: { totalMined: -1 } },
          ],
          recentSessions: [
            { $sort: { creditedAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                amount: 1,
                creditedAt: 1,
                source: 1,
                miningPlan: 1,
                miningRate: 1,
                sessionHours: 1,
                sessionStartedAt: 1,
                sessionDurationHours: {
                  $cond: [
                    { $ifNull: ["$sessionHours", false] },
                    "$sessionHours",
                    {
                      $cond: [
                        {
                          $and: [
                            { $ne: ["$sessionStartedAt", null] },
                            { $ne: ["$creditedAt", null] },
                          ],
                        },
                        {
                          $round: [
                            {
                              $divide: [
                                { $subtract: ["$creditedAt", "$sessionStartedAt"] },
                                1000 * 60 * 60,
                              ],
                            },
                            3,
                          ],
                        },
                        null,
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    ]);

    const result = rows?.[0] as any;
    const overall = result?.overall?.[0] ?? {};

    return {
      email: normalizedEmail,
      coinSymbol: normalizedCoin,
      generatedAt: new Date(),
      allTime: {
        totalMined: Number(overall.totalMined || 0),
        totalEvents: Number(overall.totalEvents || 0),
        avgPerSession: Number((overall.avgPerSession || 0).toFixed(6)),
        maxSession: Number(overall.maxSession || 0),
        firstCreditedAt: overall.firstCreditedAt ?? null,
        lastCreditedAt: overall.lastCreditedAt ?? null,
      },
      bySource: (result?.bySource ?? []).map((s: any) => ({
        source: s._id ?? "unknown",
        totalMined: Number(s.totalMined || 0),
        events: Number(s.events || 0),
        lastCreditedAt: s.lastCreditedAt ?? null,
      })),
      byPlan: (result?.byPlan ?? []).map((p: any) => ({
        plan: p._id ?? "unknown",
        totalMined: Number(p.totalMined || 0),
        events: Number(p.events || 0),
      })),
      recentSessions: result?.recentSessions ?? [],
    };
  }
}
