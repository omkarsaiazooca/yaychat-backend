import express, { Router } from 'express';
import { BTCYRewardController } from '../controllers/btcyRewardsAPI';

const rewardRouter: Router = Router();
const rewardController = new BTCYRewardController();

// Get reward status for user
rewardRouter.get('/status', rewardController.getRewardStatus);

// Update social follow task (body: { email, platform, status })
rewardRouter.post('/follow', rewardController.updateFollowTask);

// Add new route for uploading daily post screenshot (individual update)
rewardRouter.post('/dailypost', rewardController.uploadDailyPostScreenshot);

// Claim daily boost (body: { email })
rewardRouter.post('/claim/daily', rewardController.claimDailyBoost);

// Add watched ad (body: { email })
rewardRouter.post('/claim/ad', rewardController.addWatchedAd);

// Claim follow bonus (body: { email })
rewardRouter.post('/claim/follow', rewardController.claimFollowBonus);

// Claim BTCY Tron airdrop Turbo Power (body: { email })
rewardRouter.post('/claim/airdrop-turbo', rewardController.claimTronAirdropTurbo);

// Check BTCY Tron airdrop status (query: ?email=)
rewardRouter.get('/airdrop/status', rewardController.getTronAirdropStatus);

// Mark BTCY Tron airdrop winner popup as seen (body: { email })
rewardRouter.post('/airdrop/winner-popup-seen', rewardController.markTronAirdropWinnerPopupSeen);

// Admin fetch all rewards
rewardRouter.get('/admin/all', rewardController.adminGetAllRewards);

// Admin updates approval status of social follow task
rewardRouter.post('/admin/approve/follow', rewardController.adminApproveFollowTask);

// Admin updates approval status of daily post
rewardRouter.post('/admin/approve/dailypost', rewardController.adminApproveDailyPost);


export const btcyRewardRoute = rewardRouter;
