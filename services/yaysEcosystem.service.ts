import { MiningService } from "./mining.service";
import { UserMiningBalanceService } from "./userMiningBalance.service";
import { AlchemyPoolService } from "./alchemyPool.service";
import { MiningStreakService } from "./miningStreak.service";
import { AdMiningWatchService } from "./adMiningWatch.service";
import { ShopOrdersService } from "./shop.order.service";
import { UserService } from "./user.service";
import { getNuggetEligibilityForEmmm } from "./emmmNuggetEligibility.service";
import { yaysReferrals, MINING_STATION_REFERRAL_TARGET } from "./yaysReferral.service";
import { getEmmmSnapshot, getShoperpalSnapshot } from "./ecosystemRemote.service";

/**
 * Read-only snapshots of the user's state across the Indexx ecosystem.
 *
 * YaysApp is a viewer here, never a writer: every figure comes from the product
 * that owns it (mining, nuggets, the alchemy pool, ShoperPal orders) and every
 * action deep-links out to that product.
 *
 * The rule that shapes the whole module: **a value with no real source is
 * reported as unavailable, not invented.** These screens sit next to balances
 * and reward progress, and a plausible-looking number that nothing backs is
 * indistinguishable from a real one — the user would plan around it.
 * `null` on the wire means "we could not read this", which the client renders
 * as an em dash.
 */

const BTCY = "BTCY";

/** A field the client renders as "—" rather than as a number. */
export type Unavailable = null;

export interface BtcySnapshot {
  mining: {
    active: boolean;
    /** Multiplier from the user's plan, e.g. 1 or 9. Null when unreadable. */
    speed: number | Unavailable;
    plan: string | Unavailable;
    /** Seconds left in the current cycle; null when not mining. */
    endsInSeconds: number | Unavailable;
    streakDays: number | Unavailable;
  };
  portfolio: {
    nuggets: number | Unavailable;
    tokens: number | Unavailable;
    totalMined: number | Unavailable;
  };
  alchemy: { currentUsd: number | Unavailable; targetUsd: number | Unavailable };
  referrals: { active: number; target: number };
  station: { unlocked: boolean };
  watchEarn: {
    watched: number | Unavailable;
    total: number | Unavailable;
    nuggetsToday: number | Unavailable;
  };
}

export interface ShoperpalSnapshot {
  buyer: {
    monthSpend: number | Unavailable;
    orderCount: number | Unavailable;
    nuggetBalance: number | Unavailable;
  };
  supplier: Record<string, unknown> | null;
}

export interface EmmmSnapshot {
  /**
   * What this backend genuinely knows about EMMM: whether the user's nuggets
   * qualify them to play. Slate, jackpot, ticket, and accuracy live in the EMMM
   * product and need its API — reported as null rather than guessed.
   */
  eligibility: {
    eligible: boolean;
    nuggetBalance: number;
    totalMined: number;
    maxBetNuggets: number;
    reason: string | null;
  } | Unavailable;
  slate: Record<string, unknown> | null;
  accuracy: Record<string, unknown> | null;
  ticket: Record<string, unknown> | null;
}

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const startOfMonth = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const startOfUtcDay = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Run a source, returning `null` if it fails.
 *
 * Each field of these dashboards comes from a different service. One being down
 * must degrade that field to an em dash, not blank the whole screen — a member
 * checking their mining status should still see it when, say, the shop service
 * is unavailable.
 */
const soft = async <T>(label: string, load: () => Promise<T>): Promise<T | null> => {
  try {
    return await load();
  } catch (error) {
    console.error(`[yays/ecosystem] ${label} unavailable`, error);
    return null;
  }
};

export class YaysEcosystemService {
  private mining = new MiningService();
  private balances = new UserMiningBalanceService();
  private pools = new AlchemyPoolService();
  private streaks = new MiningStreakService();
  private adWatch = new AdMiningWatchService();
  private orders = new ShopOrdersService();
  private users = new UserService();

  async btcy(userLower: string): Promise<BtcySnapshot> {
    const [miningData, balance, pool, streak, adsToday, referralStats] =
      await Promise.all([
        soft("mining", () => this.mining.getMiningData(userLower, BTCY)),
        soft("balance", () =>
          this.balances.findOne({ email: userLower, coinSymbol: BTCY })
        ),
        soft("alchemy pool", () => this.pools.getActivePool()),
        soft("streak", () => this.streaks.getEffectiveStreak(userLower)),
        soft("ad watch", () =>
          this.adWatch.getAdCount(userLower, startOfUtcDay(), new Date())
        ),
        soft("referrals", () => yaysReferrals.statsFor(userLower)),
      ]);

    const active = Boolean((miningData as any)?.isMiningActive);
    const startTime = (miningData as any)?.startTime;
    const sessionHours = num((miningData as any)?.sessionDurationHours) ?? 24;

    // Remaining cycle time is derived rather than stored, so it stays correct
    // regardless of when the row was last written.
    let endsInSeconds: number | null = null;
    if (active && startTime) {
      const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
      endsInSeconds = Math.max(0, Math.round(sessionHours * 3600 - elapsed));
    }

    const activeReferrals = referralStats?.active ?? 0;

    return {
      mining: {
        active,
        speed: num((miningData as any)?.miningRate),
        plan: (miningData as any)?.miningPlan
          ? String((miningData as any).miningPlan)
          : null,
        endsInSeconds,
        streakDays: streak ?? null,
      },
      portfolio: {
        nuggets: num((balance as any)?.transferableBalance),
        tokens: num((balance as any)?.migratedBalance),
        totalMined: num((miningData as any)?.totalMined),
      },
      alchemy: {
        currentUsd: num((pool as any)?.remainingBalanceUsd),
        targetUsd: num((pool as any)?.initialBalanceUsd),
      },
      referrals: { active: activeReferrals, target: MINING_STATION_REFERRAL_TARGET },
      station: { unlocked: activeReferrals >= MINING_STATION_REFERRAL_TARGET },
      watchEarn: {
        watched: adsToday,
        // The daily ad allowance is a station-owner setting with no read path
        // here; reporting null keeps the UI from implying a cap it invented.
        total: null,
        nuggetsToday: null,
      },
    };
  }

  async shoperpal(userLower: string): Promise<ShoperpalSnapshot> {
    const [monthOrders, balance, remote] = await Promise.all([
      soft("shop orders", () =>
        this.orders.find({
          email: userLower,
          createdAt: { $gte: startOfMonth() },
        })
      ),
      soft("nugget balance", () =>
        this.balances.findOne({ email: userLower, coinSymbol: BTCY })
      ),
      soft("ShoperPal supplier", () => getShoperpalSnapshot(userLower)),
    ]);

    const rows = Array.isArray(monthOrders) ? monthOrders : null;

    return {
      buyer: {
        monthSpend: rows
          ? rows.reduce((sum: number, order: any) => sum + (num(order?.totalAmount) ?? 0), 0)
          : null,
        orderCount: rows ? rows.length : null,
        nuggetBalance: num((balance as any)?.transferableBalance),
      },
      supplier: remote?.supplier ?? null,
    };
  }

  async emmm(userLower: string): Promise<EmmmSnapshot> {
    const [eligibility, remote] = await Promise.all([
      soft("emmm eligibility", () => getNuggetEligibilityForEmmm({ email: userLower })),
      soft("EMMM account", () => getEmmmSnapshot(userLower)),
    ]);

    return {
      eligibility: eligibility
        ? {
            eligible: Boolean(eligibility.eligible),
            nuggetBalance: Number(eligibility.nuggetBalance) || 0,
            totalMined: Number(eligibility.totalMined) || 0,
            maxBetNuggets: Number(eligibility.maxBetNuggets) || 0,
            reason: eligibility.reason ?? null,
          }
        : null,
      slate: remote?.slate ?? null,
      accuracy: remote?.accuracy ?? null,
      ticket: remote?.ticket ?? null,
    };
  }

  /** The Indexx account fields the ecosystem screens link out with. */
  async indexxProfile(userLower: string): Promise<{
    referralCode: string | null;
    kycPassed: boolean | null;
  }> {
    const user = await soft("indexx profile", () =>
      this.users.findOneSelect({ email: userLower }, { referralCode: 1, isKYCPass: 1 })
    );
    if (!user) {
      return { referralCode: null, kycPassed: null };
    }
    return {
      referralCode: (user as any).referralCode
        ? String((user as any).referralCode)
        : null,
      kycPassed: Boolean((user as any).isKYCPass),
    };
  }
}

export const yaysEcosystem = new YaysEcosystemService();
