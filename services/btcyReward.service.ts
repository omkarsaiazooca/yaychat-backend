import { BTCYReward } from "../data/btcyReward";
import BTCYRewardSchema, { BTCYRewardModel } from "../models/btcyReward";
import { ServiceBase } from "./base";
import { NotificationService } from "./notification.service";
import { SubscriptionService } from "./subscription.service";
import { v4 as uuidv4 } from 'uuid';

const subscriptionService: SubscriptionService = new SubscriptionService();
const notificationService: NotificationService = new NotificationService();
type Platform = "twitter" | "telegram" | "youtube" | "instagram";
const PLATFORMS: Platform[] = ["twitter", "telegram", "youtube", "instagram"];

function isPlatform(x: string): x is Platform {
  return PLATFORMS.includes(x as Platform);
}

function initFollowTasks() {
  return PLATFORMS.map((platform) => ({
    platform,
    completed: false,
    screenshotUrl: "",
  }));
}


function allFourScreenshotsPresent(tasks: any[]): boolean {
  if (!Array.isArray(tasks)) return false;
  return PLATFORMS.every(p => {
    const t = tasks.find(x => x.platform === p);
    return !!t && typeof t.screenshotUrl === "string" && t.screenshotUrl.trim().length > 0;
  });
}


export class BTCYRewardService extends ServiceBase<BTCYReward, BTCYRewardModel> {
  constructor() {
    super(BTCYRewardSchema, "BTCYReward");
  }

  private async queueTurboDays(email: string, days: number, sourceSuffix: string) {
    const e = String(email).toLowerCase().trim();
    const minutes = Math.max(0, Math.floor(days * 1440)); // encode days into minutes
    // IMPORTANT: prefix source so the consumer knows it's a Turbo grant
    const source = `TURBO:days=${days}|${sourceSuffix}`;
    const grant = { kind: "turbo_days", minutes, source, grantedAt: new Date() };

    await subscriptionService.updatePart(
      { email: e, coinSymbol: "BTCY", status: "Active", "pendingRewards.source": { $ne: source } },
      { $push: { pendingRewards: grant } }
    );
  }

  private async queueTurboMinutes(email: string, minutes: number, sourceSuffix: string) {
    const e = String(email).toLowerCase().trim();
    const mins = Math.max(1, Math.floor(minutes)); // at least 1 minute
    const source = `TURBO:minutes=${mins}|${sourceSuffix}`; // <-- encoded Turbo minutes
    const grant = { kind: "turbo_minutes", minutes: mins, source, grantedAt: new Date() };

    await subscriptionService.updatePart(
      { email: e, coinSymbol: "BTCY", status: "Active", "pendingRewards.source": { $ne: source } },
      { $push: { pendingRewards: grant } }
    );
  }

  private allSocialApprovedStrict(reward: BTCYReward): boolean {
    if (!Array.isArray(reward.followTasks) || reward.followTasks.length < 4) return false;
    return ["twitter", "telegram", "youtube", "instagram"].every((p) => {
      const t = reward.followTasks.find((x: any) => x.platform === p);
      return t?.completed === true;
    });
  }


  async getOrCreateReward(email: string): Promise<BTCYReward> {
    let reward = await this.findOne({ email: email });
    if (!reward) {
      reward = await this.create({
        rewardId: uuidv4(),
        email,
        turboTimeMinutes: 0,
        followTasks: [],
        dailyPosts: [],
        watchedAdsCount: 0,
        rewards: {
          socialFollowBonusClaimed: false,
          hourlyAdBonus: { countToday: 0, lastClaimedAt: undefined },
          lastDailyBoostClaimDate: undefined,
        },
        createdDate: new Date(),
        updatedDate: new Date(),
      } as any);
    }
    return reward;
  }

  async grantTurboDays(email: string, days: number, sourceSuffix: string) {
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const reward = await this.getOrCreateReward(normalizedEmail);
    const minutes = Math.max(0, Math.floor(days * 1440));
    const source = `TURBO:days=${days}|${sourceSuffix}`;
    const alreadyGranted = Array.isArray((reward as any).turboGrants)
      ? (reward as any).turboGrants.some((grant: any) => grant?.source === source)
      : false;

    if (alreadyGranted) {
      return reward;
    }

    await this.queueTurboDays(normalizedEmail, days, sourceSuffix);

    reward.turboTimeMinutes = (reward.turboTimeMinutes || 0) + minutes;
    reward.updatedDate = new Date();

    await this.updatePart(
      { rewardId: reward.rewardId, email: normalizedEmail },
      {
        $set: {
          turboTimeMinutes: reward.turboTimeMinutes,
          updatedDate: reward.updatedDate,
        },
        $addToSet: {
          turboGrants: {
            source,
            days,
            minutes,
            grantedAt: reward.updatedDate,
          },
        },
      }
    );

    return reward;
  }

  async getOrCreateRewardForAdmin(email: string): Promise<BTCYReward> {
    let reward = await this.findOne({ email: email });
    if (!reward) {
      reward = await this.create({
        rewardId: uuidv4(),
        email,
        turboTimeMinutes: 0,
        followTasks: [],
        dailyPosts: [],
        watchedAdsCount: 0,
        rewards: {
          socialFollowBonusClaimed: false,
          hourlyAdBonus: { countToday: 0, lastClaimedAt: undefined },
          lastDailyBoostClaimDate: undefined,
          socialFollowNotified: false, // <-- NEW: notification-sent guard
        },
        createdDate: new Date(),
        updatedDate: new Date(),
      } as any);
    } else if (!reward.rewards) {
      reward.rewards = {
        socialFollowBonusClaimed: false,
        hourlyAdBonus: { countToday: 0, lastClaimedAt: undefined },
        lastDailyBoostClaimDate: undefined,
        socialFollowNotified: false, // ensure present on older docs
      } as any;
    } else if (typeof (reward.rewards as any).socialFollowNotified === "undefined") {
      // backfill on read for older records
      (reward.rewards as any).socialFollowNotified = false;
    }
    return reward;
  }


  async syncRewardWithSubscription(email: string, addedMinutes: number) {
    const sub = await subscriptionService.findOne({ email, coinSymbol: "BTCY" });
    const baseDate = sub?.endDate ? new Date(sub.endDate) : new Date();
    const extendedEndDate = new Date(baseDate);
    extendedEndDate.setMinutes(extendedEndDate.getMinutes() + addedMinutes);

    await subscriptionService.updatePart(
      { email, coinSymbol: "BTCY" },
      {
        $set: {
          plan: "Turbo Power",
          endDate: extendedEndDate,
          status: "Active",
          paymentMethod: "Reward-Sync",
        },
      }
    );
  }

  async uploadFollowScreenshot(email: string, platform: string, screenshotUrl: string) {
    try {
      const reward = await this.getOrCreateReward(email);
      const taskIndex = reward.followTasks.findIndex((t) => t.platform === platform);

      if (taskIndex >= 0) {
        reward.followTasks[taskIndex].screenshotUrl = screenshotUrl;
      } else {
        reward.followTasks.push({
          platform,
          completed: false,
          screenshotUrl,
        });
      }

      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId },
        { $set: { followTasks: reward.followTasks, updatedDate: reward.updatedDate } }
      );
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to upload follow screenshot: ${err.message}`);
    }
  }

  async uploadBulkSocialScreenshot(email: string, screenshotUrl: string) {
    try {
      const reward = await this.getOrCreateReward(email);
      const platforms = ["twitter", "telegram", "youtube", "instagram"];

      if (!reward.followTasks || reward.followTasks.length === 0) {
        reward.followTasks = platforms.map((platform) => ({
          platform,
          completed: false,
          screenshotUrl,
        }));
      } else {
        platforms.forEach((platform) => {
          const taskIndex = reward.followTasks.findIndex((t) => t.platform === platform);
          if (taskIndex >= 0) {
            reward.followTasks[taskIndex].screenshotUrl = screenshotUrl;
          } else {
            reward.followTasks.push({
              platform,
              completed: false,
              screenshotUrl,
            });
          }
        });
      }

      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        { $set: { followTasks: reward.followTasks, updatedDate: reward.updatedDate } }
      );
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to upload bulk social screenshot: ${err.message}`);
    }
  }

  async uploadSocialScreenshot(
    email: string,
    platform: Platform,
    screenshotUrl: string
  ) {
    try {
      if (!isPlatform(platform)) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const reward = await this.getOrCreateRewardForAdmin(email); // use admin variant to ensure rewards flags exist

      // Ensure array exists and has all platforms
      if (!Array.isArray(reward.followTasks) || reward.followTasks.length === 0) {
        reward.followTasks = initFollowTasks();
      } else {
        for (const p of PLATFORMS) {
          if (!reward.followTasks.some((t: any) => t.platform === p)) {
            reward.followTasks.push({ platform: p, completed: false, screenshotUrl: "" });
          }
        }
      }

      // Update the one platform
      const idx = reward.followTasks.findIndex((t: any) => t.platform === platform);
      reward.followTasks[idx].screenshotUrl = screenshotUrl;

      // Persist the screenshot update first
      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId, email },
        { $set: { followTasks: reward.followTasks, updatedDate: reward.updatedDate } }
      );

      // If all four screenshots present, auto-grant ONCE
      const nowAllScreenshots = allFourScreenshotsPresent(reward.followTasks);

      if (nowAllScreenshots && !reward.rewards?.socialFollowBonusClaimed) {
        // Mark tasks completed (auto-approval since we have all screenshots)
        const now = new Date();
        for (const p of PLATFORMS) {
          const t = reward.followTasks.find((x: any) => x.platform === p);
          if (t) {
            t.completed = true;
            t.completedAt = now;
          }
        }

        reward.turboTimeMinutes = (reward.turboTimeMinutes || 0) + 1440; // +1 day
        reward.rewards.socialFollowBonusClaimed = true;
        reward.updatedDate = new Date();

        // Save completed flags + claimed guard
        await this.updatePart(
          { rewardId: reward.rewardId, email },
          {
            $set: {
              followTasks: reward.followTasks,
              turboTimeMinutes: reward.turboTimeMinutes,
              rewards: reward.rewards,
              updatedDate: reward.updatedDate,
            },
          }
        );

        // Queue Turbo day (dedup protected via unique source)
        await this.queueTurboDays(email, 1, `social_follow_bonus@${reward.rewardId}`);

        // Notify once
        if (!reward.rewards.socialFollowNotified) {
          reward.rewards.socialFollowNotified = true;
          await this.updatePart(
            { rewardId: reward.rewardId, email },
            { $set: { "rewards.socialFollowNotified": true, updatedDate: new Date() } }
          );
          await notificationService.sendFollowAllApprovedReward(email, { days: 1 });
        }
      }

      // Re-read & return the latest reward doc
      return await this.findOne({ rewardId: reward.rewardId, email });
    } catch (err: any) {
      throw new Error(`Failed to upload social screenshot (${platform}): ${err.message}`);
    }
  }



  async uploadIndividualSocialScreenshot(email: string, platform: string, screenshotUrl: string) {
    return this.uploadFollowScreenshot(email, platform, screenshotUrl);
  }

  async uploadDailyPostScreenshot(email: string, screenshotUrl: string, postId?: string,) {
    try {
      const reward = await this.getOrCreateReward(email);
      const postIndex = reward.dailyPosts.findIndex((p) => p.postId === postId);

      if (postIndex >= 0) {
        reward.dailyPosts[postIndex].screenshotUrl = screenshotUrl;
        reward.dailyPosts[postIndex].uploadedAt = new Date();
      } else {
        reward.dailyPosts.push({
          postId: postId || uuidv4(),
          date: new Date(),
          liked: false,
          shared: false,
          commented: false,
          screenshotUrl,
          uploadedAt: new Date(),
        });
      }

      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        { $set: { dailyPosts: reward.dailyPosts, updatedDate: reward.updatedDate } }
      );
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to upload daily post screenshot: ${err.message}`);
    }
  }

  async adminApproveFollowTask(email: string, platform: string, completed: boolean) {
    try {
      const reward = await this.getOrCreateRewardForAdmin(email);
      const taskIndex = reward.followTasks.findIndex((t) => t.platform === platform);

      if (taskIndex >= 0) {
        reward.followTasks[taskIndex].completed = completed;
        reward.followTasks[taskIndex].completedAt = completed ? new Date() : undefined;
      } else {
        // ensure the platform exists; create if missing
        reward.followTasks.push({
          platform,
          completed,
          completedAt: completed ? new Date() : undefined,
          screenshotUrl: "",
        } as any);
      }

      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId, email },
        { $set: { followTasks: reward.followTasks, updatedDate: reward.updatedDate } }
      );

      const nowAllApproved = this.allSocialApprovedStrict(reward);

      // 1) Grant only when all approved and not yet claimed
      if (nowAllApproved && !reward.rewards.socialFollowBonusClaimed) {
        reward.turboTimeMinutes += 1440; // 1 day
        reward.rewards.socialFollowBonusClaimed = true;

        await this.updatePart(
          { rewardId: reward.rewardId, email },
          {
            $set: {
              turboTimeMinutes: reward.turboTimeMinutes,
              rewards: reward.rewards,
              updatedDate: new Date(),
            },
          }
        );

        await this.queueTurboDays(email, 1, `social_follow_bonus@${reward.rewardId}`);
      }

      // 2) Notify only when all approved and not yet notified
      if (nowAllApproved && !reward.rewards.socialFollowNotified) {
        reward.rewards.socialFollowNotified = true;
        await this.updatePart(
          { rewardId: reward.rewardId, email },
          { $set: { "rewards.socialFollowNotified": true, updatedDate: new Date() } }
        );

        // uses the NotificationService you wired earlier
        await notificationService.sendFollowAllApprovedReward(email, { days: 1 });
      }

      return reward;
    } catch (err: any) {
      throw new Error(`Failed to approve follow task: ${err.message}`);
    }
  }


  async adminApproveDailyPost(email: string, postId: string, liked: boolean, shared: boolean, commented: boolean) {
    try {
      const reward = await this.getOrCreateReward(email);
      const postIndex = reward.dailyPosts.findIndex((p) => p.postId === postId);

      if (postIndex >= 0) {
        reward.dailyPosts[postIndex].liked = liked;
        reward.dailyPosts[postIndex].shared = shared;
        reward.dailyPosts[postIndex].commented = commented;
        reward.dailyPosts[postIndex].uploadedAt = new Date();
      }

      reward.updatedDate = new Date();
      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        { $set: { dailyPosts: reward.dailyPosts, updatedDate: reward.updatedDate } }
      );

      const todayStr = new Date().toDateString();
      const latestPost = reward.dailyPosts[postIndex];
      const canGrantToday =
        latestPost &&
        latestPost.liked &&
        latestPost.shared &&
        latestPost.commented &&
        (!reward.rewards.lastDailyBoostClaimDate ||
          new Date(reward.rewards.lastDailyBoostClaimDate).toDateString() !== todayStr);
      if (canGrantToday) {
        reward.turboTimeMinutes += 120;
        reward.rewards.lastDailyBoostClaimDate = new Date();

        await this.updatePart(
          { rewardId: reward.rewardId, email },
          {
            $set: {
              turboTimeMinutes: reward.turboTimeMinutes,
              rewards: reward.rewards,
              updatedDate: new Date(),
            },
          }
        );
        const source = `daily_post_bonus@${todayStr}@post:${postId}`;
        await this.queueTurboMinutes(email, 120, source);
      }
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to approve daily post: ${err.message}`);
    }
  }

  async claimDailyBoost(email: string) {
    try {
      const reward = await this.getOrCreateReward(email);
      const todayStr = new Date().toDateString();

      if (reward.rewards?.lastDailyBoostClaimDate &&
        new Date(reward.rewards.lastDailyBoostClaimDate).toDateString() === todayStr) {
        throw new Error("Daily boost already claimed today");
      }

      const postLength = reward.dailyPosts.length;
      const latestPost = reward.dailyPosts[postLength - 1];
      if (!latestPost || !(latestPost.liked && latestPost.shared && latestPost.commented)) {
        throw new Error("Not all daily tasks approved");
      }

      reward.turboTimeMinutes += 120;
      reward.rewards.lastDailyBoostClaimDate = new Date();
      reward.updatedDate = new Date();

      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        {
          $set: {
            turboTimeMinutes: reward.turboTimeMinutes,
            rewards: reward.rewards,
            updatedDate: reward.updatedDate,
          },
        }
      );
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to claim daily boost: ${err.message}`);
    }
  }

  async addWatchedAd(email: string) {
    try {
      const reward = await this.getOrCreateReward(email);
      const now = new Date();
      const lastClaim = reward.rewards?.hourlyAdBonus?.lastClaimedAt
        ? new Date(reward.rewards.hourlyAdBonus.lastClaimedAt)
        : null;

      if (lastClaim && now.getTime() - lastClaim.getTime() < 60 * 60 * 1000) {
        throw new Error("You can only claim ad bonus once per hour");
      }

      reward.turboTimeMinutes += 15;
      reward.watchedAdsCount += 1;
      reward.lastAdWatchedAt = now;
      reward.rewards.hourlyAdBonus.lastClaimedAt = now;
      reward.rewards.hourlyAdBonus.countToday = (reward.rewards.hourlyAdBonus.countToday || 0) + 1;
      reward.updatedDate = now;

      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        {
          $set: {
            turboTimeMinutes: reward.turboTimeMinutes,
            watchedAdsCount: reward.watchedAdsCount,
            lastAdWatchedAt: reward.lastAdWatchedAt,
            rewards: reward.rewards,
            updatedDate: reward.updatedDate,
          },
        }
      );
      await this.syncRewardWithSubscription(email, 15);
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to add watched ad: ${err.message}`);
    }
  }

  async claimFollowBonus(email: string) {
    try {
      const reward = await this.getOrCreateReward(email);

      if (reward.rewards.socialFollowBonusClaimed) {
        throw new Error("Follow bonus already claimed");
      }

      const allFollowed = reward.followTasks.every((task) => task.completed);
      if (!allFollowed) throw new Error("Not all platforms approved");

      reward.turboTimeMinutes += 1440;
      reward.rewards.socialFollowBonusClaimed = true;
      reward.updatedDate = new Date();

      await this.updatePart(
        { rewardId: reward.rewardId, email: email },
        {
          $set: {
            turboTimeMinutes: reward.turboTimeMinutes,
            rewards: reward.rewards,
            updatedDate: reward.updatedDate,
          },
        }
      );
      return reward;
    } catch (err: any) {
      throw new Error(`Failed to claim follow bonus: ${err.message}`);
    }
  }

  async adminGetAllRewards() {
    return this.find({});
  }

  /// old methods for reference (moved to controller)
  async uploadSocialScreenshot0(
    email: string,
    platform: Platform,
    screenshotUrl: string
  ) {
    try {
      if (!isPlatform(platform)) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const reward = await this.getOrCreateReward(email);

      // Ensure array exists and has all platforms
      if (!Array.isArray(reward.followTasks) || reward.followTasks.length === 0) {
        reward.followTasks = initFollowTasks();
      } else {
        // add missing platforms if any
        for (const p of PLATFORMS) {
          if (!reward.followTasks.some((t: any) => t.platform === p)) {
            reward.followTasks.push({ platform: p, completed: false, screenshotUrl: "" });
          }
        }
      }

      // Update the one platform
      const idx = reward.followTasks.findIndex((t: any) => t.platform === platform);
      reward.followTasks[idx].screenshotUrl = screenshotUrl;

      reward.updatedDate = new Date();

      await this.updatePart(
        { rewardId: reward.rewardId, email },
        { $set: { followTasks: reward.followTasks, updatedDate: reward.updatedDate } }
      );

      return reward;
    } catch (err: any) {
      throw new Error(`Failed to upload social screenshot (${platform}): ${err.message}`);
    }
  }
}
