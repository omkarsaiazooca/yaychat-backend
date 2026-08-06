import { IDocumentModel, IModel } from "./base";

export interface FollowTask {
  platform: string;
  completed: boolean;
  completedAt?: Date;
  screenshotUrl?: string;
}

export interface DailyPostTask {
  postId: string;
  date: Date;
  liked: boolean;
  shared: boolean;
  commented: boolean;
  screenshotUrl?: string;
  uploadedAt?: Date;
}

export interface BTCYReward extends IModel, IDocumentModel<BTCYReward> {
  rewardId: string; // Unique identifier for the reward
  email: string;
  turboTimeMinutes: number;
  turboGrants?: {
    source: string;
    days?: number;
    minutes: number;
    grantedAt: Date;
  }[];
  followTasks: FollowTask[];
  dailyPosts: DailyPostTask[];
  watchedAdsCount: number;
  lastAdWatchedAt?: Date;
  rewards: {
    socialFollowNotified: boolean;
    socialFollowBonusClaimed: boolean;
    lastDailyBoostClaimDate?: Date;
    hourlyAdBonus: {
      lastClaimedAt?: Date;
      countToday: number;
    };
  };

  createdDate: Date;
  updatedDate: Date;
}
