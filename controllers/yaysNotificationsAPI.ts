import { Request, Response } from "express";
import { PushDeviceService } from "../services/pushDevice.service";
import { UserService } from "../services/user.service";
import { NotificationPreferenceService } from "../services/notificationPreference.service";
import { YaysNotificationService } from "../services/yaysNotification.service";
import { notificationDelivery } from "../services/notificationDelivery.service";
import {
  buildDeepLink,
  knownRoutes,
} from "../services/notifications/deepLinks";
import { pushTransportStatus } from "../services/notifications/transports";
import { DevicePlatform } from "../data/yaysNotifications";

const devices = new PushDeviceService();
const preferences = new NotificationPreferenceService();
const inbox = new YaysNotificationService();
const users = new UserService();

const PLATFORMS: DevicePlatform[] = ["ios", "android", "web"];

const emailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim().toLowerCase();

const failed = (res: Response, error: any, context: string) => {
  console.error(`[m6/notifications] ${context}`, error);
  return res
    .status(500)
    .json({ message: "The notification service is unavailable right now.", code: "server" });
};

const asInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

export class YaysNotificationsController {
  constructor() {
    // Express drops `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysNotificationsController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /** Public: what the client needs before sign-in to configure itself. */
  async getConfig(_req: Request, res: Response) {
    return res.status(200).json({
      data: {
        transport: pushTransportStatus(),
        routes: knownRoutes(),
        categories: ["messages", "communities", "rewards", "system"],
      },
    });
  }

  async registerDevice(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const deviceId = String(req.body?.deviceId || "").trim();
      const token = String(req.body?.token || "").trim();
      const platform = String(req.body?.platform || "").trim() as DevicePlatform;

      if (!deviceId || !token) {
        return res
          .status(400)
          .json({ message: "deviceId and token are required.", code: "validation" });
      }
      if (!PLATFORMS.includes(platform)) {
        return res
          .status(400)
          .json({ message: "platform must be ios, android, or web.", code: "validation" });
      }

      const device = await devices.register({
        userLower,
        deviceId,
        platform,
        token,
        appVersion: req.body?.appVersion ? String(req.body.appVersion) : undefined,
        osVersion: req.body?.osVersion ? String(req.body.osVersion) : undefined,
        model: req.body?.model ? String(req.body.model) : undefined,
      });

      // Hand the device over from the shared Indexx registry. Once this token
      // is in the M6 registry, the legacy `user.fcmToken` path would push to
      // the same device a second time; clearing it keeps delivery to exactly
      // one notification per event. Matched on the token rather than the email
      // because the token identifies the device regardless of which row holds it.
      await users
        .updatePart({ fcmToken: token }, { $set: { fcmToken: null } })
        .catch((error) => console.error("[m6/notifications] legacy token handover", error));

      return res.status(200).json({
        data: {
          deviceId: device.deviceId,
          platform: device.platform,
          registered: true,
          transport: pushTransportStatus(),
        },
      });
    } catch (error) {
      return failed(res, error, "registerDevice");
    }
  }

  async listDevices(req: Request, res: Response) {
    try {
      const rows = await devices.list(emailOf(req));
      return res.status(200).json({
        data: rows.map((device) => ({
          deviceId: device.deviceId,
          platform: device.platform,
          model: device.model || null,
          appVersion: device.appVersion || null,
          active: !device.disabledAt,
          disabledReason: device.disabledReason || null,
          lastSeenAt: device.lastSeenAt,
        })),
      });
    } catch (error) {
      return failed(res, error, "listDevices");
    }
  }

  async unregisterDevice(req: Request, res: Response) {
    try {
      await devices.unregister(emailOf(req), String(req.params.deviceId || ""));
      return res.status(200).json({ data: { unregistered: true } });
    } catch (error) {
      return failed(res, error, "unregisterDevice");
    }
  }

  async getPreferences(req: Request, res: Response) {
    try {
      return res.status(200).json({ data: await preferences.forUser(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "getPreferences");
    }
  }

  async updatePreferences(req: Request, res: Response) {
    try {
      const updated = await preferences.update(emailOf(req), req.body || {});
      return res.status(200).json({ data: updated });
    } catch (error) {
      return failed(res, error, "updatePreferences");
    }
  }

  async muteConversation(req: Request, res: Response) {
    try {
      const conversationId = String(req.body?.conversationId || "").trim();
      if (!conversationId) {
        return res
          .status(400)
          .json({ message: "conversationId is required.", code: "validation" });
      }
      const muted = req.body?.muted !== false;
      const updated = muted
        ? await preferences.muteConversation(emailOf(req), conversationId)
        : await preferences.unmuteConversation(emailOf(req), conversationId);
      return res.status(200).json({ data: updated });
    } catch (error) {
      return failed(res, error, "muteConversation");
    }
  }

  async listInbox(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const [items, unread] = await Promise.all([
        inbox.inbox(userLower, asInt(req.query.limit, 50), asInt(req.query.skip, 0)),
        inbox.unreadCount(userLower),
      ]);
      return res.status(200).json({
        data: {
          unread,
          items: items.map((item) => ({
            id: String((item as any)._id),
            category: item.category,
            title: item.title,
            body: item.body,
            read: item.read,
            createdAt: item.createdAt,
            deepLink: item.deepLinkRoute
              ? {
                  route: item.deepLinkRoute,
                  params: item.deepLinkParams || {},
                  url: item.deepLinkUrl,
                }
              : null,
          })),
        },
      });
    } catch (error) {
      return failed(res, error, "listInbox");
    }
  }

  async markRead(req: Request, res: Response) {
    try {
      await inbox.markRead(emailOf(req), String(req.params.notificationId || ""));
      return res.status(200).json({ data: { read: true } });
    } catch (error) {
      return failed(res, error, "markRead");
    }
  }

  async markAllRead(req: Request, res: Response) {
    try {
      await inbox.markAllRead(emailOf(req));
      return res.status(200).json({ data: { read: true } });
    } catch (error) {
      return failed(res, error, "markAllRead");
    }
  }

  /**
   * Send a notification to the caller's own devices.
   *
   * This is how a developer verifies the whole chain — permission, token,
   * transport, deep link, tap routing — without needing a second account to
   * message them. It is deliberately restricted to `self`.
   */
  async sendTest(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const route = String(req.body?.route || "notifications.inbox");
      const deepLink = buildDeepLink(route, req.body?.params || {});
      const result = await notificationDelivery.deliver({
        userLower,
        category: "system",
        title: String(req.body?.title || "YaysApp test notification"),
        body: String(req.body?.body || "If you can read this, push is wired up correctly."),
        deepLink: deepLink ?? undefined,
        critical: true,
        data: { type: "test" },
      });
      return res.status(200).json({ data: result });
    } catch (error) {
      return failed(res, error, "sendTest");
    }
  }
}
