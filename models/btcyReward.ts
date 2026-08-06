import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BTCYReward } from "../data/btcyReward";

export interface BTCYRewardModel extends IDocumentModel<BTCYReward>, BTCYReward { }

export const BTCYRewardSchema: Schema = new Schema();

BTCYRewardSchema.add({
  rewardId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  turboTimeMinutes: { type: Number, default: 0 },
  turboGrants: [
    {
      source: { type: String, required: true },
      days: { type: Number },
      minutes: { type: Number, required: true },
      grantedAt: { type: Date, default: Date.now },
    },
  ],

  followTasks: [
    {
      platform: { type: String, required: true },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date },
      screenshotUrl: { type: String },
    },
  ],

  dailyPosts: [
    {
      postId: { type: String, required: true },
      date: { type: Date, default: Date.now },
      liked: { type: Boolean, default: false },
      shared: { type: Boolean, default: false },
      commented: { type: Boolean, default: false },
      screenshotUrl: { type: String },
      uploadedAt: { type: Date },
    },
  ],

  watchedAdsCount: { type: Number, default: 0 },
  lastAdWatchedAt: { type: Date },
  rewards: {
    socialFollowNotified: { type: Boolean, default: false },
    socialFollowBonusClaimed: { type: Boolean, default: false },
    lastDailyBoostClaimDate: { type: Date }, // track daily claim date
    hourlyAdBonus: {
      lastClaimedAt: { type: Date },
      countToday: { type: Number, default: 0 },
    },
  },

  createdDate: { type: Date, default: Date.now },
  updatedDate: { type: Date, default: Date.now },
});

export default BTCYRewardSchema;
