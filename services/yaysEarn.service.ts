import { ChatMessageService } from "./chatmessage.service";
import { YaysCommunityPostService } from "./yaysCommunityPost.service";
import { AiAssistantUsageService, usageDay } from "./aiAssistantUsage.service";
import {
  DAILY_POINTS_CAP,
  utcDayKey,
  yaysPoints,
} from "./yaysPoints.service";
import { PointsReason } from "../data/yaysWallet";
import { yaysReferrals } from "./yaysReferral.service";

/**
 * The Earn tab.
 *
 * Every activity row here is computed from something the member actually did —
 * messages sent, posts published, AI calls made, friends referred. Nothing is
 * seeded or simulated: an activity with no real counter behind it is reported
 * as `coming_soon` rather than given a plausible-looking number, because a
 * fake progress bar on a rewards screen is a promise the app cannot keep.
 */

export type EarnActivityStatus =
  | "available"
  | "completed_today"
  | "coming_soon"
  | "limit_reached";

export interface EarnActivityView {
  id: string;
  title: string;
  description: string;
  reward: string;
  icon: string;
  status: EarnActivityStatus;
  progress?: { current: number; target: number };
}

export interface EarnCampaignView {
  id: string;
  title: string;
  description: string;
  endsAt: string;
  reward: string;
}

export interface EarnSummaryView {
  balance: number;
  streakDays: number;
  checkedInToday: boolean;
  dailyLimit: number;
  earnedToday: number;
  referralCode: string;
  referrals: {
    name: string;
    joinedAt: string;
    reward: number;
    status: "pending" | "completed" | "reversed";
  }[];
  campaigns: EarnCampaignView[];
}

export const CHECK_IN_POINTS = 20;
const CHAT_TARGET = 10;
const CHAT_POINTS = 30;
const POST_TARGET = 3;
const POST_POINTS = 15;
const AI_TARGET = 3;
const AI_POINTS = 25;

const startOfUtcDay = (): Date => new Date(`${utcDayKey()}T00:00:00.000Z`);

/** Referral rows map onto the three states the rewards UI knows about. */
const referralDisplayStatus = (
  status: string
): "pending" | "completed" | "reversed" =>
  status === "rewarded" || status === "qualified"
    ? "completed"
    : status === "rejected"
    ? "reversed"
    : "pending";

export class YaysEarnService {
  private messages = new ChatMessageService();
  private posts = new YaysCommunityPostService();
  private aiUsage = new AiAssistantUsageService();

  async summary(userLower: string): Promise<EarnSummaryView> {
    const [account, referrals] = await Promise.all([
      yaysPoints.summary(userLower),
      yaysReferrals.listFor(userLower, 50),
    ]);

    return {
      balance: account.balance,
      streakDays: account.streakDays || 0,
      checkedInToday: account.lastCheckInDate === utcDayKey(),
      dailyLimit: DAILY_POINTS_CAP,
      earnedToday: account.earnedToday || 0,
      referralCode: account.referralCode,
      referrals: referrals.map((referral) => ({
        // The referee's email local-part is the only name available without
        // joining the user collection, and it is what the referrer typed.
        name: referral.refereeLower.split("@")[0],
        joinedAt: (referral.createdAt ?? new Date()).toISOString(),
        reward: referral.rewardAmount || 0,
        status: referralDisplayStatus(referral.status),
      })),
      // Campaigns are configured by the growth team; until that admin surface
      // exists, showing none is correct — an invented campaign is a promise of
      // points nobody will pay.
      campaigns: [],
    };
  }

  /**
   * Activity rows with live progress.
   *
   * Counter failures degrade one row to `coming_soon` instead of failing the
   * screen: the Earn tab must still render if, say, the community service is
   * briefly unavailable.
   */
  async activities(userLower: string): Promise<EarnActivityView[]> {
    const [account, chatCount, postCount, aiCount, referralStats] =
      await Promise.all([
        yaysPoints.summary(userLower),
        this.countMessagesToday(userLower),
        this.countPostsToday(userLower),
        this.countAiCallsToday(userLower),
        yaysReferrals.statsFor(userLower).catch(() => null),
      ]);

    const atDailyCap = (account.earnedToday || 0) >= DAILY_POINTS_CAP;
    const gate = (status: EarnActivityStatus): EarnActivityStatus =>
      atDailyCap && status === "available" ? "limit_reached" : status;

    const progressRow = (
      id: string,
      title: string,
      description: string,
      icon: string,
      points: number,
      count: number | null,
      target: number
    ): EarnActivityView =>
      count === null
        ? {
            id,
            title,
            description,
            reward: "Unavailable",
            icon,
            status: "coming_soon",
          }
        : {
            id,
            title,
            description,
            reward: `+${points}`,
            icon,
            status: gate(count >= target ? "completed_today" : "available"),
            progress: { current: Math.min(count, target), target },
          };

    return [
      progressRow(
        "act_chat",
        "Chat to Earn",
        `Send ${CHAT_TARGET} messages to friends today.`,
        "chatbubbles",
        CHAT_POINTS,
        chatCount,
        CHAT_TARGET
      ),
      progressRow(
        "act_post",
        "Post to Earn",
        "Post in your communities and moments.",
        "megaphone",
        POST_POINTS,
        postCount,
        POST_TARGET
      ),
      {
        id: "act_shop",
        title: "Shop to Earn",
        description: "Earn on ShoperPal purchases.",
        reward: "Coming soon",
        icon: "cart",
        status: "coming_soon",
      },
      {
        id: "act_use",
        title: "Use to Earn",
        description:
          "Use YaysApp and Indexx products — daily activity adds up.",
        reward: "Coming soon",
        icon: "apps",
        status: "coming_soon",
      },
      {
        id: "act_checkin",
        title: "Daily check-in",
        description: "Open YaysApp and check in once a day.",
        reward: `+${CHECK_IN_POINTS}`,
        icon: "calendar",
        status:
          account.lastCheckInDate === utcDayKey()
            ? "completed_today"
            : gate("available"),
      },
      {
        id: "act_invite",
        title: "Invite Friends to Earn",
        description: "Earn for every friend who joins with your code.",
        reward: "+250",
        icon: "person-add",
        // Referral payouts bypass the daily cap, so this row never gates.
        status: "available",
        ...(referralStats
          ? { progress: { current: referralStats.active, target: 5 } }
          : {}),
      },
      progressRow(
        "act_ai",
        "AI to Earn",
        `Use any AI tool ${AI_TARGET} times today.`,
        "sparkles",
        AI_POINTS,
        aiCount,
        AI_TARGET
      ),
      {
        id: "act_mine",
        title: "Mine to Earn",
        description: "BTCY mining rewards inside YaysApp.",
        reward: "Coming soon",
        icon: "hammer",
        status: "coming_soon",
      },
      {
        id: "act_ads",
        title: "Watch Ads to Earn",
        description: "Optional rewarded ads.",
        reward: "Coming soon",
        icon: "play-circle",
        status: "coming_soon",
      },
    ];
  }

  /**
   * Claim an activity's reward once its target is met.
   *
   * The day is part of the idempotency key, so claiming twice — or from two
   * devices — pays once, and the target is re-checked server-side because the
   * client's progress number is not trustworthy.
   */
  async claim(
    userLower: string,
    activityId: string
  ): Promise<{ awarded: number; balance: number; alreadyClaimed: boolean }> {
    const claimable: Record<
      string,
      {
        points: number;
        target: number;
        activity: string;
        reason: PointsReason;
        count: () => Promise<number | null>;
      }
    > = {
      act_chat: {
        points: CHAT_POINTS,
        target: CHAT_TARGET,
        activity: "Chat to Earn",
        reason: "chat_activity",
        count: () => this.countMessagesToday(userLower),
      },
      act_post: {
        points: POST_POINTS,
        target: POST_TARGET,
        activity: "Post to Earn",
        reason: "community_activity",
        count: () => this.countPostsToday(userLower),
      },
      act_ai: {
        points: AI_POINTS,
        target: AI_TARGET,
        activity: "AI to Earn",
        // No dedicated AI reason yet; `campaign` is the closest existing
        // bucket and keeps the ledger honest about it not being chat.
        reason: "campaign",
        count: () => this.countAiCallsToday(userLower),
      },
    };

    const spec = claimable[activityId];
    if (!spec) {
      throw new UnclaimableActivityError(activityId);
    }

    const count = await spec.count();
    if (count === null || count < spec.target) {
      throw new ActivityNotCompleteError(spec.activity, count ?? 0, spec.target);
    }

    const result = await yaysPoints.credit({
      userLower,
      amount: spec.points,
      reason: spec.reason,
      activity: spec.activity,
      idempotencyKey: `${activityId}:${utcDayKey()}`,
      meta: { activityId, count },
    });

    return {
      awarded: result.entry.amount,
      balance: result.account.balance,
      alreadyClaimed: result.duplicate,
    };
  }

  // -------------------------------------------------------------------------
  // Counters. `null` means "this counter could not be read", which the caller
  // renders as unavailable rather than as zero progress.
  // -------------------------------------------------------------------------

  private async countMessagesToday(userLower: string): Promise<number | null> {
    try {
      return await this.messages.findCount({
        email: userLower,
        isDeleted: { $ne: true },
        timestamp: { $gte: startOfUtcDay() },
      });
    } catch (error) {
      console.error("[yays/earn] chat counter unavailable", error);
      return null;
    }
  }

  private async countPostsToday(userLower: string): Promise<number | null> {
    try {
      return await this.posts.findCount({
        authorLower: userLower,
        removed: { $ne: true },
        createdAt: { $gte: startOfUtcDay() },
      });
    } catch (error) {
      console.error("[yays/earn] post counter unavailable", error);
      return null;
    }
  }

  private async countAiCallsToday(userLower: string): Promise<number | null> {
    try {
      const row: any = await this.aiUsage.findOne({
        userLower,
        day: usageDay(),
      });
      return Number(row?.requests ?? 0);
    } catch (error) {
      console.error("[yays/earn] AI counter unavailable", error);
      return null;
    }
  }
}

export class UnclaimableActivityError extends Error {
  constructor(public activityId: string) {
    super("That activity does not pay a claimable reward.");
    this.name = "UnclaimableActivityError";
  }
}

export class ActivityNotCompleteError extends Error {
  constructor(activity: string, public current: number, public target: number) {
    super(`${activity} is not finished yet — ${current} of ${target} done.`);
    this.name = "ActivityNotCompleteError";
  }
}

export const yaysEarn = new YaysEarnService();
