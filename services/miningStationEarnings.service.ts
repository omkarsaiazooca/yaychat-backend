import { AdMiningWatchService } from "./adMiningWatch.service";
import { MiningService } from "./mining.service";
import { UserService } from "./user.service";
import { UserMiningBalanceService } from "./userMiningBalance.service";
import { WithdrawService } from "./miningWithdrawRequest.service";
import { DailyAdDayService } from "./dailyAds.service";
import { ensureRedisConnected } from "../cache/redisClient";
import { getPriceByName } from "../controllers/priceAPI";
import { keys } from "../config/keys";
import { admobCpmService } from "./admobCpm.service";
import { StationEarningsHistoryService } from "./stationEarningsHistory.service";

const CACHE_TTL_SECONDS = 300; // 5 minutes

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_RANGE = "30d";
const DEFAULT_HISTORY_MONTHS = 12;
const MIN_STATION_REFERRALS = 25;
const MIN_WITHDRAWAL_USD = 50;
const MAX_WITHDRAWAL_USD = 1000;
const INTERNAL_BTCY_NETWORK = "Ying Yang Chain";

type RangeGranularity = "day" | "month";

type RangeConfig = {
  key: string;
  from: Date | null;
  to: Date;
  timezone: string;
  granularity: RangeGranularity;
};

type EarningsOverviewOptions = {
  range?: string;
  from?: string;
  to?: string;
  timezone?: string;
  page?: number;
  pageSize?: number;
};

type AggregateRow = {
  _id?: string;
  adCount?: number;
  rewardedCount?: number;
  interstitialCount?: number;
  lastAdAt?: Date | null;
};

type HistoryRow = {
  _id?: string;
  adCount?: number;
  rewardedCount?: number;
  interstitialCount?: number;
};

type ReferralProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePic: string | null;
  referralCode: string;
  joinedAt: string | null;
  lastActiveAt: string | null;
};

type RateConfig = {
  model: "admob_cpm_share" | "fixed_per_ad";
  admobCpmUsd: number;
  admobInterstitialCpmUsd: number;
  revenueSharePct: number;
  revenueShareRatio: number;
  grossUsdPerAd: number;
  grossInterstitialUsdPerAd: number;
  usdPerAd: number;
  interstitialUsdPerAd: number;
  usdPerBtcy: number | null;
  btcyPerAd: number;
  interstitialBtcyPerAd: number;
};

export class MiningStationEarningsService {
  private readonly adMiningWatchService = new AdMiningWatchService();
  private readonly miningService = new MiningService();
  private readonly userService = new UserService();
  private readonly userMiningBalanceService = new UserMiningBalanceService();
  private readonly withdrawService = new WithdrawService();
  private readonly dailyAdDayService = new DailyAdDayService();
  private readonly earningsHistoryService = new StationEarningsHistoryService();
  private readonly pendingCacheReads = new Map<string, Promise<any>>();
  private btcyUsdPriceCache: { value: number; expiresAt: number } | null = null;

  private async getCached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const redis = await ensureRedisConnected();
      const cached = await redis.get(key);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          // Ignore malformed cache entries and recompute below.
        }
      }

      const pending = this.pendingCacheReads.get(key);
      if (pending) {
        return pending as Promise<T>;
      }

      const pendingRead = fn()
        .then((result) => {
          redis
            .set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS })
            .catch(() => {});
          return result;
        })
        .finally(() => {
          this.pendingCacheReads.delete(key);
        });

      this.pendingCacheReads.set(key, pendingRead);
      return pendingRead;
    } catch {
      // Redis unavailable — compute without cache
      return fn();
    }
  }

  private buildCacheKey(
    scope: string,
    identifier: string,
    options: EarningsOverviewOptions & { page?: number; pageSize?: number } = {}
  ) {
    const normalizedScope = String(scope || "").trim().toLowerCase();
    const normalizedIdentifier = String(identifier || "").trim().toLowerCase() || "all";
    const range = String(options.range || DEFAULT_RANGE).trim().toLowerCase() || DEFAULT_RANGE;
    const from = String(options.from || "").trim();
    const to = String(options.to || "").trim();
    const timezone = String(options.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

    return [
      "earnings",
      normalizedScope,
      normalizedIdentifier,
      range,
      from,
      to,
      timezone,
      String(options.page ?? ""),
      String(options.pageSize ?? ""),
    ].join(":");
  }

  private async invalidateCachePatterns(patterns: string[]) {
    try {
      const redis = await ensureRedisConnected();
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length) {
          await (redis as any).del(keys);
        }
      }
    } catch {
      // Ignore cache invalidation failures.
    }
  }

  private invalidateOwnerCaches(ownerEmail: string) {
    const normalizedEmail = String(ownerEmail || "").trim().toLowerCase();
    if (!normalizedEmail) return;

    void this.invalidateCachePatterns([
      `earnings:overview:${normalizedEmail}:*`,
      `earnings:user:${normalizedEmail}:*`,
      `earnings:station-overview:${normalizedEmail}:*`,
      `earnings:station-earnings:${normalizedEmail}:*`,
      `earnings:station-referrals:${normalizedEmail}:*`,
      `earnings:station-miners:${normalizedEmail}:*`,
      `earnings:station-analytics:${normalizedEmail}:*`,
      `earnings:station-withdrawals:${normalizedEmail}:*`,
      `earnings:station-context:${normalizedEmail}:*`,
    ]);
  }

  async getOverview(
    referrerEmail: string,
    options: EarningsOverviewOptions = {}
  ) {
    const ownerEmail = String(referrerEmail || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const page = Math.max(0, Number(options.page || 0));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize || 20)));
    const cacheKey = this.buildCacheKey("overview", ownerEmail, {
      ...options,
      page,
      pageSize,
    });

    return this.getCached(cacheKey, async () => {
      const stationContext = await this.getStationOwnerAndReferrals(ownerEmail);
      const owner = stationContext.owner;

        if (!owner) {
          return { status: 404, data: { message: "User not found" } };
        }

        const referralCode = stationContext.referralCode;
        const rangeConfig = this.resolveRange(options);
        const rates = await this.getRateConfig();

        if (!referralCode) {
          return {
            status: 200,
            data: this.buildEmptyOverview(ownerEmail, rangeConfig, rates, {
              ownerProfile: {
                firstName: String((owner as any).firstName || ""),
                lastName: String((owner as any).lastName || ""),
                username: String((owner as any).username || ""),
                profilePic: (owner as any).profilePic || null,
              },
              referralCode,
            }),
          };
        }

        const referralProfiles = stationContext.referralProfiles;
        const referralEmails = stationContext.referralEmails;

        if (!referralEmails.length) {
          return {
            status: 200,
            data: this.buildEmptyOverview(ownerEmail, rangeConfig, rates, {
              ownerProfile: {
                firstName: String((owner as any).firstName || ""),
                lastName: String((owner as any).lastName || ""),
                username: String((owner as any).username || ""),
                profilePic: (owner as any).profilePic || null,
              },
              referralCode,
            }),
          };
        }

        const historyRange = this.resolveHistoryRange(rangeConfig);
        const currentMonthRange = this.resolveCurrentMonthRange(rangeConfig.timezone);

        const [
          lifetimeTotals,
          currentTotals,
          currentMonthTotals,
          byReferral,
          history,
        ] = await Promise.all([
          this.aggregateTotals(referralEmails, null, rangeConfig.to),
          this.aggregateTotals(referralEmails, rangeConfig.from, rangeConfig.to),
          this.aggregateTotals(
            referralEmails,
            currentMonthRange.from,
            currentMonthRange.to
          ),
          this.aggregateByReferral(
            referralEmails,
            rangeConfig.from,
            rangeConfig.to
          ),
          this.aggregateHistory(
            referralEmails,
            historyRange.from,
            historyRange.to,
            rangeConfig.timezone,
            historyRange.granularity
          ),
        ]);

        const byReferralMap = new Map<string, AggregateRow>();
        for (const row of byReferral) {
          const email = String(row._id || "").trim().toLowerCase();
          if (!email) continue;
          byReferralMap.set(email, row);
        }

        const referralBreakdown = referralProfiles
          .map((profile) => {
            const row = byReferralMap.get(profile.email);
            const adCount = Number(row?.adCount || 0);
            const rewardedCount = Number(row?.rewardedCount || 0);
            const interstitialCount = Number(row?.interstitialCount || 0);
            const { grossRevenueUsd, earningsUsd, earningsBtcy } = this.computeRevenue(
              rewardedCount,
              interstitialCount,
              rates
            );
            const lastAdAt = row?.lastAdAt ? new Date(row.lastAdAt).toISOString() : null;

            return {
              email: profile.email,
              fullName: this.buildFullName(profile.firstName, profile.lastName),
              firstName: profile.firstName,
              lastName: profile.lastName,
              username: profile.username,
              profilePic: profile.profilePic,
              adsWatched: adCount,
              rewardedAdsWatched: rewardedCount,
              interstitialAdsWatched: interstitialCount,
              grossRevenueUsd,
              revenueSharePct: rates.revenueSharePct,
              earningsUsd,
              earningsBtcy,
              lastAdWatchedAt: lastAdAt,
            };
          })
          .sort((left, right) => {
            if (right.adsWatched !== left.adsWatched) {
              return right.adsWatched - left.adsWatched;
            }
            return left.email.localeCompare(right.email);
          });

        const activeReferrals = referralBreakdown.filter((item) => item.adsWatched > 0);
        const inactiveReferrals = referralBreakdown.length - activeReferrals.length;

        const currentAdsWatched = Number(currentTotals.adCount || 0);
        const lifetimeAdsWatched = Number(lifetimeTotals.adCount || 0);
        const currentMonthAdsWatched = Number(currentMonthTotals.adCount || 0);

        const currentRevenue = this.computeRevenue(
          currentTotals.rewardedCount,
          currentTotals.interstitialCount,
          rates
        );
        const lifetimeRevenue = this.computeRevenue(
          lifetimeTotals.rewardedCount,
          lifetimeTotals.interstitialCount,
          rates
        );
        const currentMonthRevenue = this.computeRevenue(
          currentMonthTotals.rewardedCount,
          currentMonthTotals.interstitialCount,
          rates
        );

        const currentGrossRevenueUsd = currentRevenue.grossRevenueUsd;
        const lifetimeGrossRevenueUsd = lifetimeRevenue.grossRevenueUsd;
        const currentMonthGrossRevenueUsd = currentMonthRevenue.grossRevenueUsd;

        const currentEarningsUsd = currentRevenue.earningsUsd;
        const currentEarningsBtcy = currentRevenue.earningsBtcy;
        const lifetimeEarningsUsd = lifetimeRevenue.earningsUsd;
        const lifetimeEarningsBtcy = lifetimeRevenue.earningsBtcy;
        const currentMonthEarningsUsd = currentMonthRevenue.earningsUsd;
        const currentMonthEarningsBtcy = currentMonthRevenue.earningsBtcy;

        const topReferrals = referralBreakdown.slice(0, 10);
        const historySeries = history.map((row) => {
          const bucket = String(row._id || "");
          const adsWatched = Number(row.adCount || 0);
          const rewardedCount = Number(row.rewardedCount || 0);
          const interstitialCount = Number(row.interstitialCount || 0);
          const { grossRevenueUsd, earningsUsd, earningsBtcy } = this.computeRevenue(
            rewardedCount,
            interstitialCount,
            rates
          );
          return {
            bucket,
            adsWatched,
            rewardedAdsWatched: rewardedCount,
            interstitialAdsWatched: interstitialCount,
            grossRevenueUsd,
            revenueSharePct: rates.revenueSharePct,
            earningsUsd,
            earningsBtcy,
          };
        });

        const totalReferrals = referralBreakdown.length;
        const activeRate = totalReferrals > 0
          ? this.roundRatio((activeReferrals.length / totalReferrals) * 100)
          : 0;

        const paginatedBreakdown = referralBreakdown.slice(
          page * pageSize,
          (page + 1) * pageSize
        );

        return {
          status: 200,
          data: {
            owner: {
              email: ownerEmail,
              referralCode,
              fullName: this.buildFullName(
                String((owner as any).firstName || ""),
                String((owner as any).lastName || "")
              ),
              firstName: String((owner as any).firstName || ""),
              lastName: String((owner as any).lastName || ""),
              username: String((owner as any).username || ""),
              profilePic: (owner as any).profilePic || null,
            },
            range: {
              key: rangeConfig.key,
              from: rangeConfig.from ? rangeConfig.from.toISOString() : null,
              to: rangeConfig.to.toISOString(),
              timezone: rangeConfig.timezone,
              historyGranularity: historyRange.granularity,
              historyFrom: historyRange.from ? historyRange.from.toISOString() : null,
              historyTo: historyRange.to.toISOString(),
            },
            totals: {
              lifetime: {
                adsWatched: lifetimeAdsWatched,
                grossRevenueUsd: lifetimeGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: lifetimeEarningsUsd,
                earningsBtcy: lifetimeEarningsBtcy,
              },
              current: {
                adsWatched: currentAdsWatched,
                grossRevenueUsd: currentGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: currentEarningsUsd,
                earningsBtcy: currentEarningsBtcy,
              },
              currentMonth: {
                adsWatched: currentMonthAdsWatched,
                grossRevenueUsd: currentMonthGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: currentMonthEarningsUsd,
                earningsBtcy: currentMonthEarningsBtcy,
              },
              pending: {
                adsWatched: currentMonthAdsWatched,
                grossRevenueUsd: currentMonthGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: currentMonthEarningsUsd,
                earningsBtcy: currentMonthEarningsBtcy,
              },
              withdrawable: {
                adsWatched: lifetimeAdsWatched,
                grossRevenueUsd: lifetimeGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: lifetimeEarningsUsd,
                earningsBtcy: lifetimeEarningsBtcy,
              },
            },
            allocation: {
              rate: {
                model: rates.model,
                admobCpmUsd: rates.admobCpmUsd,
                revenueSharePct: rates.revenueSharePct,
                rewarded: {
                  admobCpmUsd: rates.admobCpmUsd,
                  grossUsdPerAd: rates.grossUsdPerAd,
                  usdPerAd: rates.usdPerAd,
                  btcyPerAd: rates.btcyPerAd,
                },
                interstitial: {
                  admobCpmUsd: rates.admobInterstitialCpmUsd,
                  grossUsdPerAd: rates.grossInterstitialUsdPerAd,
                  usdPerAd: rates.interstitialUsdPerAd,
                  btcyPerAd: rates.interstitialBtcyPerAd,
                },
                usdPerBtcy: rates.usdPerBtcy,
              },
              referrals: {
                total: totalReferrals,
                active: activeReferrals.length,
                inactive: inactiveReferrals,
                activeRatePct: activeRate,
              },
              topReferrals,
            },
            revenueSources: [
              {
                key: "referral_ad_watch",
                label: "Referral Ad Revenue Share",
                adsWatched: currentAdsWatched,
                grossRevenueUsd: currentGrossRevenueUsd,
                revenueSharePct: rates.revenueSharePct,
                earningsUsd: currentEarningsUsd,
                earningsBtcy: currentEarningsBtcy,
                sharePct: currentAdsWatched > 0 ? 100 : 0,
              },
            ],
            metrics: {
              averageAdsPerReferral: totalReferrals > 0
                ? this.roundRatio(currentAdsWatched / totalReferrals)
                : 0,
              averageAdsPerActiveReferral: activeReferrals.length > 0
                ? this.roundRatio(currentAdsWatched / activeReferrals.length)
                : 0,
              averageEarningsUsdPerReferral: totalReferrals > 0
                ? this.roundCurrency(currentEarningsUsd / totalReferrals)
                : 0,
              averageEarningsBtcyPerReferral: totalReferrals > 0
                ? this.roundToken(currentEarningsBtcy / totalReferrals)
                : 0,
              lastAdWatchedAt: currentTotals.lastAdAt
                ? new Date(currentTotals.lastAdAt).toISOString()
                : lifetimeTotals.lastAdAt
                  ? new Date(lifetimeTotals.lastAdAt).toISOString()
                  : null,
              adsWatchedThisMonth: currentMonthAdsWatched,
            },
            history: historySeries,
            pagination: {
              page,
              pageSize,
              total: totalReferrals,
              totalPages: Math.ceil(totalReferrals / pageSize),
            },
            referralBreakdown: paginatedBreakdown,
          },
        };
    });
  }

  private normalizeReferralProfiles(users: any[]): ReferralProfile[] {
    const seen = new Set<string>();
    const output: ReferralProfile[] = [];

    for (const user of users || []) {
      const email = String(user?.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);

      output.push({
        id: String((user as any)?._id || ""),
        email,
        firstName: String(user?.firstName || ""),
        lastName: String(user?.lastName || ""),
        username: String(user?.username || ""),
        profilePic: user?.profilePic || null,
        referralCode: String(user?.referralCode || ""),
        joinedAt: this.extractDateFromObjectId((user as any)?._id),
        lastActiveAt: this.normalizeDate(user?.lastActive),
      });
    }

    return output;
  }

  private normalizeDate(value: any): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private extractDateFromObjectId(value: any): string | null {
    const raw = String(value || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(raw)) {
      return null;
    }

    const seconds = Number.parseInt(raw.slice(0, 8), 16);
    if (!Number.isFinite(seconds)) {
      return null;
    }

    return new Date(seconds * 1000).toISOString();
  }

  private pickLatestIso(...values: Array<string | null | undefined>) {
    const timestamps = values
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (!timestamps.length) {
      return null;
    }

    return new Date(Math.max(...timestamps)).toISOString();
  }

  private toAmountPair(btcy: number, usdPerBtcy: number | null) {
    const normalizedBtcy = this.roundToken(btcy);
    return {
      btcy: normalizedBtcy,
      usd: usdPerBtcy ? this.roundCurrency(normalizedBtcy * usdPerBtcy) : null,
    };
  }

  private toUsdAmountPair(usd: number, usdPerBtcy: number | null) {
    const normalizedUsd = this.roundCurrency(usd);
    return {
      btcy: usdPerBtcy ? this.roundToken(normalizedUsd / usdPerBtcy) : null,
      usd: normalizedUsd,
    };
  }

  private toEarningsPair(usd: number, btcy: number) {
    return {
      usd: this.roundCurrency(usd),
      btcy: this.roundToken(btcy),
    };
  }

  private calculateGrowthPercent(current: number, previous: number) {
    const currentValue = Number(current || 0);
    const previousValue = Number(previous || 0);
    if (previousValue > 0) {
      return this.roundRatio(((currentValue - previousValue) / previousValue) * 100);
    }

    return currentValue > 0 ? 100 : 0;
  }

  private resolveQualificationStatus(owner: any) {
    const kycStatus = String(owner?.kycStatus || "").trim().toLowerCase();
    if (owner?.isKYCPass || kycStatus === "approved" || kycStatus === "verified") {
      return "qualified";
    }

    return "pending_verification";
  }

  private resolveMonthRange(timezone: string, monthOffset = 0) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);

    const baseYear = Number(parts.find((part) => part.type === "year")?.value || now.getUTCFullYear());
    const baseMonth = Number(parts.find((part) => part.type === "month")?.value || now.getUTCMonth() + 1);
    const from = new Date(Date.UTC(baseYear, (baseMonth - 1) + monthOffset, 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(baseYear, baseMonth + monthOffset, 1, 0, 0, 0, 0));
    const to = monthOffset === 0 ? now : new Date(nextMonth.getTime() - 1);

    return { from, to };
  }

  private resolveNextPayoutAt(timezone: string) {
    return this.resolveMonthRange(timezone, 1).from.toISOString();
  }

  private async getStationOwnerAndReferrals(ownerEmail: string) {
    const normalizedEmail = String(ownerEmail || "").trim().toLowerCase();
    const cacheKey = this.buildCacheKey("station-context", normalizedEmail);

    return this.getCached(cacheKey, async () => {
      const owner = await this.userService.findOneSelect(
        { email: normalizedEmail },
        {
          _id: 1,
          email: 1,
          referralCode: 1,
          firstName: 1,
          lastName: 1,
          username: 1,
          profilePic: 1,
          kycStatus: 1,
          isKYCPass: 1,
          userWallets: 1,
          lastActive: 1,
        }
      );

      if (!owner) {
        return { owner: null, referralCode: "", referralProfiles: [] as ReferralProfile[], referralEmails: [] as string[] };
      }

      const referralCode = String((owner as any).referralCode || "").trim();
      if (!referralCode) {
        return { owner, referralCode, referralProfiles: [] as ReferralProfile[], referralEmails: [] as string[] };
      }

      const referredUsers = await this.userService.findSelect(
        { referralCodeUsed: referralCode },
        {
          _id: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          username: 1,
          profilePic: 1,
          referralCode: 1,
          lastActive: 1,
        }
      );
      const referralProfiles = this.normalizeReferralProfiles(referredUsers);

      return {
        owner,
        referralCode,
        referralProfiles,
        referralEmails: referralProfiles.map((profile) => profile.email),
      };
    });
  }

  private validateStationAccess(stationContext: {
    owner: any;
    referralProfiles: ReferralProfile[];
  }) {
    if (!stationContext.owner) {
      return { status: 404, data: { message: "User not found" } };
    }

    const totalReferrals = stationContext.referralProfiles.length;
    if (totalReferrals < MIN_STATION_REFERRALS) {
      return {
        status: 403,
        data: {
          message: `Mining Station unlocks once your account reaches at least ${MIN_STATION_REFERRALS} referrals.`,
          requiredReferrals: MIN_STATION_REFERRALS,
          totalReferrals,
          remainingReferrals: MIN_STATION_REFERRALS - totalReferrals,
        },
      };
    }

    return null;
  }

  private async getReferralCountsByCode(referralCodes: string[]) {
    const codes = referralCodes
      .map((code) => String(code || "").trim())
      .filter((code) => code.length > 0);
    const countMap = new Map<string, number>();

    if (!codes.length) {
      return countMap;
    }

    const rows = await this.userService.findAggregate<Array<{ _id?: string; count?: number }>>([
      { $match: { referralCodeUsed: { $in: codes } } },
      {
        $group: {
          _id: "$referralCodeUsed",
          count: { $sum: 1 },
        },
      },
    ] as any);

    for (const row of rows as any) {
      const code = String(row?._id || "").trim();
      if (!code) continue;
      countMap.set(code, Number(row?.count || 0));
    }

    return countMap;
  }

  private async aggregateDailyActiveMiners(
    emails: string[],
    from: Date,
    to: Date,
    timezone: string
  ): Promise<Array<{ bucket: string; activeMiners: number }>> {
    if (!emails.length) {
      return [];
    }

    const rows = await this.adMiningWatchService.findAggregate<Array<{ _id?: string; emails?: string[] }>>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
              timezone,
            },
          },
          emails: { $addToSet: "$email" },
        },
      },
      { $sort: { _id: 1 } },
    ] as any);

    return (rows as any[]).map((row) => ({
      bucket: String(row?._id || ""),
      activeMiners: Array.isArray(row?.emails) ? row.emails.length : 0,
    }));
  }

  private async aggregateMinerActivityByHour(
    emails: string[],
    from: Date,
    to: Date,
    timezone: string
  ): Promise<Array<{ hour: number; adsWatched: number; activeMiners: number }>> {
    if (!emails.length) {
      return Array.from({ length: 24 }, (_, hour) => ({ hour, adsWatched: 0, activeMiners: 0 }));
    }

    const rows = await this.adMiningWatchService.findAggregate<Array<{ _id?: number; adCount?: number; emails?: string[] }>>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: {
            $hour: {
              date: "$timestamp",
              timezone,
            },
          },
          adCount: { $sum: 1 },
          emails: { $addToSet: "$email" },
        },
      },
    ] as any);

    const rowMap = new Map<number, { adCount: number; activeMiners: number }>();
    for (const row of rows as any[]) {
      const hour = Number(row?._id);
      if (!Number.isFinite(hour)) continue;
      rowMap.set(hour, {
        adCount: Number(row?.adCount || 0),
        activeMiners: Array.isArray(row?.emails) ? row.emails.length : 0,
      });
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      adsWatched: rowMap.get(hour)?.adCount || 0,
      activeMiners: rowMap.get(hour)?.activeMiners || 0,
    }));
  }

  private async aggregateWeeklyPerformance(
    emails: string[],
    from: Date,
    to: Date,
    timezone: string,
    rates: RateConfig
  ) {
    if (!emails.length) {
      return [];
    }

    const rows = await this.adMiningWatchService.findAggregate<Array<{
      _id?: string;
      adCount?: number;
      rewardedCount?: number;
      interstitialCount?: number;
      emails?: string[];
    }>>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-W%U",
              date: "$timestamp",
              timezone,
            },
          },
          adCount: { $sum: 1 },
          rewardedCount: { $sum: { $cond: [{ $eq: ["$adType", "rewarded"] }, 1, 0] } },
          interstitialCount: { $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] } },
          emails: { $addToSet: "$email" },
        },
      },
      { $sort: { _id: 1 } },
    ] as any);

    return (rows as any[]).map((row) => {
      const revenue = this.computeRevenue(
        Number(row?.rewardedCount || 0),
        Number(row?.interstitialCount || 0),
        rates
      );

      return {
        bucket: String(row?._id || ""),
        adsWatched: Number(row?.adCount || 0),
        activeMiners: Array.isArray(row?.emails) ? row.emails.length : 0,
        grossRevenueUsd: revenue.grossRevenueUsd,
        earningsUsd: revenue.earningsUsd,
        earningsBtcy: revenue.earningsBtcy,
      };
    });
  }

  private async getPendingWithdrawalSummary(ownerEmail: string) {
    const rows = await this.withdrawService.findAggregate<Array<{
      _id?: string | null;
      count?: number;
      requestedAmount?: number;
      approvedAmount?: number;
    }>>([
      {
        $match: {
          email: ownerEmail,
          status: "Pending",
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          requestedAmount: { $sum: "$requestedAmount" },
          approvedAmount: { $sum: "$approvedAmount" },
        },
      },
    ] as any);

    const row = (rows as any[])?.[0] || {};
    return {
      count: Number(row?.count || 0),
      requestedAmount: Number(row?.requestedAmount || 0),
      approvedAmount: Number(row?.approvedAmount || 0),
    };
  }

  private async getCommittedWithdrawalSummary(ownerEmail: string) {
    const rows = await this.withdrawService.findAggregate<Array<{
      _id?: string | null;
      count?: number;
      requestedAmount?: number;
      approvedAmount?: number;
    }>>([
      {
        $match: {
          email: ownerEmail,
          status: { $ne: "Rejected" },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          requestedAmount: { $sum: "$requestedAmount" },
          approvedAmount: { $sum: "$approvedAmount" },
        },
      },
    ] as any);

    const row = (rows as any[])?.[0] || {};
    return {
      count: Number(row?.count || 0),
      requestedAmount: Number(row?.requestedAmount || 0),
      approvedAmount: Number(row?.approvedAmount || 0),
    };
  }

  private async getAvailableAdRevenueWithdrawalBalance(ownerEmail: string, rates: RateConfig) {
    const stationContext = await this.getStationOwnerAndReferrals(ownerEmail);
    if (!stationContext.owner) {
      return { owner: null, lifetimeEarningsUsd: 0, committedUsd: 0, availableUsd: 0 };
    }

    const lifetimeTotals = await this.aggregateTotals(stationContext.referralEmails, null, new Date());
    const lifetimeRevenue = this.computeRevenue(
      lifetimeTotals.rewardedCount,
      lifetimeTotals.interstitialCount,
      rates
    );
    const committed = await this.getCommittedWithdrawalSummary(ownerEmail);
    const lifetimeEarningsUsd = Number(lifetimeRevenue.earningsUsd || 0);
    const committedUsd = Number(committed.requestedAmount || 0);

    return {
      owner: stationContext.owner,
      lifetimeEarningsUsd,
      committedUsd,
      availableUsd: Math.max(0, this.roundCurrency(lifetimeEarningsUsd - committedUsd)),
    };
  }

  private async aggregateMonthlyReferralGrowth(
    referralCode: string,
    timezone: string,
    months = 6
  ): Promise<Array<{ bucket: string; newReferrals: number; growthRatePct: number }>> {
    if (!referralCode) {
      return [];
    }

    const now = new Date();
    const from = new Date(now.getTime());
    from.setMonth(from.getMonth() - Math.max(months - 1, 0));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const rows = await this.userService.findAggregate<Array<{ _id?: string; count?: number }>>([
      {
        $match: {
          referralCodeUsed: referralCode,
        },
      },
      {
        $addFields: {
          createdAtFromId: { $toDate: "$_id" },
        },
      },
      {
        $match: {
          createdAtFromId: { $gte: from, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAtFromId",
              timezone,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ] as any);

    let previousCount = 0;
    return (rows as any[]).map((row) => {
      const newReferrals = Number(row?.count || 0);
      const growthRatePct = previousCount > 0
        ? this.roundRatio(((newReferrals - previousCount) / previousCount) * 100)
        : newReferrals > 0
          ? 100
          : 0;

      previousCount = newReferrals;
      return {
        bucket: String(row?._id || ""),
        newReferrals,
        growthRatePct,
      };
    });
  }

  private async aggregateTotals(
    emails: string[],
    from: Date | null,
    to: Date
  ): Promise<{ adCount: number; rewardedCount: number; interstitialCount: number; lastAdAt: Date | null }> {
    if (!emails.length) {
      return { adCount: 0, rewardedCount: 0, interstitialCount: 0, lastAdAt: null };
    }

    const rows = await this.adMiningWatchService.findAggregate<AggregateRow>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: null,
          adCount: { $sum: 1 },
          rewardedCount: { $sum: { $cond: [{ $eq: ["$adType", "rewarded"] }, 1, 0] } },
          interstitialCount: { $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] } },
          lastAdAt: { $max: "$timestamp" },
        },
      },
    ]);

    const row = rows[0];
    return {
      adCount: Number(row?.adCount || 0),
      rewardedCount: Number(row?.rewardedCount || 0),
      interstitialCount: Number(row?.interstitialCount || 0),
      lastAdAt: row?.lastAdAt ? new Date(row.lastAdAt) : null,
    };
  }

  private async aggregateByReferral(
    emails: string[],
    from: Date | null,
    to: Date
  ): Promise<AggregateRow[]> {
    if (!emails.length) return [];

    return this.adMiningWatchService.findAggregate<AggregateRow>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: "$email",
          adCount: { $sum: 1 },
          rewardedCount: { $sum: { $cond: [{ $eq: ["$adType", "rewarded"] }, 1, 0] } },
          interstitialCount: { $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] } },
          lastAdAt: { $max: "$timestamp" },
        },
      },
      {
        $sort: {
          adCount: -1,
          _id: 1,
        },
      },
    ]);
  }

  private async aggregateHistory(
    emails: string[],
    from: Date | null,
    to: Date,
    timezone: string,
    granularity: RangeGranularity
  ): Promise<HistoryRow[]> {
    if (!emails.length || !from) return [];

    const format = granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
    return this.adMiningWatchService.findAggregate<HistoryRow>([
      {
        $match: this.buildMatch(emails, from, to),
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: "$timestamp",
              timezone,
            },
          },
          adCount: { $sum: 1 },
          rewardedCount: { $sum: { $cond: [{ $eq: ["$adType", "rewarded"] }, 1, 0] } },
          interstitialCount: { $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] } },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);
  }

  private buildMatch(emails: string[], from: Date | null, to: Date) {
    const normalizedEmails = emails.map((email) => String(email).trim().toLowerCase());
    const match: Record<string, unknown> = {
      email: { $in: normalizedEmails },
    };

    const timestamp: Record<string, Date> = { $lte: to };
    if (from) {
      timestamp.$gte = from;
    }
    match.timestamp = timestamp;

    return match;
  }

  private resolveRange(options: EarningsOverviewOptions): RangeConfig {
    const now = new Date();
    const timezone = String(options.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
    const explicitFrom = this.parseDate(options.from);
    const explicitTo = this.parseDate(options.to);

    if (explicitFrom || explicitTo) {
      return {
        key: "custom",
        from: explicitFrom,
        to: explicitTo || now,
        timezone,
        granularity: "day",
      };
    }

    const rangeKey = String(options.range || DEFAULT_RANGE).trim().toLowerCase();
    if (rangeKey === "all") {
      return {
        key: "all",
        from: null,
        to: now,
        timezone,
        granularity: "month",
      };
    }

    const days = this.extractDays(rangeKey);
    return {
      key: days ? `${days}d` : DEFAULT_RANGE,
      from: new Date(now.getTime() - ((days || 30) - 1) * DAY_MS),
      to: now,
      timezone,
      granularity: "day",
    };
  }

  private resolveHistoryRange(range: RangeConfig): RangeConfig {
    if (range.key !== "all") {
      return range;
    }

    const to = range.to;
    const from = new Date(to.getTime());
    from.setMonth(from.getMonth() - (DEFAULT_HISTORY_MONTHS - 1));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    return {
      ...range,
      from,
      granularity: "month",
    };
  }

  private resolveCurrentMonthRange(timezone: string) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = Number(parts.find((part) => part.type === "year")?.value || now.getUTCFullYear());
    const month = Number(parts.find((part) => part.type === "month")?.value || now.getUTCMonth() + 1);

    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    return { from, to: now };
  }

  private buildEmptyOverview(
    ownerEmail: string,
    range: RangeConfig,
    rates: RateConfig,
    extras: {
      ownerProfile: {
        firstName: string;
        lastName: string;
        username: string;
        profilePic: string | null;
      };
      referralCode: string;
    }
  ) {
    return {
      owner: {
        email: ownerEmail,
        referralCode: extras.referralCode,
        fullName: this.buildFullName(
          extras.ownerProfile.firstName,
          extras.ownerProfile.lastName
        ),
        firstName: extras.ownerProfile.firstName,
        lastName: extras.ownerProfile.lastName,
        username: extras.ownerProfile.username,
        profilePic: extras.ownerProfile.profilePic,
      },
      range: {
        key: range.key,
        from: range.from ? range.from.toISOString() : null,
        to: range.to.toISOString(),
        timezone: range.timezone,
        historyGranularity: range.granularity,
        historyFrom: range.from ? range.from.toISOString() : null,
        historyTo: range.to.toISOString(),
      },
      totals: {
        lifetime: {
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
        },
        current: {
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
        },
        currentMonth: {
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
        },
        pending: {
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
        },
        withdrawable: {
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
        },
      },
      allocation: {
        rate: {
          model: rates.model,
          admobCpmUsd: rates.admobCpmUsd,
          revenueSharePct: rates.revenueSharePct,
          grossUsdPerAd: rates.grossUsdPerAd,
          usdPerAd: rates.usdPerAd,
          usdPerBtcy: rates.usdPerBtcy,
          btcyPerAd: rates.btcyPerAd,
        },
        referrals: {
          total: 0,
          active: 0,
          inactive: 0,
          activeRatePct: 0,
        },
        topReferrals: [],
      },
      revenueSources: [
        {
          key: "referral_ad_watch",
          label: "Referral Ad Revenue Share",
          adsWatched: 0,
          grossRevenueUsd: 0,
          revenueSharePct: rates.revenueSharePct,
          earningsUsd: 0,
          earningsBtcy: 0,
          sharePct: 0,
        },
      ],
      metrics: {
        averageAdsPerReferral: 0,
        averageAdsPerActiveReferral: 0,
        averageEarningsUsdPerReferral: 0,
        averageEarningsBtcyPerReferral: 0,
        lastAdWatchedAt: null,
        adsWatchedThisMonth: 0,
      },
      history: [],
      referralBreakdown: [],
    };
  }

  private async getRateConfig(): Promise<RateConfig> {
    const [cpm, usdPerBtcy] = await Promise.all([
      admobCpmService.getCpm(),
      this.getBtcyUsdPrice(),
    ]);
    const admobCpmUsd = cpm.rewarded;
    const admobInterstitialCpmUsd = cpm.interstitial;
    const revenueSharePct = this.clampPercentage(keys.miningStation.revenueSharePct);
    const revenueShareRatio = revenueSharePct / 100;
    const grossUsdPerAd = this.roundCurrency(admobCpmUsd / 1000);
    const grossInterstitialUsdPerAd = this.roundCurrency(admobInterstitialCpmUsd / 1000);
    const legacyUsdPerAd = keys.miningStation.legacyEarningUsdPerAd;
    const legacyBtcyPerAd = keys.miningStation.legacyEarningBtcyPerAd;

    if (admobCpmUsd > 0 || admobInterstitialCpmUsd > 0) {
      const usdPerAd = this.roundCurrency(grossUsdPerAd * revenueShareRatio);
      const interstitialUsdPerAd = this.roundCurrency(grossInterstitialUsdPerAd * revenueShareRatio);
      const btcyPerAd = usdPerBtcy ? this.roundToken(usdPerAd / usdPerBtcy) : 0;
      const interstitialBtcyPerAd = usdPerBtcy ? this.roundToken(interstitialUsdPerAd / usdPerBtcy) : 0;

      return {
        model: "admob_cpm_share" as const,
        admobCpmUsd,
        admobInterstitialCpmUsd,
        revenueSharePct,
        revenueShareRatio,
        grossUsdPerAd,
        grossInterstitialUsdPerAd,
        usdPerAd,
        interstitialUsdPerAd,
        usdPerBtcy,
        btcyPerAd,
        interstitialBtcyPerAd,
      };
    }

    return {
      model: "fixed_per_ad" as const,
      admobCpmUsd: 0,
      admobInterstitialCpmUsd: 0,
      revenueSharePct,
      revenueShareRatio,
      grossUsdPerAd: legacyUsdPerAd,
      grossInterstitialUsdPerAd: legacyUsdPerAd,
      usdPerAd: legacyUsdPerAd,
      interstitialUsdPerAd: legacyUsdPerAd,
      usdPerBtcy,
      btcyPerAd: legacyBtcyPerAd || (usdPerBtcy ? this.roundToken(legacyUsdPerAd / usdPerBtcy) : 0),
      interstitialBtcyPerAd: legacyBtcyPerAd || (usdPerBtcy ? this.roundToken(legacyUsdPerAd / usdPerBtcy) : 0),
    };
  }

  private async getBtcyUsdPrice(): Promise<number | null> {
    const now = Date.now();
    if (this.btcyUsdPriceCache && this.btcyUsdPriceCache.expiresAt > now) {
      return this.btcyUsdPriceCache.value;
    }

    try {
      const response = await getPriceByName("BTCY");
      const price = Number((response as any)?.data);
      if (Number.isFinite(price) && price > 0) {
        this.btcyUsdPriceCache = {
          value: price,
          expiresAt: now + 5 * 60 * 1000,
        };
        return price;
      }
      console.warn("[MiningStationEarningsService] Invalid BTCY price response", response);
    } catch (err) {
      console.warn("[MiningStationEarningsService] Failed to resolve BTCY price", err);
    }

    return null;
  }

  private computeRevenue(rewardedCount: number, interstitialCount: number, rates: RateConfig) {
    const grossRevenueUsd = this.roundCurrency(
      rewardedCount * rates.grossUsdPerAd + interstitialCount * rates.grossInterstitialUsdPerAd
    );
    const earningsUsd = this.roundCurrency(
      rewardedCount * rates.usdPerAd + interstitialCount * rates.interstitialUsdPerAd
    );
    const earningsBtcy = this.roundToken(
      rewardedCount * rates.btcyPerAd + interstitialCount * rates.interstitialBtcyPerAd
    );
    return { grossRevenueUsd, earningsUsd, earningsBtcy };
  }

  // Revenue for a single user's own ad watches
  async getUserEarnings(email: string, options: EarningsOverviewOptions = {}) {
    const userEmail = String(email || "").trim().toLowerCase();
    if (!userEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const cacheKey = this.buildCacheKey("user", userEmail, options);

    return this.getCached(cacheKey, async () => {
      const rangeConfig = this.resolveRange(options);
      const rates = await this.getRateConfig();

      const [lifetime, current, currentMonth] = await Promise.all([
        this.aggregateTotals([userEmail], null, rangeConfig.to),
        this.aggregateTotals([userEmail], rangeConfig.from, rangeConfig.to),
        this.aggregateTotals(
          [userEmail],
          this.resolveCurrentMonthRange(rangeConfig.timezone).from,
          rangeConfig.to
        ),
      ]);

      const lifetimeRevenue = this.computeRevenue(
        lifetime.rewardedCount,
        lifetime.interstitialCount,
        rates
      );
      const currentRevenue = this.computeRevenue(
        current.rewardedCount,
        current.interstitialCount,
        rates
      );
      const currentMonthRevenue = this.computeRevenue(
        currentMonth.rewardedCount,
        currentMonth.interstitialCount,
        rates
      );

      return {
        status: 200,
        data: {
          email: userEmail,
          range: {
            key: rangeConfig.key,
            from: rangeConfig.from ? rangeConfig.from.toISOString() : null,
            to: rangeConfig.to.toISOString(),
          },
          lifetime: {
            adsWatched: lifetime.adCount,
            rewardedAdsWatched: lifetime.rewardedCount,
            interstitialAdsWatched: lifetime.interstitialCount,
            ...lifetimeRevenue,
          },
          current: {
            adsWatched: current.adCount,
            rewardedAdsWatched: current.rewardedCount,
            interstitialAdsWatched: current.interstitialCount,
            ...currentRevenue,
          },
          currentMonth: {
            adsWatched: currentMonth.adCount,
            rewardedAdsWatched: currentMonth.rewardedCount,
            interstitialAdsWatched: currentMonth.interstitialCount,
            ...currentMonthRevenue,
          },
          rates: {
            model: rates.model,
            rewardedCpmUsd: rates.admobCpmUsd,
            interstitialCpmUsd: rates.admobInterstitialCpmUsd,
            revenueSharePct: rates.revenueSharePct,
            usdPerBtcy: rates.usdPerBtcy,
          },
        },
      };
    });
  }

  // Revenue for ALL users — admin use
  async getAllUsersEarnings(options: EarningsOverviewOptions & { page?: number; pageSize?: number } = {}) {
    const page = Math.max(0, Number(options.page || 0));
    const pageSize = Math.min(500, Math.max(1, Number(options.pageSize || 100)));
    const cacheKey = this.buildCacheKey("users", "all", {
      ...options,
      page,
      pageSize,
    });

    return this.getCached(cacheKey, async () => {
      const rangeConfig = this.resolveRange(options);
      const rates = await this.getRateConfig();

      const rows = await this.adMiningWatchService.findAggregate<AggregateRow>([
        {
          $match: {
            ...(rangeConfig.from
              ? { timestamp: { $gte: rangeConfig.from, $lte: rangeConfig.to } }
              : { timestamp: { $lte: rangeConfig.to } }),
          },
        },
        {
          $group: {
            _id: "$email",
            adCount: { $sum: 1 },
            rewardedCount: {
              $sum: { $cond: [{ $eq: ["$adType", "rewarded"] }, 1, 0] },
            },
            interstitialCount: {
              $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] },
            },
            lastAdAt: { $max: "$timestamp" },
          },
        },
        { $sort: { adCount: -1, _id: 1 } },
        { $skip: page * pageSize },
        { $limit: pageSize },
      ]);

      const users = rows.map((row) => {
        const rewardedCount = Number(row.rewardedCount || 0);
        const interstitialCount = Number(row.interstitialCount || 0);
        const { grossRevenueUsd, earningsUsd, earningsBtcy } = this.computeRevenue(
          rewardedCount,
          interstitialCount,
          rates
        );
        return {
          email: String(row._id || ""),
          adsWatched: Number(row.adCount || 0),
          rewardedAdsWatched: rewardedCount,
          interstitialAdsWatched: interstitialCount,
          grossRevenueUsd,
          earningsUsd,
          earningsBtcy,
          lastAdWatchedAt: row.lastAdAt ? new Date(row.lastAdAt).toISOString() : null,
        };
      });

      const totalGrossRevenueUsd = this.roundCurrency(
        users.reduce((s, u) => s + u.grossRevenueUsd, 0)
      );
      const totalEarningsUsd = this.roundCurrency(
        users.reduce((s, u) => s + u.earningsUsd, 0)
      );
      const totalAdsWatched = users.reduce((s, u) => s + u.adsWatched, 0);

      return {
        status: 200,
        data: {
          range: {
            key: rangeConfig.key,
            from: rangeConfig.from ? rangeConfig.from.toISOString() : null,
            to: rangeConfig.to.toISOString(),
          },
          pagination: { page, pageSize },
          summary: { totalAdsWatched, totalGrossRevenueUsd, totalEarningsUsd },
          rates: {
            model: rates.model,
            rewardedCpmUsd: rates.admobCpmUsd,
            revenueSharePct: rates.revenueSharePct,
          },
          users,
        },
      };
    });
  }

  async getStationOverview(
    ownerEmailInput: string,
    options: EarningsOverviewOptions = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const cacheKey = this.buildCacheKey("station-overview", ownerEmail, options);

    return this.getCached(cacheKey, async () => {
      const [overviewResult, stationContext, miningData, balance] = await Promise.all([
        this.getOverview(ownerEmail, {
          ...options,
          page: 0,
          pageSize: 20,
        }),
        this.getStationOwnerAndReferrals(ownerEmail),
        this.miningService.getMiningData(ownerEmail, "BTCY"),
        this.userMiningBalanceService.findOne({ email: ownerEmail, coinSymbol: "BTCY" }),
      ]);

      if (overviewResult.status !== 200) {
        return overviewResult;
      }

      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      const overview = overviewResult.data as any;
      const owner = stationContext.owner as any;
      const timezone = String(overview?.range?.timezone || options.timezone || DEFAULT_TIMEZONE);
      const monthRange = this.resolveMonthRange(timezone, 0);
      const previousMonthRange = this.resolveMonthRange(timezone, -1);
      const [
        dailyActiveMiners,
        monthlyGrowthRate,
        currentMonthByReferral,
        previousMonthByReferral,
      ] = await Promise.all([
        this.aggregateDailyActiveMiners(
          stationContext.referralEmails,
          monthRange.from,
          monthRange.to,
          timezone
        ),
        this.aggregateMonthlyReferralGrowth(
          stationContext.referralCode,
          timezone,
          6
        ),
        this.aggregateByReferral(stationContext.referralEmails, monthRange.from, monthRange.to),
        this.aggregateByReferral(stationContext.referralEmails, previousMonthRange.from, previousMonthRange.to),
      ]);
      const adImpressionsHistory = (overview?.history || []).map((entry: any) => ({
        bucket: String(entry?.bucket || ""),
        adsWatched: Number(entry?.adsWatched || 0),
      }));
      const rates = await this.getRateConfig();
      const currentMonthEarningsUsd = Number(overview?.totals?.currentMonth?.earningsUsd || 0);
      const currentMonthEarningsBtcy = Number(overview?.totals?.currentMonth?.earningsBtcy || 0);
      const monthlyVerifiedAdRevenueUsd = Number(overview?.totals?.currentMonth?.grossRevenueUsd || 0);
      const activeMiners = Number(overview?.allocation?.referrals?.active || 0);
      const totalReferrals = Number(overview?.allocation?.referrals?.total || 0);
      const activeCurrentMonth = currentMonthByReferral.filter((row) => Number(row?.adCount || 0) > 0).length;
      const activePreviousMonth = previousMonthByReferral.filter((row) => Number(row?.adCount || 0) > 0).length;
      const currentMonthReferrals = stationContext.referralProfiles.filter((profile) => {
        if (!profile.joinedAt) return false;
        const joinedAt = new Date(profile.joinedAt).getTime();
        return joinedAt >= monthRange.from.getTime() && joinedAt <= monthRange.to.getTime();
      }).length;
      const previousMonthReferrals = stationContext.referralProfiles.filter((profile) => {
        if (!profile.joinedAt) return false;
        const joinedAt = new Date(profile.joinedAt).getTime();
        return joinedAt >= previousMonthRange.from.getTime() && joinedAt <= previousMonthRange.to.getTime();
      }).length;

      return {
        status: 200,
        data: {
          owner: overview.owner,
          qualificationStatus: this.resolveQualificationStatus(owner),
          miningStatus: miningData?.isMiningActive ? "Active" : "Inactive",
          totalMiners: totalReferrals,
          activeMiners,
          totalReferrals,
          activeMinersGrowthPct: this.calculateGrowthPercent(activeCurrentMonth, activePreviousMonth),
          totalReferralsGrowthPct: this.calculateGrowthPercent(currentMonthReferrals, previousMonthReferrals),
          monthlyVerifiedAdRevenue: {
            usd: this.roundCurrency(monthlyVerifiedAdRevenueUsd),
            btcy: rates.usdPerBtcy ? this.roundToken(monthlyVerifiedAdRevenueUsd / rates.usdPerBtcy) : null,
          },
          currentMonthEarnings: this.toEarningsPair(
            currentMonthEarningsUsd,
            currentMonthEarningsBtcy
          ),
          lifetimeEarned: this.toEarningsPair(
            Number(overview?.totals?.lifetime?.earningsUsd || 0),
            Number(overview?.totals?.lifetime?.earningsBtcy || 0)
          ),
          pendingUnverifiedEarnings: this.toEarningsPair(currentMonthEarningsUsd, currentMonthEarningsBtcy),
          availableWithdrawalBalance: this.toAmountPair(
            Number((balance as any)?.adRevenueTransferableBalance || 0),
            rates.usdPerBtcy
          ),
          dailyActiveMiners,
          monthlyGrowthRate,
          adImpressionsHistory,
          totalAdImpressionsThisMonth: Number(overview?.metrics?.adsWatchedThisMonth || 0),
          topReferrals: overview?.allocation?.topReferrals || [],
          range: overview.range,
        },
      };
    });
  }

  async getStationEarnings(
    ownerEmailInput: string,
    options: EarningsOverviewOptions = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const cacheKey = this.buildCacheKey("station-earnings", ownerEmail, options);

    return this.getCached(cacheKey, async () => {
      const [overviewResult, stationContext] = await Promise.all([
        this.getOverview(ownerEmail, {
          ...options,
          page: 0,
          pageSize: 20,
        }),
        this.getStationOwnerAndReferrals(ownerEmail),
      ]);

      if (overviewResult.status !== 200) {
        return overviewResult;
      }

      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      const overview = overviewResult.data as any;
      const timezone = String(overview?.range?.timezone || options.timezone || DEFAULT_TIMEZONE);
      const now = new Date();
      const currentMonthRange = this.resolveMonthRange(timezone, 0);
      const previousMonthRange = this.resolveMonthRange(timezone, -1);

      const trendFrom = new Date();
      trendFrom.setMonth(trendFrom.getMonth() - 5);
      trendFrom.setDate(1);
      trendFrom.setHours(0, 0, 0, 0);

      // Read all earnings data from the history collection (source of truth)
      const [lifetime, currentMonth, previousMonth, rawHistory, balance, rates] = await Promise.all([
        this.earningsHistoryService.getLifetimeTotals(ownerEmail),
        this.earningsHistoryService.getRangeTotals(ownerEmail, currentMonthRange.from, currentMonthRange.to),
        this.earningsHistoryService.getRangeTotals(ownerEmail, previousMonthRange.from, previousMonthRange.to),
        this.earningsHistoryService.getMonthlyHistory(ownerEmail, trendFrom, now, timezone),
        this.userMiningBalanceService.findOne({ email: ownerEmail, coinSymbol: "BTCY" }),
        this.getRateConfig(),
      ]);

      const currentMonthUsd = this.roundCurrency(currentMonth.earningsUsd);
      const currentMonthBtcy = this.roundToken(currentMonth.earningsBtcy);
      const growthUsdDelta = this.roundCurrency(currentMonthUsd - previousMonth.earningsUsd);
      const growthBtcyDelta = this.roundToken(currentMonthBtcy - previousMonth.earningsBtcy);
      const growthPercent = previousMonth.earningsUsd > 0
        ? this.roundRatio(((currentMonthUsd - previousMonth.earningsUsd) / previousMonth.earningsUsd) * 100)
        : currentMonthUsd > 0 ? 100 : 0;

      const historyMapped = rawHistory.map((row) => ({
        bucket:          row.bucket,
        adsWatched:      row.adsWatched,
        grossRevenueUsd: this.roundCurrency(row.grossRevenueUsd),
        earningsUsd:     this.roundCurrency(row.earningsUsd),
        earningsBtcy:    this.roundToken(row.earningsBtcy),
      }));
      const earningsHistory = this.fillMonthBuckets(historyMapped, trendFrom, now, timezone);

      const totalMiners = Number(overview?.allocation?.referrals?.total || 0);
      const revenuePerMinerUsd = totalMiners > 0 ? currentMonthUsd / totalMiners : 0;
      const revenuePerMinerBtcy = totalMiners > 0 ? currentMonthBtcy / totalMiners : 0;

      return {
        status: 200,
        data: {
          lifetimeEarned: this.toEarningsPair(
            this.roundCurrency(lifetime.earningsUsd),
            this.roundToken(lifetime.earningsBtcy)
          ),
          currentMonthEarnings: this.toEarningsPair(currentMonthUsd, currentMonthBtcy),
          pendingUnverified: this.toEarningsPair(currentMonthUsd, currentMonthBtcy),
          availableWithdrawalBalance: this.toAmountPair(
            Number((balance as any)?.adRevenueTransferableBalance || 0),
            rates.usdPerBtcy
          ),
          allocationRate: Number(overview?.allocation?.rate?.revenueSharePct || 0),
          stationTier: null,
          nextPayoutAt: this.resolveNextPayoutAt(timezone),
          earningsHistory,
          revenueSources: [
            {
              key: "adImpressions",
              label: "Ad Impressions",
              grossRevenueUsd: 0,
              earningsUsd: this.roundCurrency(currentMonthUsd),
              earningsBtcy: this.roundToken(currentMonthBtcy),
            },
            {
              key: "referralBonuses",
              label: "Referral Bonuses",
              grossRevenueUsd: 0,
              earningsUsd: 0,
              earningsBtcy: 0,
            },
            {
              key: "performanceBonus",
              label: "Performance Bonus",
              grossRevenueUsd: 0,
              earningsUsd: 0,
              earningsBtcy: 0,
            },
          ],
          adRevenueGenerated: {
            usd: this.roundCurrency(currentMonthUsd),
            btcy: rates.usdPerBtcy ? this.roundToken(currentMonthUsd / rates.usdPerBtcy) : null,
          },
          netAllocation: this.toEarningsPair(currentMonthUsd, currentMonthBtcy),
          revenuePerMiner: this.toEarningsPair(revenuePerMinerUsd, revenuePerMinerBtcy),
          growthVsLastMonth: {
            percent: growthPercent,
            delta: this.toEarningsPair(growthUsdDelta, growthBtcyDelta),
          },
          allocationRateTarget: null,
          range: overview.range,
        },
      };
    });
  }

  async getStationReferrals(
    ownerEmailInput: string,
    options: EarningsOverviewOptions & { page?: number; pageSize?: number } = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const page = Math.max(0, Number(options.page || 0));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize || 20)));
    const cacheKey = this.buildCacheKey("station-referrals", ownerEmail, {
      ...options,
      page,
      pageSize,
    });

    return this.getCached(cacheKey, async () => {
      const stationContext = await this.getStationOwnerAndReferrals(ownerEmail);
      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      const timezone = String(options.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
      const currentRange = this.resolveRange(options);
      const currentMonthRange = this.resolveMonthRange(timezone, 0);
      const rates = await this.getRateConfig();

      if (!stationContext.referralEmails.length) {
        return {
          status: 200,
          data: {
            totals: {
              totalReferrals: 0,
              activeReferrals: 0,
              newReferralsThisMonth: 0,
              earnedThisMonth: this.toEarningsPair(0, 0),
            },
            pagination: {
              page,
              pageSize,
              total: 0,
              totalPages: 0,
            },
            referrals: [],
          },
        };
      }

      const [currentRows, monthRows, miningDataAll] = await Promise.all([
        this.aggregateByReferral(stationContext.referralEmails, currentRange.from, currentRange.to),
        this.aggregateByReferral(stationContext.referralEmails, currentMonthRange.from, currentMonthRange.to),
        this.miningService.getMiningDataBulk(stationContext.referralEmails, "BTCY"),
      ]);

      const currentMap = new Map<string, AggregateRow>();
      const monthMap = new Map<string, AggregateRow>();
      const miningMap = new Map<string, any>();

      for (const row of currentRows) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        currentMap.set(email, row);
      }
      for (const row of monthRows) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        monthMap.set(email, row);
      }
      for (const row of miningDataAll || []) {
        const email = String((row as any)?.email || "").trim().toLowerCase();
        if (!email) continue;
        miningMap.set(email, row);
      }

      const referrals = stationContext.referralProfiles
        .map((profile) => {
          const currentRow = currentMap.get(profile.email);
          const monthRow = monthMap.get(profile.email);
          const miningData = miningMap.get(profile.email);
          const currentRevenue = this.computeRevenue(
            Number(currentRow?.rewardedCount || 0),
            Number(currentRow?.interstitialCount || 0),
            rates
          );
          const monthRevenue = this.computeRevenue(
            Number(monthRow?.rewardedCount || 0),
            Number(monthRow?.interstitialCount || 0),
            rates
          );
          const lastAdWatchedAt = currentRow?.lastAdAt
            ? new Date(currentRow.lastAdAt).toISOString()
            : monthRow?.lastAdAt
              ? new Date(monthRow.lastAdAt).toISOString()
              : null;

          return {
            id: profile.id,
            email: profile.email,
            username: profile.username,
            name: this.buildFullName(profile.firstName, profile.lastName),
            avatarUrl: profile.profilePic,
            joinedAt: profile.joinedAt,
            lastActiveAt: this.pickLatestIso(
              profile.lastActiveAt,
              lastAdWatchedAt,
              this.normalizeDate(miningData?.lastClaimTime)
            ),
            status: miningData?.isMiningActive || Number(monthRow?.adCount || 0) > 0 ? "active" : "inactive",
            adsWatchedCurrentRange: Number(currentRow?.adCount || 0),
            earnedCurrentRange: this.toEarningsPair(
              currentRevenue.earningsUsd,
              currentRevenue.earningsBtcy
            ),
            earnedThisMonth: this.toEarningsPair(
              monthRevenue.earningsUsd,
              monthRevenue.earningsBtcy
            ),
            bonusEarned: this.toEarningsPair(0, 0),
          };
        })
        .sort((left, right) => {
          if (right.adsWatchedCurrentRange !== left.adsWatchedCurrentRange) {
            return right.adsWatchedCurrentRange - left.adsWatchedCurrentRange;
          }
          return left.email.localeCompare(right.email);
        });

      const pagedReferrals = referrals.slice(page * pageSize, (page + 1) * pageSize);
      const newReferralsThisMonth = referrals.filter((item) => {
        if (!item.joinedAt) return false;
        const joinedAt = new Date(item.joinedAt).getTime();
        return joinedAt >= currentMonthRange.from.getTime() && joinedAt <= currentMonthRange.to.getTime();
      }).length;
      const activeReferrals = referrals.filter((item) => item.status === "active").length;
      const earnedThisMonth = referrals.reduce(
        (acc, item) => {
          acc.usd += Number(item.earnedThisMonth.usd || 0);
          acc.btcy += Number(item.earnedThisMonth.btcy || 0);
          return acc;
        },
        { usd: 0, btcy: 0 }
      );

      return {
        status: 200,
        data: {
          totals: {
            totalReferrals: referrals.length,
            activeReferrals,
            newReferralsThisMonth,
            earnedThisMonth: this.toEarningsPair(earnedThisMonth.usd, earnedThisMonth.btcy),
          },
          pagination: {
            page,
            pageSize,
            total: referrals.length,
            totalPages: Math.ceil(referrals.length / pageSize),
          },
          referrals: pagedReferrals,
        },
      };
    });
  }

  async getStationMiners(
    ownerEmailInput: string,
    options: EarningsOverviewOptions & { page?: number; pageSize?: number } = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const page = Math.max(0, Number(options.page || 0));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize || 20)));
    const cacheKey = this.buildCacheKey("station-miners", ownerEmail, {
      ...options,
      page,
      pageSize,
    });

    return this.getCached(cacheKey, async () => {
      const stationContext = await this.getStationOwnerAndReferrals(ownerEmail);
      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      if (!stationContext.referralEmails.length) {
        return {
          status: 200,
          data: {
            totals: {
              totalMiners: 0,
              activeLast7Days: 0,
              avgAdsWatched: 0,
              avgMonthlyAds: 0,
              totalAdsWatched: 0,
            },
            pagination: {
              page,
              pageSize,
              total: 0,
              totalPages: 0,
            },
            miners: [],
          },
        };
      }

      const now = new Date();
      const last7DaysFrom = new Date(now.getTime() - (7 * DAY_MS));
      const last7DaysDate = last7DaysFrom.toISOString().slice(0, 10); // YYYY-MM-DD

      // Query both sources in parallel
      const [
        dailyTotalRows,   // DailyAdDay — rewards/new-watch path
        dailyLast7Rows,
        watchTotalRows,   // AdMiningWatch — mining screen path
        watchLast7Rows,
      ] = await Promise.all([
        this.dailyAdDayService.findAggregate<Array<{ _id: string; total: number; lastWatchedAt: Date | null }>>([
          { $match: { email: { $in: stationContext.referralEmails } } },
          { $group: { _id: "$email", total: { $sum: "$count" }, lastWatchedAt: { $max: "$lastWatchedAt" } } },
        ]),
        this.dailyAdDayService.findAggregate<Array<{ _id: string; total: number }>>([
          { $match: { email: { $in: stationContext.referralEmails }, date: { $gte: last7DaysDate } } },
          { $group: { _id: "$email", total: { $sum: "$count" } } },
        ]),
        this.aggregateByReferral(stationContext.referralEmails, null, now),
        this.aggregateByReferral(stationContext.referralEmails, last7DaysFrom, now),
      ]);

      // Merge: total = DailyAdDay count + AdMiningWatch count
      const totalMap = new Map<string, { total: number; lastWatchedAt: string | null }>();
      const last7Map = new Map<string, number>();

      for (const row of dailyTotalRows as any[]) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        totalMap.set(email, {
          total: Number(row.total || 0),
          lastWatchedAt: row.lastWatchedAt ? new Date(row.lastWatchedAt).toISOString() : null,
        });
      }
      for (const row of watchTotalRows) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        const existing = totalMap.get(email);
        const watchCount = Number(row.adCount || 0);
        const watchLastAt = row.lastAdAt ? new Date(row.lastAdAt).toISOString() : null;
        totalMap.set(email, {
          total: (existing?.total ?? 0) + watchCount,
          lastWatchedAt: this.pickLatestIso(existing?.lastWatchedAt, watchLastAt),
        });
      }
      for (const row of dailyLast7Rows as any[]) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        last7Map.set(email, Number(row.total || 0));
      }
      for (const row of watchLast7Rows) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        last7Map.set(email, (last7Map.get(email) ?? 0) + Number(row.adCount || 0));
      }

      const referralCodeByEmail = new Map<string, string>();
      for (const profile of stationContext.referralProfiles) {
        referralCodeByEmail.set(profile.email, profile.referralCode);
      }

      const sortedMiners = stationContext.referralProfiles
        .map((profile) => {
          const totalEntry = totalMap.get(profile.email);
          const lastAdWatchedAt = totalEntry?.lastWatchedAt ?? null;
          const adsWatchedTotal = totalEntry?.total ?? 0;

          return {
            id: profile.id,
            username: profile.username,
            name: this.buildFullName(profile.firstName, profile.lastName),
            email: profile.email,
            avatarUrl: profile.profilePic,
            joinedAt: profile.joinedAt,
            lastActiveAt: this.pickLatestIso(
              profile.lastActiveAt,
              lastAdWatchedAt,
              null
            ),
            isMining: false,
            adsWatchedTotal,
            adsWatchedMonthly: adsWatchedTotal,
            referralsCount: 0,
          };
        })
        .sort((left, right) => {
          if (right.adsWatchedTotal !== left.adsWatchedTotal) {
            return right.adsWatchedTotal - left.adsWatchedTotal;
          }
          return left.email.localeCompare(right.email);
        });

      const pagedMiners = sortedMiners.slice(page * pageSize, (page + 1) * pageSize);
      const pagedEmails = pagedMiners.map((miner) => miner.email);
      const [miningDataPage, referralCountsByCode] = await Promise.all([
        this.miningService.getMiningDataBulk(pagedEmails, "BTCY"),
        this.getReferralCountsByCode(
          pagedMiners
            .map((miner) => referralCodeByEmail.get(miner.email))
            .filter((code): code is string => Boolean(code))
        ),
      ]);
      const miningMap = new Map<string, any>();
      for (const row of miningDataPage || []) {
        const email = String((row as any)?.email || "").trim().toLowerCase();
        if (email) {
          miningMap.set(email, row);
        }
      }

      return {
        status: 200,
        data: {
          totals: {
            totalMiners: sortedMiners.length,
            activeLast7Days: sortedMiners.filter((miner) => (last7Map.get(miner.email) ?? 0) > 0).length,
            avgAdsWatched: sortedMiners.length > 0
              ? this.roundRatio(sortedMiners.reduce((sum, miner) => sum + miner.adsWatchedTotal, 0) / sortedMiners.length)
              : 0,
            avgMonthlyAds: sortedMiners.length > 0
              ? this.roundRatio(sortedMiners.reduce((sum, miner) => sum + miner.adsWatchedTotal, 0) / sortedMiners.length)
              : 0,
            totalAdsWatched: sortedMiners.reduce((sum, miner) => sum + miner.adsWatchedTotal, 0),
          },
          pagination: {
            page,
            pageSize,
            total: sortedMiners.length,
            totalPages: Math.ceil(sortedMiners.length / pageSize),
          },
          miners: pagedMiners.map((miner) => ({
            ...miner,
            lastActiveAt: this.pickLatestIso(
              miner.lastActiveAt,
              this.normalizeDate(miningMap.get(miner.email)?.lastClaimTime)
            ),
            isMining: Boolean(miningMap.get(miner.email)?.isMiningActive),
            referralsCount:
              referralCountsByCode.get(referralCodeByEmail.get(miner.email) || "") || 0,
          })),
        },
      };
    });
  }

  async getStationAnalytics(
    ownerEmailInput: string,
    options: EarningsOverviewOptions = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const cacheKey = this.buildCacheKey("station-analytics", ownerEmail, options);

    return this.getCached(cacheKey, async () => {
      const stationContext = await this.getStationOwnerAndReferrals(ownerEmail);
      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      const timezone = String(options.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
      const currentMonthRange = this.resolveMonthRange(timezone, 0);
      const previousMonthRange = this.resolveMonthRange(timezone, -1);
      const rates = await this.getRateConfig();

      if (!stationContext.referralEmails.length) {
        return {
          status: 200,
          data: {
            revenueGrowthPercent: 0,
            revenueGrowthDelta: 0,
            avgDailyActive: 0,
            avgAdImpressionsPerDay: 0,
            engagementRate: 0,
            revenueTrend: [],
            minerActivityByHour: Array.from({ length: 24 }, (_, hour) => ({
              hour,
              adsWatched: 0,
              activeMiners: 0,
            })),
            engagementDistribution: [],
            weeklyReferralPerformance: [],
          },
        };
      }

      const trendFrom = new Date();
      trendFrom.setMonth(trendFrom.getMonth() - 11);
      trendFrom.setDate(1);
      trendFrom.setHours(0, 0, 0, 0);

      const weeklyFrom = new Date(Date.now() - (8 * 7 * DAY_MS));

      const [
        currentMonthTotals,
        previousMonthTotals,
        dailyActiveRows,
        currentMonthByReferral,
        revenueTrendRows,
        minerActivityByHour,
        weeklyReferralPerformance,
      ] = await Promise.all([
        this.aggregateTotals(stationContext.referralEmails, currentMonthRange.from, currentMonthRange.to),
        this.aggregateTotals(stationContext.referralEmails, previousMonthRange.from, previousMonthRange.to),
        this.aggregateDailyActiveMiners(stationContext.referralEmails, currentMonthRange.from, currentMonthRange.to, timezone),
        this.aggregateByReferral(stationContext.referralEmails, currentMonthRange.from, currentMonthRange.to),
        this.aggregateHistory(stationContext.referralEmails, trendFrom, new Date(), timezone, "month"),
        this.aggregateMinerActivityByHour(stationContext.referralEmails, currentMonthRange.from, currentMonthRange.to, timezone),
        this.aggregateWeeklyPerformance(stationContext.referralEmails, weeklyFrom, new Date(), timezone, rates),
      ]);

      const currentMonthRevenue = this.computeRevenue(
        currentMonthTotals.rewardedCount,
        currentMonthTotals.interstitialCount,
        rates
      );
      const previousMonthRevenue = this.computeRevenue(
        previousMonthTotals.rewardedCount,
        previousMonthTotals.interstitialCount,
        rates
      );
      const revenueGrowthDelta = this.roundCurrency(currentMonthRevenue.earningsUsd - previousMonthRevenue.earningsUsd);
      const revenueGrowthPercent = previousMonthRevenue.earningsUsd > 0
        ? this.roundRatio(((currentMonthRevenue.earningsUsd - previousMonthRevenue.earningsUsd) / previousMonthRevenue.earningsUsd) * 100)
        : currentMonthRevenue.earningsUsd > 0
          ? 100
          : 0;
      const avgDailyActive = dailyActiveRows.length > 0
        ? this.roundRatio(dailyActiveRows.reduce((sum, row) => sum + row.activeMiners, 0) / dailyActiveRows.length)
        : 0;
      const daySpan = Math.max(1, Math.ceil((currentMonthRange.to.getTime() - currentMonthRange.from.getTime()) / DAY_MS));
      const avgAdImpressionsPerDay = this.roundRatio(Number(currentMonthTotals.adCount || 0) / daySpan);
      const activeCurrentMonth = currentMonthByReferral.filter((row) => Number(row.adCount || 0) > 0).length;
      const engagementRate = stationContext.referralProfiles.length > 0
        ? this.roundRatio((activeCurrentMonth / stationContext.referralProfiles.length) * 100)
        : 0;

      const currentMonthMap = new Map<string, AggregateRow>();
      for (const row of currentMonthByReferral) {
        const email = String(row._id || "").trim().toLowerCase();
        if (!email) continue;
        currentMonthMap.set(email, row);
      }

      const engagementBuckets = [
        { key: "0", label: "0 ads", min: 0, max: 0 },
        { key: "1-10", label: "1-10 ads", min: 1, max: 10 },
        { key: "11-25", label: "11-25 ads", min: 11, max: 25 },
        { key: "26+", label: "26+ ads", min: 26, max: Number.POSITIVE_INFINITY },
      ];

      const engagementDistribution = engagementBuckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        miners: stationContext.referralProfiles.filter((profile) => {
          const count = Number(currentMonthMap.get(profile.email)?.adCount || 0);
          return count >= bucket.min && count <= bucket.max;
        }).length,
      }));

      return {
        status: 200,
        data: {
          revenueGrowthPercent,
          revenueGrowthDelta,
          avgDailyActive,
          avgAdImpressionsPerDay,
          engagementRate,
          revenueTrend: revenueTrendRows.map((row) => {
            const revenue = this.computeRevenue(
              Number(row.rewardedCount || 0),
              Number(row.interstitialCount || 0),
              rates
            );

            return {
              bucket: String(row._id || ""),
              adsWatched: Number(row.adCount || 0),
              grossRevenueUsd: revenue.grossRevenueUsd,
              earningsUsd: revenue.earningsUsd,
              earningsBtcy: revenue.earningsBtcy,
            };
          }),
          minerActivityByHour,
          engagementDistribution,
          weeklyReferralPerformance,
        },
      };
    });
  }

  async getStationWithdrawals(
    ownerEmailInput: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const page = Math.max(0, Number(options.page || 0));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize || 20)));
    const cacheKey = this.buildCacheKey("station-withdrawals", ownerEmail, {
      page,
      pageSize,
    });

    return this.getCached(cacheKey, async () => {
      const rates = await this.getRateConfig();
      const [withdrawalBalance, stationContext, total, withdrawalHistory, pendingSummary] = await Promise.all([
        this.getAvailableAdRevenueWithdrawalBalance(ownerEmail, rates),
        this.getStationOwnerAndReferrals(ownerEmail),
        this.withdrawService.findCount({ email: ownerEmail }),
        this.withdrawService.findPaginatedSkip(
          pageSize,
          page * pageSize,
          { createdAt: -1 },
          { email: ownerEmail },
          {}
        ),
        this.getPendingWithdrawalSummary(ownerEmail),
      ]);

      const owner = withdrawalBalance.owner as any;
      if (!owner) {
        return { status: 404, data: { message: "User not found" } };
      }

      const accessError = this.validateStationAccess(stationContext);
      if (accessError) {
        return accessError;
      }

      return {
        status: 200,
        data: {
          availableWithdrawalBalance: this.toAmountPair(
            rates.usdPerBtcy ? withdrawalBalance.availableUsd / rates.usdPerBtcy : 0,
            rates.usdPerBtcy
          ),
          lifetimeAdRevenueBalance: this.toAmountPair(
            rates.usdPerBtcy ? withdrawalBalance.lifetimeEarningsUsd / rates.usdPerBtcy : 0,
            rates.usdPerBtcy
          ),
          committedWithdrawalBalance: this.toAmountPair(
            rates.usdPerBtcy ? withdrawalBalance.committedUsd / rates.usdPerBtcy : 0,
            rates.usdPerBtcy
          ),
          minimumWithdrawal: this.toUsdAmountPair(MIN_WITHDRAWAL_USD, rates.usdPerBtcy),
          maximumWithdrawal: this.toUsdAmountPair(MAX_WITHDRAWAL_USD, rates.usdPerBtcy),
          supportedMethods: [
            { key: "usdt", label: "USDT", feePct: 10, network: "Solana Network", requiresWalletAddress: true },
            { key: "usdc", label: "USDC", feePct: 10, network: "Solana Network", requiresWalletAddress: true },
            { key: "btcy", label: "BTCY", feePct: 3, network: INTERNAL_BTCY_NETWORK, requiresWalletAddress: false },
          ],
          savedPayoutDestinations: Array.isArray((owner as any)?.userWallets)
            ? (owner as any).userWallets
              .filter((wallet: any) => String(wallet?.coinSymbol || "").toUpperCase() === "BTCY")
              .map((wallet: any) => ({
                coinSymbol: wallet?.coinSymbol || "BTCY",
                network: wallet?.coinNetwork || null,
                address: wallet?.coinWalletAddress || "",
              }))
            : [],
          pendingWithdrawalSummary: {
            count: Number(pendingSummary?.count || 0),
            requestedAmount: this.toAmountPair(
              rates.usdPerBtcy ? Number(pendingSummary?.requestedAmount || 0) / rates.usdPerBtcy : 0,
              rates.usdPerBtcy
            ),
            approvedAmount: this.toAmountPair(
              rates.usdPerBtcy ? Number(pendingSummary?.approvedAmount || 0) / rates.usdPerBtcy : 0,
              rates.usdPerBtcy
            ),
          },
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
          withdrawalHistory: (withdrawalHistory || []).map((row: any) => ({
            orderId: String(row?.orderId || ""),
            requestedAmount: this.toUsdAmountPair(Number(row?.requestedAmountUsd ?? row?.requestedAmount ?? 0), rates.usdPerBtcy),
            approvedAmount: this.toUsdAmountPair(Number(row?.approvedAmountUsd ?? row?.approvedAmount ?? 0), rates.usdPerBtcy),
            payoutAmount: Number(row?.payoutAmount || 0),
            payoutCurrency: String(row?.payoutCurrency || row?.withdrawalMethod || ""),
            feeAmountUsd: Number(row?.feeAmountUsd || 0),
            feePercentage: Number(row?.feePercentage || 0),
            source: String(row?.source || ""),
            status: String(row?.status || ""),
            withdrawalMethod: String(row?.withdrawalMethod || ""),
            walletAddress: String(row?.walletAddress || row?.withdrawalAddress || ""),
            network: String(row?.network || row?.targetNetwork || ""),
            createdAt: this.normalizeDate(row?.createdAt),
            processedAt: this.normalizeDate(row?.processedAt),
            txHash: row?.txHash || "",
          })),
        },
      };
    });
  }

  async submitStationWithdrawal(
    ownerEmailInput: string,
    payload: { amount?: number; method?: string; walletAddress?: string; network?: string }
  ) {
    const ownerEmail = String(ownerEmailInput || "").trim().toLowerCase();
    if (!ownerEmail) {
      return { status: 400, data: { message: "email is required" } };
    }

    const amountUsd = Number(payload?.amount || 0);
    const methodInput = String(payload?.method || "").trim().toLowerCase();
    const methodConfig = [
      { key: "usdt", withdrawalMethod: "USDT", requiresWalletAddress: true, network: "Solana Network" },
      { key: "usdc", withdrawalMethod: "USDC", requiresWalletAddress: true, network: "Solana Network" },
      { key: "btcy", withdrawalMethod: "BTCY", requiresWalletAddress: false, network: INTERNAL_BTCY_NETWORK },
    ].find((entry) => entry.key === methodInput);
    const walletAddress = String(payload?.walletAddress || "").trim();

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return { status: 400, data: { message: "amount must be greater than 0" } };
    }

    if (amountUsd < MIN_WITHDRAWAL_USD) {
      return { status: 400, data: { message: `Minimum withdrawal is $${MIN_WITHDRAWAL_USD}` } };
    }

    if (amountUsd > MAX_WITHDRAWAL_USD) {
      return { status: 400, data: { message: `Maximum withdrawal is $${MAX_WITHDRAWAL_USD}` } };
    }

    if (!methodConfig) {
      return { status: 400, data: { message: "method must be USDT, USDC, or BTCY" } };
    }

    if (methodConfig.requiresWalletAddress && !walletAddress) {
      return { status: 400, data: { message: "walletAddress is required for this withdrawal method" } };
    }

    const [rates, owner, miningBalance] = await Promise.all([
      this.getRateConfig(),
      this.userService.findOneSelect({ email: ownerEmail }, { email: 1 }),
      this.userMiningBalanceService.findOne({ email: ownerEmail, coinSymbol: "BTCY" }),
    ]);

    if (!owner) {
      return { status: 404, data: { message: "User not found" } };
    }

    if (!rates.usdPerBtcy) {
      return { status: 400, data: { message: "BTCY USD rate is not configured" } };
    }

    const availableBtcy = Number((miningBalance as any)?.adRevenueTransferableBalance || 0);
    const availableUsd = this.roundCurrency(availableBtcy * rates.usdPerBtcy);

    if (availableUsd < amountUsd) {
      return {
        status: 400,
        data: {
          message: "Insufficient available ad revenue withdrawal balance.",
          availableWithdrawalBalance: this.toAmountPair(availableBtcy, rates.usdPerBtcy),
          requestedAmount: this.toUsdAmountPair(amountUsd, rates.usdPerBtcy),
        },
      };
    }

    const result = await this.withdrawService.requestAdRevenueWithdrawal(
      ownerEmail,
      amountUsd,
      methodConfig.withdrawalMethod as any,
      {
        walletAddress,
        network: methodConfig.network || payload?.network,
        usdPerBtcy: rates.usdPerBtcy,
      }
    );
    if (Number(result?.status || 500) === 200) {
      if (methodConfig.withdrawalMethod === "BTCY") {
        await this.creditInternalBtcyWallet(ownerEmail, Number(result?.data?.payoutAmount || 0), rates.usdPerBtcy);
      }
      this.invalidateOwnerCaches(ownerEmail);
    }
    return {
      status: Number(result?.status || 500),
      data: {
        message: result?.message || "Withdrawal request failed",
        withdrawal: result?.data || null,
      },
    };
  }

  private async creditInternalBtcyWallet(ownerEmail: string, amountBtcy: number, usdPerBtcy: number) {
    const normalizedEmail = String(ownerEmail || "").trim().toLowerCase();
    const normalizedAmount = this.roundToken(amountBtcy);
    if (!normalizedEmail || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return;
    }

    const coinBalanceInUSD = this.roundCurrency(normalizedAmount * usdPerBtcy);
    const walletFilter = {
      email: normalizedEmail,
      userWallets: {
        $elemMatch: {
          coinSymbol: "BTCY",
          coinNetwork: INTERNAL_BTCY_NETWORK,
        },
      },
    };

    const updated = await this.userService.updatePartWithOptions(
      walletFilter,
      {
        $inc: {
          "userWallets.$[wallet].coinBalance": normalizedAmount,
          "userWallets.$[wallet].coinBalanceInUSD": coinBalanceInUSD,
        },
        $set: {
          "userWallets.$[wallet].coinLastUsedOn": new Date(),
          "userWallets.$[wallet].isCoinActive": true,
        },
      },
      {
        arrayFilters: [
          {
            "wallet.coinSymbol": "BTCY",
            "wallet.coinNetwork": INTERNAL_BTCY_NETWORK,
          },
        ],
      }
    );

    if (Number((updated as any)?.modifiedCount || 0) > 0) {
      return;
    }

    await this.userService.updatePart(
      { email: normalizedEmail },
      {
        $push: {
          userWallets: {
            userId: "",
            coinType: "Crypto",
            coinWalletAddress: "",
            coinPrivateKey: "",
            coinNetwork: INTERNAL_BTCY_NETWORK,
            coinName: "Bitcoin Yay",
            coinSymbol: "BTCY",
            coinDecimals: 8,
            coinStakedBalance: 0,
            coinBalance: normalizedAmount,
            coinBalanceInUSD,
            coinBalanceInBTC: 0,
            coinCreatedOn: new Date(),
            coinLastUsedOn: new Date(),
            coinPrice: usdPerBtcy,
            coinPrevPrice: usdPerBtcy,
            isCoinActive: true,
          },
        },
      }
    );
  }

  private fillMonthBuckets(
    history: Array<{ bucket: string; adsWatched: number; grossRevenueUsd: number; earningsUsd: number; earningsBtcy: number }>,
    from: Date,
    to: Date,
    timezone: string
  ) {
    const bucketMap = new Map(history.map((h) => [h.bucket, h]));
    const result: typeof history = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

    while (cursor <= end) {
      const bucket = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
      }).format(cursor).slice(0, 7); // YYYY-MM

      result.push(
        bucketMap.get(bucket) ?? {
          bucket,
          adsWatched: 0,
          grossRevenueUsd: 0,
          earningsUsd: 0,
          earningsBtcy: 0,
        }
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return result;
  }

  private clampPercentage(value: number) {
    if (!Number.isFinite(value)) {
      return keys.miningStation.revenueSharePct;
    }

    return Math.min(Math.max(value, 0), 100);
  }

  private parseDate(value: string | undefined) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private extractDays(range: string) {
    const match = /^(\d+)d$/.exec(range);
    if (!match) return null;

    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    return Math.min(Math.max(Math.floor(parsed), 1), 365);
  }

  private buildFullName(firstName: string, lastName: string) {
    return `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();
  }

  private roundCurrency(value: number) {
    return Number((Number.isFinite(value) ? value : 0).toFixed(2));
  }

  private roundToken(value: number) {
    return Number((Number.isFinite(value) ? value : 0).toFixed(6));
  }

  private roundRatio(value: number) {
    return Number((Number.isFinite(value) ? value : 0).toFixed(2));
  }
}
