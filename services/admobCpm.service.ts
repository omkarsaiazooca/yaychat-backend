import { google } from "googleapis";
import { ensureRedisConnected } from "../cache/redisClient";
import { keys } from "../config/keys";

const CACHE_KEY_REWARDED = "admob:cpm:rewarded";
const CACHE_KEY_INTERSTITIAL = "admob:cpm:interstitial";
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const LOOKBACK_DAYS = 7;

export type AdmobCpmResult = {
  rewarded: number;
  interstitial: number;
  source: "api" | "cache" | "env";
};

class AdmobCpmService {
  private pendingRefresh: Promise<AdmobCpmResult> | null = null;

  private isConfigured(): boolean {
    const { publisherId, clientId, clientSecret, refreshToken } = keys.admobApi;
    return !!(publisherId && clientId && clientSecret && refreshToken);
  }

  private envFallback(): AdmobCpmResult {
    return {
      rewarded: keys.miningStation.admobRewardedCpmUsd,
      interstitial: keys.miningStation.admobInterstitialCpmUsd,
      source: "env",
    };
  }

  private async fetchFromApi(): Promise<AdmobCpmResult | null> {
    if (!this.isConfigured()) return null;

    const { publisherId, clientId, clientSecret, refreshToken } = keys.admobApi;

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    const admob = google.admob({ version: "v1", auth });

    const now = new Date();
    const start = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const response = await admob.accounts.networkReport.generate({
      parent: `accounts/${publisherId}`,
      requestBody: {
        reportSpec: {
          dateRange: {
            startDate: {
              year: start.getFullYear(),
              month: start.getMonth() + 1,
              day: start.getDate(),
            },
            endDate: {
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              day: now.getDate(),
            },
          },
          dimensions: ["FORMAT"],
          metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS"],
        },
      },
    });

    let rewardedEarnings = 0;
    let rewardedImpressions = 0;
    let interstitialEarnings = 0;
    let interstitialImpressions = 0;

    for (const entry of (response.data as any[]) || []) {
      const row = entry?.row;
      if (!row) continue;

      const format = String(row.dimensionValues?.FORMAT?.value || "").toUpperCase();
      // ESTIMATED_EARNINGS is in micros of the account currency (USD)
      const earningsUsd = Number(row.metricValues?.ESTIMATED_EARNINGS?.microsValue || 0) / 1_000_000;
      const impressions = Number(row.metricValues?.IMPRESSIONS?.integerValue || 0);

      if (format === "REWARDED" || format === "REWARDED_VIDEO") {
        rewardedEarnings += earningsUsd;
        rewardedImpressions += impressions;
      } else if (format === "INTERSTITIAL") {
        interstitialEarnings += earningsUsd;
        interstitialImpressions += impressions;
      }
    }

    const rewarded = rewardedImpressions > 0
      ? Number(((rewardedEarnings / rewardedImpressions) * 1000).toFixed(4))
      : 0;
    const interstitial = interstitialImpressions > 0
      ? Number(((interstitialEarnings / interstitialImpressions) * 1000).toFixed(4))
      : 0;

    return { rewarded, interstitial, source: "api" };
  }

  private async refreshAndStore(): Promise<AdmobCpmResult> {
    const fallback = this.envFallback();

    try {
      const apiResult = await this.fetchFromApi();
      if (!apiResult) return fallback;

      // If the API returned 0 for a type (no impressions in window), keep the env fallback for that type
      const rewarded = apiResult.rewarded > 0 ? apiResult.rewarded : fallback.rewarded;
      const interstitial = apiResult.interstitial > 0 ? apiResult.interstitial : fallback.interstitial;

      try {
        const redis = await ensureRedisConnected();
        await Promise.all([
          redis.set(CACHE_KEY_REWARDED, String(rewarded), { EX: CACHE_TTL_SECONDS }),
          redis.set(CACHE_KEY_INTERSTITIAL, String(interstitial), { EX: CACHE_TTL_SECONDS }),
        ]);
      } catch {
        // Redis unavailable — return result without caching
      }

      return { rewarded, interstitial, source: "api" };
    } catch (err) {
      console.warn("[AdmobCpmService] Failed to fetch CPM from AdMob API:", err);
      return fallback;
    }
  }

  async getCpm(): Promise<AdmobCpmResult> {
    // 1. Try Redis cache
    try {
      const redis = await ensureRedisConnected();
      const [cachedRewarded, cachedInterstitial] = await Promise.all([
        redis.get(CACHE_KEY_REWARDED),
        redis.get(CACHE_KEY_INTERSTITIAL),
      ]);

      if (cachedRewarded !== null && cachedInterstitial !== null) {
        return {
          rewarded: Number(cachedRewarded),
          interstitial: Number(cachedInterstitial),
          source: "cache",
        };
      }
    } catch {
      // Redis unavailable — fall through to API
    }

    // 2. Coalesce concurrent cache-miss requests into one API call
    if (!this.pendingRefresh) {
      this.pendingRefresh = this.refreshAndStore().finally(() => {
        this.pendingRefresh = null;
      });
    }

    return this.pendingRefresh;
  }

  // Force a fresh fetch from the AdMob API and update the cache.
  // Useful for an admin endpoint or a nightly cron job.
  async refreshNow(): Promise<AdmobCpmResult> {
    return this.refreshAndStore();
  }
}

export const admobCpmService = new AdmobCpmService();
