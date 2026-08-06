import { Request, Response } from 'express';
import { DailyAdDayService } from '../services/dailyAds.service';

const dailyAdsService = new DailyAdDayService();

/**
 * GET /ads/status/:email
 */
export async function getDailyStatus(req: Request, res: Response) {
    try {
        const email = String(req.params.email || '').toLowerCase().trim();
        const limit = Number(req.query.limit ?? 25); // default daily limit = 25, override per query if needed
        if (!email) return res.status(400).json({ success: false, error: 'email required' });

        const status = await dailyAdsService.getStatus(email, limit);
        res.json({ success: true, data: status });
    } catch (e: any) {
        console.error('getDailyStatus error:', e);
        res.status(500).json({ success: false, error: e.message || 'server error' });
    }
}

/**
 * POST /ads/watch
 * body: { email, adId, watchId, secondsWatched }
 * - email: string (required)
 * - adId: string (required)  // id of the ad watched
 * - watchId: string (required) // unique client-generated id per completed watch to enforce idempotency
 * - secondsWatched: number (optional, for analytics)
 */
export async function logAdWatch(req: Request, res: Response) {
    try {
        const { email, adId, watchId, secondsWatched } = req.body || {};
        if (!email || !adId || !watchId) {
            return res.status(400).json({ success: false, error: 'email, adId, watchId required' });
        }
        const limit = Number(req.query.limit ?? 25);

        const result = await dailyAdsService.logWatch(
            String(email).toLowerCase().trim(),
            String(adId),
            String(watchId),
            typeof secondsWatched === 'number' ? secondsWatched : undefined,
            limit
        );

        res.json({ success: true, data: result });
    } catch (e: any) {
        console.error('logAdWatch error:', e);
        res.status(500).json({ success: false, error: e.message || 'server error' });
    }
}

/**
 * POST /ads/watch
 * body: { email, adId, watchId, secondsWatched }
 * - email: string (required)
 * - adId: string (required)  // id of the ad watched
 * - watchId: string (required) // unique client-generated id per completed watch to enforce idempotency
 * - secondsWatched: number (optional, for analytics)
 */
export async function logAdWatchNew(req: Request, res: Response) {
    try {
        const { email, adId, watchId, secondsWatched } = req.body || {};
        if (!email || !adId || !watchId) {
            return res.status(400).json({ success: false, error: 'email, adId, watchId required' });
        }
        const limit = Number(req.query.limit ?? 25);

        const result = await dailyAdsService.logWatchV2(
            String(email).toLowerCase().trim(),
            String(adId),
            String(watchId),
            typeof secondsWatched === 'number' ? secondsWatched : undefined,
            limit
        );

        res.json({ success: true, data: result });
    } catch (e: any) {
        console.error('logAdWatch error:', e);
        res.status(500).json({ success: false, error: e.message || 'server error' });
    }
}

/**
 * GET /ads/history/:email?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
 */
export async function getDailyHistory(req: Request, res: Response) {
    try {
        const email = String(req.params.email || '').toLowerCase().trim();
        if (!email) return res.status(400).json({ success: false, error: 'email required' });

        const { from, to } = req.query as any;
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 20);

        const data = await dailyAdsService.getHistory(email, { from, to, page, limit });
        res.json({ success: true, ...data });
    } catch (e: any) {
        console.error('getDailyHistory error:', e);
        res.status(500).json({ success: false, error: e.message || 'server error' });
    }
}

/**
 * POST /ads/reset-today
 * body: { email }
 * (Optional: only for admin/testing)
 */
export async function resetTodayCount(req: Request, res: Response) {
    try {
        const email = String(req.body?.email || '').toLowerCase().trim();
        if (!email) return res.status(400).json({ success: false, error: 'email required' });

        const ok = await dailyAdsService.resetToday(email);
        res.json({ success: true, data: ok });
    } catch (e: any) {
        console.error('resetTodayCount error:', e);
        res.status(500).json({ success: false, error: e.message || 'server error' });
    }
}
