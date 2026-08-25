import { IModel } from "./base";

/**
 * Module 6 — Notifications.
 *
 * YaysApp keeps its own device registry rather than the single `user.fcmToken`
 * the Indexx apps share, because chat has to reach every device a person is
 * signed in on and has to survive one device revoking permission.
 */

export type DevicePlatform = "ios" | "android" | "web";

export type NotificationCategory =
  | "messages"
  | "communities"
  | "rewards"
  | "system";

export interface PushDevice extends IModel {
  /** Lower-cased account email — the join key used everywhere in this backend. */
  userLower: string;
  /** Stable per-install id from the client; one row per (user, install). */
  deviceId: string;
  platform: DevicePlatform;
  /** FCM registration token or APNs device token. */
  token: string;
  appVersion?: string;
  osVersion?: string;
  model?: string;
  /** Set when the transport reports the token is gone; row is kept for audit. */
  disabledAt?: Date | null;
  disabledReason?: string | null;
  lastSeenAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Quiet hours are stored as local minutes-from-midnight plus the device's UTC offset. */
export interface QuietHours {
  enabled: boolean;
  /** 0–1439, local time. `start > end` means the window wraps past midnight. */
  startMinute: number;
  endMinute: number;
  /** Minutes to add to UTC to get the user's local time (e.g. +330 for IST). */
  utcOffsetMinutes: number;
}

export interface NotificationPreference extends IModel {
  userLower: string;
  messages: boolean;
  communities: boolean;
  rewards: boolean;
  system: boolean;
  sounds: boolean;
  /** Hide the message body on the lock screen. */
  previewText: boolean;
  quietHours: QuietHours;
  /** Conversation ids the user muted; checked before every message push. */
  mutedConversationIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type DeepLinkRoute =
  | "chat.conversation"
  | "chat.list"
  | "community.list"
  | "community.detail"
  | "community.chat"
  | "rewards.home"
  | "rewards.referral"
  | "notifications.inbox"
  | "support.ticket"
  | "calls.incoming"
  | "calls.history";

export interface DeepLink {
  route: DeepLinkRoute;
  params: Record<string, string>;
  /** `yaychat://…` — what the client parses on a notification tap. */
  url: string;
}

export type DeliveryOutcome =
  | "delivered"
  | "no_devices"
  | "muted"
  | "preference_off"
  | "quiet_hours"
  | "duplicate"
  | "failed";

export interface DeliveryAttempt {
  deviceId: string;
  platform: DevicePlatform;
  ok: boolean;
  error?: string;
  /** True when the transport says the token is permanently invalid. */
  tokenGone?: boolean;
}

export interface YaysNotification extends IModel {
  userLower: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Stable key for one logical event; a repeat within the window is dropped. */
  dedupeKey?: string | null;
  deepLinkRoute?: DeepLinkRoute | null;
  deepLinkParams?: Record<string, string> | null;
  deepLinkUrl?: string | null;
  read: boolean;
  readAt?: Date | null;
  outcome: DeliveryOutcome;
  attempts: DeliveryAttempt[];
  /** Set when an admin broadcast produced this row. */
  broadcastId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** What a caller hands the delivery service. */
export interface DeliveryRequest {
  userLower: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink?: DeepLink;
  dedupeKey?: string;
  /** Conversation to check against the user's mute list. */
  conversationId?: string;
  /** System/security notices ignore quiet hours and category switches. */
  critical?: boolean;
  broadcastId?: string;
  /** Extra key/values merged into the push `data` payload. */
  data?: Record<string, string>;
}

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  notificationId?: string;
  /** How many devices the transport accepted. */
  delivered: number;
  attempts: DeliveryAttempt[];
}
