import { BtcyChatGroupBonus } from "../data/btcyChatGroupBonus";
import BtcyChatGroupBonusSchema, {
  BtcyChatGroupBonusModel,
} from "../models/btcyChatGroupBonus";
import { ServiceBase } from "./base";
import { BTCYRewardService } from "./btcyReward.service";
import { ChatGroupService } from "./chatgroups.service";
import { NotificationService } from "./notification.service";
import { SubscriptionService } from "./subscription.service";

const COIN_SYMBOL = "BTCY";
const EFFECTIVE_FROM = new Date("2026-06-17T00:00:00.000Z");
const MIN_JOINED_MEMBERS = 5;
const REWARD_DAYS = 7;
const OWNER_COOLDOWN_DAYS = 30;
const REWARD_TYPE = "btcy_chat_group_turbo_7d";
const REWARD_PLAN = "Turbo Power";
const REWARD_SOURCE_PREFIX = "btcy_chat_group_bonus";
const DAY_MS = 86_400_000;

const addDaysUTC = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

const normalizeEmail = (email: unknown) =>
  String(email ?? "").trim().toLowerCase();

type AdminListOptions = {
  from?: string;
  to?: string;
  ownerEmail?: string;
  groupId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export class BtcyChatGroupBonusService extends ServiceBase<
  BtcyChatGroupBonus,
  BtcyChatGroupBonusModel
> {
  private readonly groupService = new ChatGroupService();
  private readonly rewardService = new BTCYRewardService();
  private readonly subscriptionService = new SubscriptionService();
  private readonly notificationService = new NotificationService();

  constructor() {
    super(BtcyChatGroupBonusSchema, "BtcyChatGroupBonus");
  }

  private getJoinedMemberEmails(group: any): string[] {
    const blocked = new Set(
      (Array.isArray(group?.blockedMembers) ? group.blockedMembers : [])
        .map((email: unknown) => normalizeEmail(email))
        .filter(Boolean)
    );

    return Array.from(
      new Set(
        (Array.isArray(group?.members) ? group.members : [])
          .map((member: unknown) => normalizeEmail(member))
          .filter((email: string) => email.includes("@"))
          .filter((email: string) => !blocked.has(email))
      )
    );
  }

  private async ensureActiveSubscription(email: string, now: Date) {
    await (this.subscriptionService as any).upsertOne(
      { email, coinSymbol: COIN_SYMBOL, status: "Active" },
      {
        $setOnInsert: {
          email,
          coinSymbol: COIN_SYMBOL,
          plan: "Free",
          speedBoost: 1.5,
          cost: 0,
          paymentMethod: "",
          startDate: now,
          endDate: now,
          status: "Active",
          miningRate: 1.5,
          referralBonusUsed: 0,
        },
      }
    );
  }

  async evaluateGroupById(groupId: string, now = new Date()) {
    const group = await this.groupService.findOne({ groupId });
    return this.evaluateGroup(group, now);
  }

  async evaluateGroup(group: any, now = new Date()) {
    if (!group) {
      return { granted: false, reason: "group-not-found" };
    }

    const groupId = String(group?.groupId || "").trim();
    if (!groupId) {
      return { granted: false, reason: "missing-group-id" };
    }

    if (group?.isGlobal || group?.isAdminOnly || group?.isReferralGroup) {
      return { granted: false, reason: "ineligible-group-type" };
    }

    const groupCreatedAt = group?.createdAt ? new Date(group.createdAt) : now;
    if (groupCreatedAt.getTime() < EFFECTIVE_FROM.getTime()) {
      return { granted: false, reason: "before-effective-date" };
    }

    const ownerEmail = normalizeEmail(group?.createdBy);
    if (!ownerEmail || !ownerEmail.includes("@")) {
      return { granted: false, reason: "owner-email-missing" };
    }

    const joinedMemberEmails = this.getJoinedMemberEmails(group);
    const memberCount = joinedMemberEmails.length;
    if (memberCount < MIN_JOINED_MEMBERS) {
      return {
        granted: false,
        reason: "member-threshold-not-met",
        memberCount,
      };
    }

    const alreadyRewarded = await this.findOne({ groupId, rewardType: REWARD_TYPE });
    if (alreadyRewarded) {
      return { granted: false, reason: "group-already-rewarded", reward: alreadyRewarded };
    }

    const cooldownSince = addDaysUTC(now, -OWNER_COOLDOWN_DAYS);
    const ownerRecentlyRewarded = await this.findOne({
      ownerEmail,
      rewardType: REWARD_TYPE,
      grantedAt: { $gte: cooldownSince },
    });
    if (ownerRecentlyRewarded) {
      return { granted: false, reason: "owner-cooldown-active", reward: ownerRecentlyRewarded };
    }

    const ownerActiveBonus = await this.findOne({
      ownerEmail,
      rewardType: REWARD_TYPE,
      status: "active",
      expiresAt: { $gt: now },
    });
    if (ownerActiveBonus) {
      return { granted: false, reason: "owner-active-bonus-exists", reward: ownerActiveBonus };
    }

    const expiresAt = addDaysUTC(now, REWARD_DAYS);
    const sourceSuffix = `${REWARD_SOURCE_PREFIX}@${groupId}`;
    const source = `TURBO:days=${REWARD_DAYS}|${sourceSuffix}`;

    let history: any;
    try {
      history = await this.create({
        ownerEmail,
        groupId,
        groupName: String(group?.name || ""),
        rewardType: REWARD_TYPE,
        plan: REWARD_PLAN,
        durationDays: REWARD_DAYS,
        source,
        status: "active",
        effectiveFrom: EFFECTIVE_FROM,
        expiresAt,
        grantedAt: now,
        groupCreatedAt,
        memberCountAtGrant: memberCount,
        metadata: {
          joinedMemberEmails,
        },
      } as any);
    } catch (error: any) {
      if (error?.code === 11000) {
        const reward = await this.findOne({ groupId, rewardType: REWARD_TYPE });
        return { granted: false, reason: "group-already-rewarded", reward };
      }
      throw error;
    }

    try {
      await this.ensureActiveSubscription(ownerEmail, now);
      await this.rewardService.grantTurboDays(ownerEmail, REWARD_DAYS, sourceSuffix);
      await this.subscriptionService.applyPendingBatch(ownerEmail, COIN_SYMBOL, 5);
      await this.notificationService.sendBtcyChatGroupBonusReward(ownerEmail, {
        days: REWARD_DAYS,
        groupId,
        groupName: String(group?.name || ""),
        memberCount,
        dedupeKey: `${REWARD_TYPE}:${groupId}`,
      });

      return { granted: true, reward: history };
    } catch (error: any) {
      const failureReason = error?.message || String(error);
      await this.updatePart(
        { groupId, rewardType: REWARD_TYPE },
        {
          $set: {
            status: "failed",
            failureReason,
            updatedAt: new Date(),
          },
        }
      );
      throw error;
    }
  }

  async getAdminDashboard(options: AdminListOptions = {}) {
    const page = Math.max(0, Number(options.page ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize ?? 25)));
    const query: any = {};

    const ownerEmail = normalizeEmail(options.ownerEmail);
    const groupId = String(options.groupId || "").trim();
    const status = String(options.status || "").trim().toLowerCase();

    if (ownerEmail) query.ownerEmail = ownerEmail;
    if (groupId) query.groupId = groupId;
    if (status) query.status = status;

    if (options.from || options.to) {
      query.grantedAt = {};
      if (options.from) {
        const fromDate = new Date(options.from);
        if (!Number.isNaN(fromDate.getTime())) query.grantedAt.$gte = fromDate;
      }
      if (options.to) {
        const toDate = new Date(options.to);
        if (!Number.isNaN(toDate.getTime())) query.grantedAt.$lte = toDate;
      }
      if (!Object.keys(query.grantedAt).length) delete query.grantedAt;
    }

    const [total, totalRewardsGranted, rows, statusSummary] = await Promise.all([
      this.findCount(query),
      this.findCount({ ...query, status: "active" }),
      this.findPaginatedSkip(
        pageSize,
        page * pageSize,
        { grantedAt: -1, _id: -1 },
        query,
        {}
      ),
      this.findAggregate<{ _id: string; count: number }>([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const byStatus = (statusSummary || []).reduce<Record<string, number>>((acc, row) => {
      acc[String(row._id || "unknown")] = Number(row.count || 0);
      return acc;
    }, {});

    return {
      status: 200,
      data: {
        filters: {
          from: options.from || "",
          to: options.to || "",
          ownerEmail,
          groupId,
          status,
        },
        summary: {
          totalRewardsGranted,
          totalRecords: total,
          byStatus,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        rewards: (rows || []).map((row: any) => {
          const metadata = row?.metadata || {};
          return {
            id: String(row?._id || ""),
            owner: String(row?.ownerEmail || ""),
            ownerEmail: String(row?.ownerEmail || ""),
            groupId: String(row?.groupId || ""),
            groupName: String(row?.groupName || ""),
            groupMemberCount: Number(row?.memberCountAtGrant || 0),
            rewardDate: row?.grantedAt || null,
            expiryDate: row?.expiresAt || null,
            rewardStatus: String(row?.status || ""),
            rejectionReason:
              String(row?.failureReason || metadata?.rejectionReason || metadata?.blockedReason || ""),
            rewardType: String(row?.rewardType || ""),
            plan: String(row?.plan || ""),
            durationDays: Number(row?.durationDays || 0),
            source: String(row?.source || ""),
            effectiveFrom: row?.effectiveFrom || null,
            createdAt: row?.createdAt || null,
            updatedAt: row?.updatedAt || null,
          };
        }),
      },
    };
  }
}
