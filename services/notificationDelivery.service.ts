import {
  DeliveryAttempt,
  DeliveryRequest,
  DeliveryResult,
  NotificationPreference,
  PushDevice,
  YaysNotification,
} from "../data/yaysNotifications";
import { PushDeviceService } from "./pushDevice.service";
import {
  NotificationPreferenceService,
  categoryEnabled,
  inQuietHours,
} from "./notificationPreference.service";
import { YaysNotificationService } from "./yaysNotification.service";
import { pushTransport } from "./notifications/transports";
import { buildDeepLink } from "./notifications/deepLinks";

/**
 * Module 6 — notification delivery.
 *
 * Every push in YaysApp goes through here so the gates are enforced in one
 * place and in one order:
 *
 *   dedupe → mute → category switch → quiet hours → inbox row → device fan-out
 *
 * The inbox row is written even when no push goes out. A user who has push
 * switched off still needs to find out they were mentioned when they next open
 * the app; suppressing the record along with the push loses the event.
 * `critical` notifications (security, account) skip the category and
 * quiet-hours gates but never skip mute or dedupe.
 */
/**
 * Which gate, if any, stops this notification. `null` means send it.
 *
 * Pure and exported so the ordering — the part that decides whether a person
 * is woken at 3am — is testable without a database.
 */
export const suppressionFor = (
  request: Pick<DeliveryRequest, "conversationId" | "critical" | "category">,
  preference: NotificationPreference,
  at: Date = new Date()
): "muted" | "preference_off" | "quiet_hours" | null => {
  if (
    request.conversationId &&
    (preference.mutedConversationIds || []).includes(request.conversationId)
  ) {
    // Mute is the user's most explicit instruction — it outranks `critical`.
    return "muted";
  }
  if (request.critical) {
    return null;
  }
  if (!categoryEnabled(preference, request.category)) {
    return "preference_off";
  }
  if (inQuietHours(preference.quietHours, at)) {
    return "quiet_hours";
  }
  return null;
};

/**
 * The three repositories delivery needs. Declared as a narrow interface rather
 * than the concrete services so the orchestration — the part that decides
 * whether someone's phone lights up — can be executed without a database.
 */
export interface DeliveryStores {
  devices: Pick<PushDeviceService, "activeFor" | "disable">;
  preferences: Pick<NotificationPreferenceService, "forUser">;
  inbox: Pick<
    YaysNotificationService,
    "isDuplicate" | "create" | "findOne" | "updatePart"
  >;
}

export class NotificationDeliveryService {
  private devices: DeliveryStores["devices"];
  private preferences: DeliveryStores["preferences"];
  private inbox: DeliveryStores["inbox"];

  constructor(stores?: Partial<DeliveryStores>) {
    this.devices = stores?.devices ?? new PushDeviceService();
    this.preferences = stores?.preferences ?? new NotificationPreferenceService();
    this.inbox = stores?.inbox ?? new YaysNotificationService();
  }

  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    const userLower = String(request.userLower || "").trim().toLowerCase();
    if (!userLower) {
      return { outcome: "failed", delivered: 0, attempts: [] };
    }

    if (request.dedupeKey && (await this.inbox.isDuplicate(userLower, request.dedupeKey))) {
      return { outcome: "duplicate", delivered: 0, attempts: [] };
    }

    const preference = await this.preferences.forUser(userLower);
    const suppression = suppressionFor(request, preference);

    const record = await this.recordInbox(userLower, request, suppression ?? "delivered");
    if (suppression) {
      return {
        outcome: suppression,
        notificationId: String((record as any)?._id || ""),
        delivered: 0,
        attempts: [],
      };
    }

    const devices = await this.devices.activeFor(userLower);
    if (!devices.length) {
      await this.inbox.updatePart({ _id: (record as any)._id }, { $set: { outcome: "no_devices" } });
      return {
        outcome: "no_devices",
        notificationId: String((record as any)?._id || ""),
        delivered: 0,
        attempts: [],
      };
    }

    const attempts = await this.fanOut(userLower, devices, request, preference, record);
    const delivered = attempts.filter((attempt) => attempt.ok).length;
    const outcome = delivered > 0 ? "delivered" : "failed";
    await this.inbox.updatePart(
      { _id: (record as any)._id },
      { $set: { outcome, attempts } }
    );

    return {
      outcome,
      notificationId: String((record as any)?._id || ""),
      delivered,
      attempts,
    };
  }

  /** Fan a single notification out to many users (announcements, broadcasts). */
  async deliverMany(
    userLowers: string[],
    request: Omit<DeliveryRequest, "userLower">
  ): Promise<{ delivered: number; results: DeliveryResult[] }> {
    const unique = Array.from(
      new Set(userLowers.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))
    );
    const results: DeliveryResult[] = [];
    // Sequential on purpose: a broadcast to a large audience should not open
    // thousands of concurrent transport calls, and delivery is off the request
    // path anyway.
    for (const userLower of unique) {
      results.push(await this.deliver({ ...request, userLower }));
    }
    return {
      delivered: results.reduce((sum, result) => sum + result.delivered, 0),
      results,
    };
  }

  private async recordInbox(
    userLower: string,
    request: DeliveryRequest,
    outcome: YaysNotification["outcome"]
  ): Promise<YaysNotification> {
    const link = request.deepLink ?? null;
    try {
      return await this.inbox.create({
        userLower,
        category: request.category,
        title: request.title,
        body: request.body,
        dedupeKey: request.dedupeKey ?? null,
        deepLinkRoute: link?.route ?? null,
        deepLinkParams: link?.params ?? null,
        deepLinkUrl: link?.url ?? null,
        read: false,
        readAt: null,
        outcome,
        attempts: [],
        broadcastId: request.broadcastId ?? null,
      } as YaysNotification);
    } catch (error: any) {
      // The unique (userLower, dedupeKey) index is the authority: two workers
      // racing on the same event both pass `isDuplicate`, and the loser lands
      // here. Return the row that won rather than failing the send.
      if (error?.code === 11000 && request.dedupeKey) {
        return this.inbox.findOne({ userLower, dedupeKey: request.dedupeKey });
      }
      throw error;
    }
  }

  private async fanOut(
    userLower: string,
    devices: PushDevice[],
    request: DeliveryRequest,
    preference: NotificationPreference,
    record: YaysNotification
  ): Promise<DeliveryAttempt[]> {
    const transport = pushTransport();
    const link = request.deepLink;
    const data: Record<string, string> = {
      ...(request.data || {}),
      notificationId: String((record as any)?._id || ""),
      category: request.category,
      ...(link
        ? {
            deepLinkRoute: link.route,
            deepLinkUrl: link.url,
            ...Object.fromEntries(
              Object.entries(link.params).map(([key, value]) => [key, String(value)])
            ),
          }
        : {}),
    };

    // Hiding the preview is a lock-screen setting, so it changes the push body
    // only — the inbox row keeps the real text.
    const body = preference.previewText ? request.body : "New notification";

    const attempts: DeliveryAttempt[] = [];
    for (const device of devices) {
      const result = await transport.send({
        token: device.token,
        platform: device.platform,
        title: request.title,
        body,
        data,
        sound: preference.sounds,
      });
      attempts.push({
        deviceId: device.deviceId,
        platform: device.platform,
        ok: result.ok,
        error: result.error,
        tokenGone: result.tokenGone,
      });
      if (result.tokenGone) {
        await this.devices
          .disable(userLower, device.deviceId, result.error || "token_gone")
          .catch(() => {});
      }
    }
    return attempts;
  }
}

/** Shared instance — the delivery service holds no per-request state. */
export const notificationDelivery = new NotificationDeliveryService();

/**
 * Chat's entry point. Kept here rather than in the chat controller so the
 * conversation-id scheme, the deep link, and the dedupe key stay in one place.
 */
export const deliverChatMessage = async (input: {
  recipientEmail: string;
  senderEmail: string;
  senderName: string;
  preview: string;
  conversationId: string;
  messageId: string;
  groupName?: string;
}): Promise<DeliveryResult> => {
  const deepLink = buildDeepLink("chat.conversation", {
    conversationId: input.conversationId,
  });
  const title = input.groupName
    ? `${input.senderName} · ${input.groupName}`
    : input.senderName;

  return notificationDelivery.deliver({
    userLower: input.recipientEmail,
    category: input.groupName ? "communities" : "messages",
    title,
    body: input.preview,
    conversationId: input.conversationId,
    // One push per message per recipient, however many times the send retries.
    dedupeKey: `msg:${input.messageId}`,
    deepLink: deepLink ?? undefined,
    data: {
      type: "chat_message",
      conversationId: input.conversationId,
      messageId: input.messageId,
      from: String(input.senderEmail || "").toLowerCase(),
    },
  });
};
