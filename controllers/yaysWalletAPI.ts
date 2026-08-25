import { Request, Response } from "express";
import { yaysWallet } from "../services/yaysWallet.service";
import {
  AlreadyCheckedInError,
  DAILY_POINTS_CAP,
  InsufficientPointsError,
  yaysPoints,
} from "../services/yaysPoints.service";
import {
  ActivityNotCompleteError,
  CHECK_IN_POINTS,
  UnclaimableActivityError,
  yaysEarn,
} from "../services/yaysEarn.service";
import {
  InvalidReferralCodeError,
  MINING_STATION_REFERRAL_TARGET,
  REFEREE_WELCOME_POINTS,
  REFERRAL_REWARD_POINTS,
  ReferralAlreadyAttributedError,
  SelfReferralError,
  yaysReferrals,
} from "../services/yaysReferral.service";

const emailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim().toLowerCase();

const asInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

const failed = (res: Response, error: any, context: string) => {
  console.error(`[yays/wallet] ${context}`, error);
  return res.status(500).json({
    message: "The rewards service is unavailable right now.",
    code: "server",
  });
};

const validation = (res: Response, message: string) =>
  res.status(400).json({ message, code: "validation" });

export class YaysWalletController {
  constructor() {
    // Express drops `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysWalletController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /** Public: the reward rules a client needs before sign-in. */
  async getConfig(_req: Request, res: Response) {
    return res.status(200).json({
      data: {
        pointsUnit: "IndexxPoints",
        dailyLimit: DAILY_POINTS_CAP,
        checkInPoints: CHECK_IN_POINTS,
        referral: {
          referrerReward: REFERRAL_REWARD_POINTS,
          refereeWelcome: REFEREE_WELCOME_POINTS,
          miningStationTarget: MINING_STATION_REFERRAL_TARGET,
        },
      },
    });
  }

  // --- wallet --------------------------------------------------------------

  async getAssets(req: Request, res: Response) {
    try {
      return res.status(200).json({ data: { items: await yaysWallet.assets(emailOf(req)) } });
    } catch (error) {
      return failed(res, error, "assets");
    }
  }

  async getTransactions(req: Request, res: Response) {
    try {
      const limit = Math.min(Math.max(asInt(req.query.limit, 30), 1), 100);
      const skip = Math.max(asInt(req.query.skip, 0), 0);
      const page = await yaysWallet.transactions(emailOf(req), limit, skip);
      return res.status(200).json({ data: page });
    } catch (error) {
      return failed(res, error, "transactions");
    }
  }

  async getTransaction(req: Request, res: Response) {
    try {
      const tx = await yaysWallet.transaction(
        emailOf(req),
        String(req.params.transactionId)
      );
      if (!tx) {
        return res
          .status(404)
          .json({ message: "Transaction not found.", code: "not_found" });
      }
      return res.status(200).json({ data: tx });
    } catch (error) {
      return failed(res, error, "transaction");
    }
  }

  // --- earn ----------------------------------------------------------------

  async getEarnSummary(req: Request, res: Response) {
    try {
      return res.status(200).json({ data: await yaysEarn.summary(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "earn summary");
    }
  }

  async getActivities(req: Request, res: Response) {
    try {
      return res
        .status(200)
        .json({ data: { items: await yaysEarn.activities(emailOf(req)) } });
    } catch (error) {
      return failed(res, error, "activities");
    }
  }

  async checkIn(req: Request, res: Response) {
    const userLower = emailOf(req);
    try {
      await yaysPoints.checkIn(userLower, CHECK_IN_POINTS);
      return res.status(200).json({ data: await yaysEarn.summary(userLower) });
    } catch (error) {
      if (error instanceof AlreadyCheckedInError) {
        return res.status(409).json({ message: error.message, code: "validation" });
      }
      return failed(res, error, "check-in");
    }
  }

  async claimActivity(req: Request, res: Response) {
    const userLower = emailOf(req);
    try {
      const result = await yaysEarn.claim(userLower, String(req.params.activityId));
      return res.status(200).json({
        data: { ...result, summary: await yaysEarn.summary(userLower) },
      });
    } catch (error) {
      if (error instanceof UnclaimableActivityError) {
        return res.status(404).json({ message: error.message, code: "not_found" });
      }
      if (error instanceof ActivityNotCompleteError) {
        return res.status(409).json({ message: error.message, code: "validation" });
      }
      if (error instanceof InsufficientPointsError) {
        return validation(res, error.message);
      }
      return failed(res, error, "claim");
    }
  }

  async getRewardHistory(req: Request, res: Response) {
    try {
      const limit = Math.min(Math.max(asInt(req.query.limit, 50), 1), 100);
      const skip = Math.max(asInt(req.query.skip, 0), 0);
      const rows = await yaysPoints
        .ledgerService()
        .history(emailOf(req), limit + 1, skip);
      const items = rows.slice(0, limit).map((entry: any) => ({
        id: String(entry._id),
        activity: entry.activity,
        amount: Math.abs(entry.amount),
        unit: "IndexxPoints",
        status: entry.status,
        createdAt: (entry.createdAt ?? new Date()).toISOString(),
        note: entry.note || undefined,
      }));
      return res.status(200).json({ data: { items, hasMore: rows.length > limit } });
    } catch (error) {
      return failed(res, error, "reward history");
    }
  }

  async getReward(req: Request, res: Response) {
    try {
      const entry: any = await yaysPoints
        .ledgerService()
        .entry(emailOf(req), String(req.params.rewardId));
      if (!entry) {
        return res.status(404).json({ message: "Reward not found.", code: "not_found" });
      }
      return res.status(200).json({
        data: {
          id: String(entry._id),
          activity: entry.activity,
          amount: Math.abs(entry.amount),
          unit: "IndexxPoints",
          status: entry.status,
          createdAt: (entry.createdAt ?? new Date()).toISOString(),
          note: entry.note || undefined,
        },
      });
    } catch (error) {
      return failed(res, error, "reward");
    }
  }

  // --- referrals -----------------------------------------------------------

  async getReferralSummary(req: Request, res: Response) {
    const userLower = emailOf(req);
    try {
      const [account, stats, rows] = await Promise.all([
        yaysPoints.summary(userLower),
        yaysReferrals.statsFor(userLower),
        yaysReferrals.listFor(userLower, 100),
      ]);
      return res.status(200).json({
        data: {
          code: account.referralCode,
          rewardPerReferral: REFERRAL_REWARD_POINTS,
          welcomeBonus: REFEREE_WELCOME_POINTS,
          miningStationTarget: MINING_STATION_REFERRAL_TARGET,
          stats,
          items: rows.map((referral) => ({
            name: referral.refereeLower.split("@")[0],
            joinedAt: (referral.createdAt ?? new Date()).toISOString(),
            reward: referral.rewardAmount || 0,
            status: referral.status,
          })),
        },
      });
    } catch (error) {
      return failed(res, error, "referral summary");
    }
  }

  /**
   * Attach the signed-in account to a referrer's code.
   *
   * Deliberately a signed-in call rather than part of signup: the code can
   * arrive from a deep link before the account exists, and the client replays
   * it once there is a session to attach it to.
   */
  async redeemReferral(req: Request, res: Response) {
    const userLower = emailOf(req);
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) {
      return validation(res, "An invite code is required.");
    }
    try {
      const referral = await yaysReferrals.attribute({
        refereeLower: userLower,
        code,
        source: req.body?.source ? String(req.body.source) : undefined,
      });
      return res.status(200).json({
        data: {
          status: referral.status,
          welcomeBonus: REFEREE_WELCOME_POINTS,
          balance: (await yaysPoints.summary(userLower)).balance,
        },
      });
    } catch (error) {
      if (error instanceof InvalidReferralCodeError) {
        return res.status(404).json({ message: error.message, code: "not_found" });
      }
      if (error instanceof SelfReferralError || error instanceof ReferralAlreadyAttributedError) {
        return validation(res, error.message);
      }
      return failed(res, error, "redeem referral");
    }
  }

  /** Resolve a code to its owner so an invite link can show who invited you. */
  async lookupReferralCode(req: Request, res: Response) {
    try {
      const account = await yaysPoints
        .accountService()
        .byCode(String(req.params.code));
      if (!account) {
        return res
          .status(404)
          .json({ message: "That invite code is not valid.", code: "not_found" });
      }
      return res.status(200).json({
        data: {
          code: account.referralCode,
          inviterName: account.userLower.split("@")[0],
          welcomeBonus: REFEREE_WELCOME_POINTS,
        },
      });
    } catch (error) {
      return failed(res, error, "lookup referral code");
    }
  }
}
