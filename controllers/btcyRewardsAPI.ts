import { Request, Response } from 'express';
import { BTCYRewardService } from '../services/btcyReward.service';
import { BTCYTronAirdropService } from '../services/btcyTronAirdrop.service';
import { UserService } from '../services/user.service';

const rewardService = new BTCYRewardService();
const tronAirdropService = new BTCYTronAirdropService();
const userService = new UserService();

export class BTCYRewardController {
  async getRewardStatus(req: Request, res: Response) {
    try {
      const { email } = req.query;
      console.log('Getting reward status for email:', email);
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.getOrCreateReward(user.email);
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: reward
      });
      return;
    } catch (err) {
      console.error('Error getting reward status:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateFollowTask(req: Request, res: Response) {
    try {
      const { email, url, platform } = req.body;
      if (!email || !url) return res.status(400).json({ message: 'Email and platform are required' });

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.uploadSocialScreenshot(user.email, platform, url);
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: reward
      });
      return;
    } catch (err) {
      console.error('Error updating follow task:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async uploadDailyPostScreenshot(req: Request, res: Response) {
    try {
      const { email, screenshotUrl } = req.body;
      if (!email || !screenshotUrl) {
        return res.status(400).json({ message: 'Email, screenshotUrl are required' });
      }

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.uploadDailyPostScreenshot(user.email, screenshotUrl);

      res.status(200).json({
        status: 200,
        message: 'Daily post screenshot uploaded successfully',
        data: reward,
      });
    } catch (err: any) {
      console.error('Error uploading daily post screenshot:', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  }

  async adminGetAllRewards(req: Request, res: Response) {
    try {

      const rewards = await rewardService.adminGetAllRewards();
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: rewards
      });
      return;
    } catch (err) {
      console.error('Error updating follow task:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async claimDailyBoost(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.claimDailyBoost(user.email);
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: reward
      });
      return;
    } catch (err) {
      console.error('Error claiming daily boost:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async addWatchedAd(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.addWatchedAd(user.email);
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: reward
      });
      return;
    } catch (err) {
      console.error('Error adding watched ad:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async claimFollowBonus(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const user = await userService.findOneSelect({ email: email }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const reward = await rewardService.claimFollowBonus(user.email);
      res.statusCode = 200;
      res.status(200).json({
        status: 200,
        data: reward
      });
      return;
    } catch (err) {
      console.error('Error claiming follow bonus:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async claimTronAirdropTurbo(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await userService.findOneSelect({ email: normalizedEmail }, {});
      if (!user) return res.status(404).json({ message: 'User not found' });

      const airdropEntry = await tronAirdropService.findOne({ email: normalizedEmail });
      if (!airdropEntry) {
        return res.status(404).json({ message: 'Airdrop entry not found' });
      }

      if (airdropEntry.isWinner === true) {
        return res.status(400).json({ message: 'Winners are not eligible for Turbo claim' });
      }

      if (airdropEntry.turboClaimed) {
        return res.status(409).json({ message: 'Turbo already claimed' });
      }

      const claimedAt = new Date();
      const expiresAt = new Date(claimedAt);
      expiresAt.setDate(expiresAt.getDate() + 14);

      await rewardService.grantTurboDays(
        normalizedEmail,
        7,
        `btcy_tron_airdrop@${airdropEntry._id}`
      );

      await tronAirdropService.updatePart(
        { _id: airdropEntry._id },
        {
          $set: {
            turboClaimed: true,
            turboClaimedAt: claimedAt,
            turboExpiresAt: expiresAt,
          },
        }
      );

      res.status(200).json({
        status: 200,
        message: 'Turbo activated',
        data: { turboExpiresAt: expiresAt },
      });
      return;
    } catch (err) {
      console.error('Error claiming BTCY Tron airdrop turbo:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getTronAirdropStatus(req: Request, res: Response) {
    try {
      const rawEmail = req.query.email || req.body?.email;
      if (!rawEmail) return res.status(400).json({ message: 'Email is required' });

      const normalizedEmail = String(rawEmail).trim().toLowerCase();
      const entry = await tronAirdropService.findOne({ email: normalizedEmail });

      const participated = !!entry;
      const isWinner = entry?.isWinner === true;
      const isWinnerPopupSeen = entry?.isWinnerPopupSeen === true;
      const turboClaimed = entry?.turboClaimed === true;
      const isEligibleForTurbo = participated && !isWinner && !turboClaimed;

      res.status(200).json({
        status: 200,
        data: {
          participated,
          isWinner,
          isWinnerPopupSeen,
          turboClaimed,
          isEligibleForTurbo,
        },
      });
      return;
    } catch (err) {
      console.error('Error checking BTCY Tron airdrop status:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async markTronAirdropWinnerPopupSeen(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const normalizedEmail = String(email).trim().toLowerCase();
      const entry = await tronAirdropService.findOne({ email: normalizedEmail });
      if (!entry) {
        return res.status(404).json({ message: 'Airdrop entry not found' });
      }

      if (entry.isWinner !== true) {
        return res.status(400).json({ message: 'Only winners can update popup status' });
      }

      if (entry.isWinnerPopupSeen === true) {
        return res.status(200).json({
          status: 200,
          data: { isWinnerPopupSeen: true },
        });
      }

      await tronAirdropService.updatePart(
        { _id: entry._id },
        { $set: { isWinnerPopupSeen: true } }
      );

      res.status(200).json({
        status: 200,
        message: 'Winner popup marked as seen',
        data: { isWinnerPopupSeen: true },
      });
      return;
    } catch (err) {
      console.error('Error marking winner popup as seen:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async adminApproveFollowTask(req: Request, res: Response) {
    try {
      const { email, platform, approved } = req.body;
      if (!email || !platform || approved === undefined) {
        return res.status(400).json({ message: 'Email, platform, and approved status are required' });
      }

      const reward = await rewardService.adminApproveFollowTask(email, platform, approved);

      res.status(200).json({ message: `Follow task ${approved ? 'approved' : 'rejected'}`, reward });
    } catch (err) {
      console.error('Error approving follow task:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async adminApproveDailyPost(req: Request, res: Response) {
    try {
      const { email, postId, liked, shared, commented } = req.body;
      if (!email || !postId) {
        return res.status(400).json({ message: 'Email and postId are required' });
      }

      const reward = await rewardService.adminApproveDailyPost(email, postId, liked, shared, commented)

      res.status(200).json({ message: 'Daily post updated by admin', reward });
    } catch (err) {
      console.error('Error approving daily post:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
