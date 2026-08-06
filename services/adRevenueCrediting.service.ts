import { UserMiningBalanceService } from "./userMiningBalance.service";
import { UserService } from "./user.service";
import { admobCpmService } from "./admobCpm.service";
import { StationEarningsHistoryService } from "./stationEarningsHistory.service";
import { getPriceByName } from "../controllers/priceAPI";
import { keys } from "../config/keys";
import { ensureRedisConnected } from "../cache/redisClient";

const REVENUE_GENERATING_TYPES = new Set(["rewarded", "interstitial"]);

class AdRevenueCreditingService {
  private readonly userService = new UserService();
  private readonly balanceService = new UserMiningBalanceService();
  private readonly historyService = new StationEarningsHistoryService();
  private btcyPriceCache: { value: number; expiresAt: number } | null = null;

  async creditAdWatch(minerEmail: string, adType: string): Promise<void> {
    const normalizedType = String(adType || "").toLowerCase();
    if (!REVENUE_GENERATING_TYPES.has(normalizedType)) return;

    // 1. Find the miner's referralCodeUsed
    const miner = await this.userService.findOneSelect(
      { email: minerEmail },
      { referralCodeUsed: 1 }
    );
    const referralCodeUsed = String((miner as any)?.referralCodeUsed || "").trim();
    if (!referralCodeUsed) return;

    // 2. Find the station owner who owns that referral code
    const owner = await this.userService.findOneSelect(
      { referralCode: referralCodeUsed },
      { email: 1 }
    );
    const ownerEmail = String((owner as any)?.email || "").trim().toLowerCase();
    if (!ownerEmail) return;

    // 3. Resolve CPM and BTCY price (both cached)
    const [cpm, usdPerBtcy] = await Promise.all([
      admobCpmService.getCpm(),
      this.getBtcyPrice(),
    ]);

    const cpmUsd = normalizedType === "rewarded" ? cpm.rewarded : cpm.interstitial;
    if (cpmUsd <= 0 || !usdPerBtcy || usdPerBtcy <= 0) return;

    // 4. Calculate station owner's earnings for this single ad watch
    const revenueSharePct = keys.miningStation.revenueSharePct;
    const grossUsdPerAd = cpmUsd / 1000;
    const earningsUsd = grossUsdPerAd * (revenueSharePct / 100);
    const earningsBtcy = earningsUsd / usdPerBtcy;
    if (earningsBtcy <= 0) return;
    const now = new Date();

    // 5. Write history record and increment balance atomically
    await Promise.all([
      this.historyService.create({
        ownerEmail,
        minerEmail,
        adType: normalizedType,
        cpmUsd,
        revenueSharePct,
        grossUsdPerAd,
        earningsUsd,
        earningsBtcy,
        usdPerBtcy,
        createdAt: now,
      }),
      this.balanceService.updatePartWithOptions(
        { email: ownerEmail, coinSymbol: "BTCY" },
        {
          $inc: { adRevenueTransferableBalance: earningsBtcy },
          $setOnInsert: {
            email: ownerEmail,
            coinSymbol: "BTCY",
            coinName: "Bitcoin Yay",
            coinNetwork: "Stellar",
            transferableBalance: 0,
            migratedBalance: 0,
            unverifiedBalance: 0,
            createdAt: now,
          },
        },
        { upsert: true }
      ),
    ]);

    // Invalidate the owner's station caches so miners page reflects the new ad count immediately
    this.invalidateOwnerCaches(ownerEmail);

    console.log(
      `[AdRevenueCrediting] +${earningsBtcy.toFixed(6)} BTCY → ${ownerEmail} (miner=${minerEmail} adType=${normalizedType})`
    );
  }

  private invalidateOwnerCaches(ownerEmail: string) {
    ensureRedisConnected().then((redis) => {
      const patterns = [
        `earnings:station-miners:${ownerEmail}:*`,
        `earnings:station-overview:${ownerEmail}:*`,
        `earnings:station-earnings:${ownerEmail}:*`,
        `earnings:station-analytics:${ownerEmail}:*`,
        `earnings:station-context:${ownerEmail}:*`,
      ];
      Promise.all(
        patterns.map((pattern) =>
          redis.keys(pattern).then((keys) => keys.length ? (redis as any).del(keys) : null)
        )
      ).catch(() => {});
    }).catch(() => {});
  }

  private async getBtcyPrice(): Promise<number | null> {
    const now = Date.now();
    if (this.btcyPriceCache && this.btcyPriceCache.expiresAt > now) {
      return this.btcyPriceCache.value;
    }
    try {
      const response = await getPriceByName("BTCY");
      const price = Number((response as any)?.data);
      if (Number.isFinite(price) && price > 0) {
        this.btcyPriceCache = { value: price, expiresAt: now + 5 * 60 * 1000 };
        return price;
      }
    } catch {}
    return null;
  }
}

export const adRevenueCreditingService = new AdRevenueCreditingService();
