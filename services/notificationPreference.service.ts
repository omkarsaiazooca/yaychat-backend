import { ServiceBase } from "./base";
import notificationPreferenceSchema, {
  NotificationPreferenceModel,
} from "../models/notificationPreference";
import {
  NotificationCategory,
  NotificationPreference,
  QuietHours,
} from "../data/yaysNotifications";

const clampMinute = (value: unknown, fallback: number): number => {
  const minute = Number(value);
  if (!Number.isFinite(minute)) {
    return fallback;
  }
  return Math.min(1439, Math.max(0, Math.floor(minute)));
};

const clampOffset = (value: unknown): number => {
  const offset = Number(value);
  if (!Number.isFinite(offset)) {
    return 0;
  }
  // Real UTC offsets span -12:00 to +14:00.
  return Math.min(840, Math.max(-720, Math.floor(offset)));
};

export class NotificationPreferenceService extends ServiceBase<
  NotificationPreference,
  NotificationPreferenceModel
> {
  constructor() {
    super(notificationPreferenceSchema, "YaysNotificationPreference");
  }

  async forUser(userLower: string): Promise<NotificationPreference> {
    return this.upsertOneAndGet(
      { userLower },
      { $setOnInsert: { userLower } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async update(
    userLower: string,
    patch: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    const set: Record<string, unknown> = {};
    for (const key of [
      "messages",
      "communities",
      "rewards",
      "system",
      "sounds",
      "previewText",
    ] as const) {
      if (typeof patch[key] === "boolean") {
        set[key] = patch[key];
      }
    }
    if (patch.quietHours && typeof patch.quietHours === "object") {
      const current = await this.forUser(userLower);
      const incoming = patch.quietHours as Partial<QuietHours>;
      set.quietHours = {
        enabled:
          typeof incoming.enabled === "boolean"
            ? incoming.enabled
            : current.quietHours.enabled,
        startMinute: clampMinute(incoming.startMinute, current.quietHours.startMinute),
        endMinute: clampMinute(incoming.endMinute, current.quietHours.endMinute),
        utcOffsetMinutes:
          incoming.utcOffsetMinutes === undefined
            ? current.quietHours.utcOffsetMinutes
            : clampOffset(incoming.utcOffsetMinutes),
      };
    }

    return this.upsertOneAndGet(
      { userLower },
      { $set: set, $setOnInsert: { userLower } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async muteConversation(userLower: string, conversationId: string): Promise<NotificationPreference> {
    return this.upsertOneAndGet(
      { userLower },
      { $addToSet: { mutedConversationIds: conversationId }, $setOnInsert: { userLower } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async unmuteConversation(userLower: string, conversationId: string): Promise<NotificationPreference> {
    return this.upsertOneAndGet(
      { userLower },
      { $pull: { mutedConversationIds: conversationId }, $setOnInsert: { userLower } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async forMany(userLowers: string[]): Promise<Map<string, NotificationPreference>> {
    const rows = userLowers.length
      ? await this.find({ userLower: { $in: userLowers } })
      : [];
    return new Map(rows.map((row) => [row.userLower, row]));
  }
}

/** Whether a category is switched on. Unknown categories are treated as on. */
export const categoryEnabled = (
  preference: NotificationPreference | undefined,
  category: NotificationCategory
): boolean => {
  if (!preference) {
    return true;
  }
  const value = (preference as any)[category];
  return typeof value === "boolean" ? value : true;
};

/**
 * Whether `at` falls inside the user's quiet window.
 *
 * Stored as local minutes plus the device's UTC offset so the window follows
 * the user rather than the server. A window whose start is after its end
 * (22:00 → 07:00) wraps past midnight.
 */
export const inQuietHours = (
  quietHours: QuietHours | undefined,
  at: Date = new Date()
): boolean => {
  if (!quietHours?.enabled) {
    return false;
  }
  const { startMinute, endMinute, utcOffsetMinutes } = quietHours;
  if (startMinute === endMinute) {
    return false;
  }
  const utcMinuteOfDay = at.getUTCHours() * 60 + at.getUTCMinutes();
  const localMinutes = (((utcMinuteOfDay + utcOffsetMinutes) % 1440) + 1440) % 1440;
  return startMinute < endMinute
    ? localMinutes >= startMinute && localMinutes < endMinute
    : localMinutes >= startMinute || localMinutes < endMinute;
};
