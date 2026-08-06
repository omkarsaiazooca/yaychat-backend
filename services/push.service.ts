import admin from '../config/firebase.js';
import { apnProvider } from '../config/apns.js';
import mongoose from 'mongoose';
import userSchema from '../models/user.js';   // your existing schema
import logger from '../helpers/logger.js';
import apn from 'apn';

const User = mongoose.model('User', userSchema);

export async function pushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const user = await User.findById(userId).lean();
  if (!user?.fcmToken) return logger.warn(`No fcmToken for user ${userId}`);

  if (user.deviceType === 'android') {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data
    });
    return logger.info(`FCM sent → ${userId}`);
  }

  if (user.deviceType === 'ios') {
    const note = new apn.Notification({
      alert: { title, body },
      payload: data,
      topic: process.env.APNS_BUNDLE_ID
    });
    await apnProvider.send(note, user.fcmToken);
    return logger.info(`APNs sent → ${userId}`);
  }
}

export function pushToMany(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  return Promise.all(userIds.map(id => pushToUser(id, title, body, data)));
}
