import { ServiceBase } from "./base";
import yaysNotificationSchema, {
  YaysNotificationModel,
} from "../models/yaysNotification";
import { YaysNotification } from "../data/yaysNotifications";

export class YaysNotificationService extends ServiceBase<
  YaysNotification,
  YaysNotificationModel
> {
  constructor() {
    super(yaysNotificationSchema, "YaysNotification");
  }

  async inbox(userLower: string, limit = 50, skip = 0): Promise<YaysNotification[]> {
    return this.findPaginatedSkip(
      Math.min(Math.max(limit, 1), 100),
      Math.max(skip, 0),
      { createdAt: -1 },
      { userLower },
      {}
    );
  }

  async unreadCount(userLower: string): Promise<number> {
    return this.findCount({ userLower, read: false });
  }

  async markRead(userLower: string, notificationId: string): Promise<void> {
    await this.updatePart(
      { _id: notificationId, userLower },
      { $set: { read: true, readAt: new Date() } }
    );
  }

  async markAllRead(userLower: string): Promise<void> {
    await this.updateMany(
      { userLower, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
  }

  /** True when this exact notification was already recorded for the user. */
  async isDuplicate(userLower: string, dedupeKey: string): Promise<boolean> {
    return (await this.findCount({ userLower, dedupeKey })) > 0;
  }
}
