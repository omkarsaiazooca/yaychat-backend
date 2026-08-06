import { Router, Request, Response } from 'express';
import { BTCYRewardService } from '../services/btcyReward.service';
import { UserService } from '../services/user.service';
import { NotificationService } from '../services/notification.service';

const emmmBonusRouter: Router = Router();
const rewardService = new BTCYRewardService();
const userService = new UserService();
const notificationService = new NotificationService();

const EMMM_API_KEY =
  process.env.INDEXX_EMMM_API_KEY ||
  process.env.EMMM_API_KEY ||
  '';

const validateEmmmKey = (req: Request, res: Response, next: () => void) => {
  const apiKey = String(req.headers?.['x-emmm-key'] || '').trim();
  if (!EMMM_API_KEY || apiKey !== EMMM_API_KEY) {
    res.status(403).json({ message: 'Forbidden: invalid x-emmm-key' });
    return;
  }
  next();
};

// POST /api/v1/emmm/bonus/turbo
// Body: { email, days, reason }
// Grants BTCY turbo mining days to a user
emmmBonusRouter.post('/turbo', validateEmmmKey, async (req: Request, res: Response) => {
  try {
    const { email, days, reason } = req.body;
    if (!email || !days || typeof days !== 'number' || days <= 0) {
      res.status(400).json({ message: 'email and days (positive number) are required' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userService.findOneSelect({ email: normalizedEmail }, { email: 1 });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const sourceSuffix = String(reason || 'EMMM_CREATOR_BONUS').trim();
    const reward = await rewardService.grantTurboDays(normalizedEmail, days, sourceSuffix);

    if (sourceSuffix === 'EMMM_BTCY_FIRST_BET_TURBO_7D') {
      notificationService.sendEmmmFirstBetTurboUnlocked(normalizedEmail, {
        user,
        days,
        source: sourceSuffix,
      }).catch((error: any) => {
        console.error('[emmmBonus] failed to send BTCY app turbo notification:', error?.message || error);
      });
    }

    res.json({
      status: 200,
      data: {
        email: normalizedEmail,
        daysGranted: days,
        turboTimeMinutes: reward.turboTimeMinutes,
        reason: sourceSuffix,
      },
    });
  } catch (err: any) {
    console.error('[emmmBonus] turbo grant error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to grant turbo mining' });
  }
});

// POST /api/v1/emmm/bonus/nuggets
// Body: { email, amount, reason }
// Adds nuggets to a user's balance
emmmBonusRouter.post('/nuggets', validateEmmmKey, async (req: Request, res: Response) => {
  try {
    const { email, amount, reason } = req.body;
    if (!email || !amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'email and amount (positive number) are required' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userService.findOneSelect({ email: normalizedEmail }, { email: 1 });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await userService.updatePart(
      { email: normalizedEmail },
      { $inc: { nuggetBalance: amount } }
    );

    const updated = await userService.findOneSelect({ email: normalizedEmail }, { nuggetBalance: 1 });
    res.json({
      status: 200,
      data: {
        email: normalizedEmail,
        nuggetsGranted: amount,
        nuggetBalance: updated?.nuggetBalance || 0,
        reason: String(reason || 'EMMM_CREATOR_BONUS').trim(),
      },
    });
  } catch (err: any) {
    console.error('[emmmBonus] nuggets grant error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to grant nuggets' });
  }
});

// POST /api/v1/emmm/bonus/vip
// Body: { email, vipLevel, reason }
// Sets VIP level on a user's account
emmmBonusRouter.post('/vip', validateEmmmKey, async (req: Request, res: Response) => {
  try {
    const { email, vipLevel, reason } = req.body;
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userService.findOneSelect({ email: normalizedEmail }, { email: 1 });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const level = String(vipLevel || 'vip_partner').trim();
    await userService.updatePart(
      { email: normalizedEmail },
      { $set: { vipLevel: level } }
    );

    res.json({
      status: 200,
      data: {
        email: normalizedEmail,
        vipLevel: level,
        reason: String(reason || 'EMMM_CREATOR_VIP').trim(),
      },
    });
  } catch (err: any) {
    console.error('[emmmBonus] vip grant error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to set VIP status' });
  }
});

export default emmmBonusRouter;
