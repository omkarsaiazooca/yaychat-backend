import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { format } from "fast-csv";
import userSchema from '../models/user.js';
import { pushToMany } from '../services/push.service.js';
import { NotificationService } from '../services/notification.service.js';
import { NotificationTemplateService } from '../services/notificationTemplate.service.js';
const notificationService: NotificationService = new NotificationService()
const notificationTemplateService: NotificationTemplateService = new NotificationTemplateService()
const User = mongoose.model('User', userSchema);

const DEFAULT_DAYS_RANGE = 7;

const parseDate = (value: any) => {
  if (!value) return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const normalizeDateRange = (params: { from?: any; to?: any; date?: any }) => {
  let fromDate = parseDate(params.from);
  if (params.from && !fromDate) return { error: 'Invalid from date' };

  let toDate = parseDate(params.to);
  if (params.to && !toDate) return { error: 'Invalid to date' };

  if (params.date) {
    const d = parseDate(params.date);
    if (!d) return { error: 'Invalid date' };
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    fromDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  }

  if (!fromDate && !toDate) {
    const now = new Date();
    toDate = now;
    fromDate = new Date(now.getTime() - DEFAULT_DAYS_RANGE * 24 * 60 * 60 * 1000);
  } else if (fromDate && !toDate) {
    toDate = new Date();
  } else if (!fromDate && toDate) {
    fromDate = new Date(toDate.getTime() - DEFAULT_DAYS_RANGE * 24 * 60 * 60 * 1000);
  }

  return { fromDate, toDate };
};

const parseCursor = (value: any) => {
  if (!value) return undefined;
  const parts = String(value).split('|');
  if (parts.length !== 2) return undefined;
  const [datePart, idPart] = parts;
  const createdAt = new Date(datePart);
  if (Number.isNaN(createdAt.getTime())) return undefined;
  if (!mongoose.Types.ObjectId.isValid(idPart)) return undefined;
  return { createdAt, id: idPart };
};

export async function registerToken(req: any, res: any) {
  const { userId, fcmToken, deviceType, deviceModel, osVersion, uniqueId, brand } = req.body;
  if (!userId || !fcmToken || !deviceType)
    return res.status(400).json({ error: 'missing fields' });

  await User.findByIdAndUpdate(
    userId,
    {
      fcmToken,
      deviceType,
      deviceModel,
      osVersion,
      uniqueId,
      brand,
      lastActive: new Date()
    },
    { new: true }
  );

  res.json({ status: 'registered' });
}

export async function sendNotification(req: any, res: any) {
  // ✅ New
  const { emails, title, body, data } = req.body;
  if (!Array.isArray(emails) || !title || !body)
    return res.status(400).json({ error: 'bad request' });

  // Replace pushToMany by retrieving users by email and calling notificationService
  const users = await User.find({ email: { $in: emails } });
  await Promise.all(users.map(user =>
    notificationService.sendNotification(user, data?.type || 'generic', data)
  ));

  res.json({ status: 'sent' });
}


// 📥 Get all notifications (paginated)
export const getNotifications = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { email } = req.params;

    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const { notifications, total } = await notificationService.getUserNotifications(
      email,
      Number(page),
      Number(limit)
    );

    res.json({ success: true, total, data: notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};


// Get automation notifications delivered to users (paginated)
export const getAutomationNotifications = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 20, email, from, to, channel, type, date } = req.query;
    const channelParam = req.params?.channel;
    const channelValue = String(channelParam || channel || type || '').trim();

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const safePage = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
    const MAX_AUTOMATION_LIMIT = 1000;
    const DEFAULT_AUTOMATION_LIMIT = 1000;
    const safeLimit =
      Number.isFinite(limitNum) && limitNum > 0
        ? Math.min(limitNum, MAX_AUTOMATION_LIMIT)
        : DEFAULT_AUTOMATION_LIMIT;

    const rawCursor =
      typeof req.query.cursor === 'string' && req.query.cursor.trim()
        ? decodeURIComponent(req.query.cursor)
        : undefined;

    const range = normalizeDateRange({ from, to, date });
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }

    const cursor = parseCursor(rawCursor);

    const types = channelValue ? [channelValue] : undefined;

    const { notifications, total, nextCursor } = await notificationService.getAutomationNotifications({
      page: safePage,
      limit: safeLimit,
      email: email ? String(email) : undefined,
      from: range.fromDate || undefined,
      to: range.toDate || undefined,
      types,
      cursor,
    });

    res.json({
      success: true,
      total,
      data: notifications,
      page: safePage,
      limit: safeLimit,
      nextCursor,
      hasMore: Boolean(nextCursor)
    });
  } catch (err) {
    console.error('Error fetching automation notifications:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const getAutomationNotificationSummary = async (req: any, res: any) => {
  try {
    const { email, from, to, date } = req.query;
    const range = normalizeDateRange({ from, to, date });
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }

    const result = await notificationService.getAutomationNotificationSummary({
      email: email ? String(email) : undefined,
      from: range.fromDate || undefined,
      to: range.toDate || undefined,
    });

    const now = new Date();
    const status = range.toDate && range.toDate < now ? 'Ended' : 'Active';
    const startDate = range.fromDate ? range.fromDate.toISOString() : null;
    const endDate = range.toDate ? range.toDate.toISOString() : null;

    const data = result.channels.map((item) => {
      const fromKey = range.fromDate
        ? range.fromDate.toISOString().slice(0, 10)
        : 'from';
      const toKey = range.toDate
        ? range.toDate.toISOString().slice(0, 10)
        : 'to';
      const jobId = `automation_${item.channel}_${fromKey}_${toKey}`;

      return {
        jobId,
        title: item.title || '',
        channel: item.channel,
        status,
        startDate,
        endDate,
        count: item.count,
        lastSentAt: item.lastCreatedAt
          ? new Date(item.lastCreatedAt).toISOString()
          : null,
      };
    });

    res.json({
      success: true,
      total: result.total,
      data,
    });
  } catch (err) {
    console.error('Error fetching automation notification summary:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const downloadAutomationNotificationCsv = async (req: any, res: any) => {
  try {
    const { email, from, to, date, limit } = req.query;
    const channelParam = req.params?.channel;
    const channelValue = String(channelParam || '').trim();
    if (!channelValue) {
      return res.status(400).json({ success: false, error: 'channel is required' });
    }

    const range = normalizeDateRange({ from, to, date });
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }

    const safeLimit = Math.min(
      5000,
      Math.max(1, Number(limit) || 1000)
    );

    const fileSafeChannel = channelValue.replace(/[^a-z0-9_-]+/gi, '_');
    const fromIso = range.fromDate ? range.fromDate.toISOString().slice(0, 10) : 'from';
    const toIso = range.toDate ? range.toDate.toISOString().slice(0, 10) : 'to';
    const filename = `automation_${fileSafeChannel}_${fromIso}_to_${toIso}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const csvStream = format({
      headers: ['email', 'type', 'title', 'createdAt', 'sentAt'],
    });
    csvStream.pipe(res);

    let cursor: { createdAt: Date; id: string } | undefined = undefined;

    while (true) {
      const result = await notificationService.getAutomationNotifications({
        limit: safeLimit,
        email: email ? String(email) : undefined,
        from: range.fromDate || undefined,
        to: range.toDate || undefined,
        types: [channelValue],
        cursor,
      });

      for (const notif of result.notifications) {
        const createdAt = (notif as any).createdAt || (notif as any).created || null;
        const sentAt = (notif as any).pushedLottoAirdropDate || createdAt || null;
        csvStream.write({
          email: (notif as any).email || '',
          type: (notif as any).type || '',
          title: (notif as any).title || '',
          createdAt: createdAt ? new Date(createdAt).toISOString() : '',
          sentAt: sentAt ? new Date(sentAt).toISOString() : '',
        });
      }

      if (!result.nextCursor) break;
      const next = parseCursor(result.nextCursor);
      if (!next) break;
      cursor = next;
    }

    csvStream.end();
  } catch (err) {
    console.error('Error downloading automation notification CSV:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Mark single notification as read
export const markNotificationAsRead = async (req: any, res: any) => {
  try {
    const updated = await notificationService.updatePart(
      { notificationId: req.params.id, email: req.body.email, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ✅ Mark all notifications as read
export const markAllNotificationsAsRead = async (req: any, res: any) => {
  try {
    await notificationService.updateMany(
      { email: req.body.email, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ❌ Delete notification
export const deleteNotification = async (req: any, res: any) => {
  try {
    await notificationService.deleteNotification(
      req.params.id,
      req.body.email
    );
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 📥 Get all notifications (paginated)
export const getUnreadCount = async (req: any, res: any) => {
  try {
    const { email } = req.params;

    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const total = await notificationService.getUnreadCount(
      email,
    );

    res.json({ success: true, total, data: total });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 📋 Get all notification templates
export const getAllTemplates = async (req: any, res: any) => {
  try {
    const templates = await notificationTemplateService.getAllTemplates();
    res.json({ success: true, data: templates });
  } catch (err) {
    console.error('Error fetching notification templates:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
