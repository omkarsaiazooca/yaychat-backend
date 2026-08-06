import { getMessaging } from "firebase-admin/messaging";
import { UserService } from "./user.service";
import { ENFORCE_TEST_GUARD, TEST_ALLOWED_EMAILS } from "../config/notifyTestGuard";

export type AdminAudience =
  | { type: "topic"; topic: string }
  | { type: "tokens"; tokens?: string[]; emails?: string[] };

export type AdminNotification = {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
  clickAction?: string;
  ttlSeconds?: number;
  androidChannelId?: string;
};

export type AdminBroadcastResult = {
  requested: number;
  attempted: number;
  success: number;
  failure: number;
  invalidTokens: string[];
  results: Array<{ token?: string; success: boolean; messageId?: string; error?: string }>;
};

const dedupe = <T,>(a: T[]) => [...new Set(a.filter(Boolean as any))];
const chunk  = <T,>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i*n, i*n+n));
const stringify = (data?: AdminNotification["data"]): Record<string,string> | undefined =>
  data ? Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v == null ? "" : String(v)])) : undefined;

// NOTE: projects only `fcmToken` (single string)
async function tokensByEmails0(emails: string[], userService = new UserService()): Promise<string[]> {
  if (!emails?.length) return [];
  const lower = emails.map(e => String(e).toLowerCase());
  const users = await userService.findSelect({ email: { $in: lower } }, { fcmToken: 1 });
  return dedupe(users.map((u: any) => u?.fcmToken).filter(Boolean));
}

export async function sendAdminNotification(
  audience: AdminAudience,
  notif: AdminNotification,
  opts?: { dryRun?: boolean }
): Promise<AdminBroadcastResult> {
  return audience.type === "topic"
    ? sendToTopic(audience.topic, notif, opts)
    : sendToTokens(await resolveTokens(audience), notif, opts);
}

async function resolveTokens(a: Extract<AdminAudience, { type: "tokens" }>) {
  const t: string[] = [];
  if (a.tokens?.length) t.push(...a.tokens);
  if (a.emails?.length) t.push(...await tokensByEmails(a.emails));
  return dedupe(t);
}

async function sendToTopic(topic: string, notif: AdminNotification, opts?: { dryRun?: boolean }): Promise<AdminBroadcastResult> {
  if (opts?.dryRun) {
    return { requested: -1, attempted: -1, success: 0, failure: 0, invalidTokens: [], results: [] };
  }
  const messaging = getMessaging();
  const msg = {
    topic,
    notification: { title: notif.title, body: notif.body, imageUrl: notif.imageUrl },
    data: stringify(notif.data),
    webpush: notif.clickAction ? { fcmOptions: { link: notif.clickAction } } : undefined,
    android: {
      notification: { channelId: notif.androidChannelId, clickAction: notif.clickAction, imageUrl: notif.imageUrl },
      ttl: notif.ttlSeconds ? notif.ttlSeconds * 1000 : undefined,
    },
    apns: {
      payload: { aps: { "mutable-content": 1, sound: "default" } },
      fcmOptions: notif.imageUrl ? { imageUrl: notif.imageUrl } : undefined,
    },
  } as const;

  await messaging.send(msg);
  return { requested: -1, attempted: -1, success: -1, failure: 0, invalidTokens: [], results: [{ success: true }] };
}

async function sendToTokens(tokens: string[], notif: AdminNotification, opts?: { dryRun?: boolean }): Promise<AdminBroadcastResult> {
  const clean = dedupe(tokens);
  const batches = chunk(clean, 500);

  const out: AdminBroadcastResult = { requested: clean.length, attempted: 0, success: 0, failure: 0, invalidTokens: [], results: [] };
  if (opts?.dryRun) return out;

  const messaging = getMessaging();

  for (const batch of batches) {
    if (!batch.length) continue;

    const msg = {
      tokens: batch,
      notification: { title: notif.title, body: notif.body },
      data: stringify(notif.data),
      webpush: notif.clickAction ? { fcmOptions: { link: notif.clickAction } } : undefined,
      android: {
        notification: { channelId: notif.androidChannelId, clickAction: notif.clickAction, imageUrl: notif.imageUrl },
        ttl: notif.ttlSeconds ? notif.ttlSeconds * 1000 : undefined,
      },
      apns: {
        payload: { aps: { "mutable-content": 1, sound: "default" } },
        fcmOptions: notif.imageUrl ? { imageUrl: notif.imageUrl } : undefined,
      },
    } as const;

    const resp = await messaging.sendEachForMulticast(msg);
    out.attempted += batch.length;

    resp.responses.forEach((r, i) => {
      const token = batch[i];
      if (r.success) {
        out.success++;
        out.results.push({ token, success: true, messageId: r.messageId });
      } else {
        out.failure++;
        const code = r.error?.code ?? "";
        const msg = r.error?.message ?? "Unknown error";
        out.results.push({ token, success: false, error: `${code}: ${msg}` });
        if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
          out.invalidTokens.push(token);
        }
      }
    });
  }

  return out;
}


async function tokensByEmails(emails: string[], userService = new UserService()): Promise<string[]> {
  if (!emails?.length) return [];
  const lower = emails.map(e => String(e).toLowerCase());

  const filtered = ENFORCE_TEST_GUARD
    ? lower.filter(e => TEST_ALLOWED_EMAILS.has(e))
    : lower;

  if (!filtered.length) return [];
  const users = await userService.findSelect({ email: { $in: filtered } }, { fcmToken: 1 });
  return [...new Set(users.map((u: any) => u?.fcmToken).filter(Boolean))];
}