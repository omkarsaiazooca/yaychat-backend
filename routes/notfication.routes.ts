import { Router } from 'express';
import {
    registerToken,
    sendNotification,
    getNotifications,
    getAutomationNotifications,
    getAutomationNotificationSummary,
    downloadAutomationNotificationCsv,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getUnreadCount,
    getAllTemplates
} from '../controllers/notification';
import { validateAuthHeader } from "../helpers/middleware";

const notificationRouter = Router();
const alchemyRouter: Router = Router();
//notificationRouter.use(validateAuthHeader);

// ✅ Save user's FCM token
notificationRouter.post('/register-token', registerToken);

// ✅ Trigger push notification (useful for testing or admin ops)
notificationRouter.post('/send-notification', sendNotification);

// 📥 Get paginated inbox
notificationRouter.get('/getAllNotifications/:email', getNotifications);
notificationRouter.get('/automation-notifications', getAutomationNotifications);
notificationRouter.get('/automation-notifications/summary', getAutomationNotificationSummary);
notificationRouter.get('/automation-notifications/channel/:channel', getAutomationNotifications);
notificationRouter.get('/automation-notifications/channel/:channel/download', downloadAutomationNotificationCsv);

// ✅ Mark individual notification as read
notificationRouter.post('/:id/read', markNotificationAsRead);

// ✅ Mark all as read
notificationRouter.post('/read-all', markAllNotificationsAsRead);

// ❌ Delete notification
notificationRouter.post('/:id', deleteNotification);

//count unread notifications
notificationRouter.get('/countUnread/:email', getUnreadCount);

// 📋 Get all notification templates
notificationRouter.get('/templates', getAllTemplates);

export const notificationRoute = notificationRouter;
