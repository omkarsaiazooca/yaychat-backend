import { ServiceBase } from "./base";
import { StationEarningsHistory } from "../data/stationEarningsHistory";
import StationEarningsHistorySchema, { StationEarningsHistoryModel } from "../models/stationEarningsHistory";

export class StationEarningsHistoryService extends ServiceBase<StationEarningsHistory, StationEarningsHistoryModel> {
  constructor() {
    super(StationEarningsHistorySchema, "StationEarningsHistory");
  }

  async getLifetimeTotals(ownerEmail: string) {
    const rows = await this.findAggregate<Array<{
      totalEarningsUsd: number;
      totalEarningsBtcy: number;
      totalAdsWatched: number;
    }>>([
      { $match: { ownerEmail } },
      {
        $group: {
          _id: null,
          totalEarningsUsd: { $sum: "$earningsUsd" },
          totalEarningsBtcy: { $sum: "$earningsBtcy" },
          totalAdsWatched: { $sum: 1 },
        },
      },
    ]);
    const row = (rows as any[])[0];
    return {
      earningsUsd: Number(row?.totalEarningsUsd || 0),
      earningsBtcy: Number(row?.totalEarningsBtcy || 0),
      adsWatched: Number(row?.totalAdsWatched || 0),
    };
  }

  async getRangeTotals(ownerEmail: string, from: Date | null, to: Date) {
    const match: any = { ownerEmail };
    if (from) {
      match.createdAt = { $gte: from, $lte: to };
    } else {
      match.createdAt = { $lte: to };
    }

    const rows = await this.findAggregate<Array<{
      totalEarningsUsd: number;
      totalEarningsBtcy: number;
      totalAdsWatched: number;
    }>>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEarningsUsd: { $sum: "$earningsUsd" },
          totalEarningsBtcy: { $sum: "$earningsBtcy" },
          totalAdsWatched: { $sum: 1 },
        },
      },
    ]);
    const row = (rows as any[])[0];
    return {
      earningsUsd: Number(row?.totalEarningsUsd || 0),
      earningsBtcy: Number(row?.totalEarningsBtcy || 0),
      adsWatched: Number(row?.totalAdsWatched || 0),
    };
  }

  async getMonthlyHistory(
    ownerEmail: string,
    from: Date,
    to: Date,
    timezone: string
  ): Promise<Array<{
    bucket: string;
    adsWatched: number;
    grossRevenueUsd: number;
    earningsUsd: number;
    earningsBtcy: number;
  }>> {
    const rows = await this.findAggregate([
      { $match: { ownerEmail, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone,
            },
          },
          adsWatched:      { $sum: 1 },
          grossRevenueUsd: { $sum: "$grossUsdPerAd" },
          earningsUsd:     { $sum: "$earningsUsd" },
          earningsBtcy:    { $sum: "$earningsBtcy" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return (rows as any[]).map((row) => ({
      bucket:          String(row._id || ""),
      adsWatched:      Number(row.adsWatched || 0),
      grossRevenueUsd: Number(row.grossRevenueUsd || 0),
      earningsUsd:     Number(row.earningsUsd || 0),
      earningsBtcy:    Number(row.earningsBtcy || 0),
    }));
  }

  async getDailyHistory(
    ownerEmail: string,
    from: Date,
    to: Date,
    timezone: string
  ): Promise<Array<{
    bucket: string;
    adsWatched: number;
    earningsUsd: number;
    earningsBtcy: number;
  }>> {
    const rows = await this.findAggregate([
      { $match: { ownerEmail, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone,
            },
          },
          adsWatched:    { $sum: 1 },
          earningsUsd:   { $sum: "$earningsUsd" },
          earningsBtcy:  { $sum: "$earningsBtcy" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return (rows as any[]).map((row) => ({
      bucket:       String(row._id || ""),
      adsWatched:   Number(row.adsWatched || 0),
      earningsUsd:  Number(row.earningsUsd || 0),
      earningsBtcy: Number(row.earningsBtcy || 0),
    }));
  }

  async getMinerBreakdown(
    ownerEmail: string,
    from: Date | null,
    to: Date
  ): Promise<Array<{
    minerEmail: string;
    adsWatched: number;
    earningsUsd: number;
    earningsBtcy: number;
  }>> {
    const match: any = { ownerEmail };
    if (from) {
      match.createdAt = { $gte: from, $lte: to };
    } else {
      match.createdAt = { $lte: to };
    }

    const rows = await this.findAggregate([
      { $match: match },
      {
        $group: {
          _id:           "$minerEmail",
          adsWatched:    { $sum: 1 },
          earningsUsd:   { $sum: "$earningsUsd" },
          earningsBtcy:  { $sum: "$earningsBtcy" },
        },
      },
      { $sort: { earningsBtcy: -1 } },
    ]);

    return (rows as any[]).map((row) => ({
      minerEmail:   String(row._id || ""),
      adsWatched:   Number(row.adsWatched || 0),
      earningsUsd:  Number(row.earningsUsd || 0),
      earningsBtcy: Number(row.earningsBtcy || 0),
    }));
  }
}
