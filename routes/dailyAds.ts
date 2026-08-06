import { Router } from 'express';
import { getDailyHistory, getDailyStatus, logAdWatch, logAdWatchNew, resetTodayCount } from '../controllers/dailyAds';


const dailyAdsRouter = Router();

// GET today's status for a user
dailyAdsRouter.get('/status/:email', getDailyStatus);

// POST a watch event (idempotent by watchId)
dailyAdsRouter.post('/watch', logAdWatch);

dailyAdsRouter.post('/new-watch', logAdWatchNew);

// GET historical days (paginated, optional date range)
dailyAdsRouter.get('/history/:email', getDailyHistory);

// (Optional) reset today's counter — protect behind admin middleware if you use one
dailyAdsRouter.post('/reset-today', resetTodayCount);

export const dailyAdsRoute = dailyAdsRouter;
