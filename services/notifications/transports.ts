import { DevicePlatform } from "../../data/yaysNotifications";

/**
 * Push transports.
 *
 * The delivery service talks to this interface only, so the same code path is
 * exercised whether credentials are configured or not. With no credentials the
 * stub records the send and reports success — a fresh checkout runs the whole
 * notification pipeline (preferences, quiet hours, dedupe, inbox, deep links)
 * without a Firebase project, and the only thing missing is the last hop.
 */

export interface PushPayload {
  token: string;
  platform: DevicePlatform;
  title: string;
  body: string;
  /** Merged into the FCM `data` / APNs custom payload — all values are strings. */
  data: Record<string, string>;
  sound: boolean;
  /** Badge count to show on the app icon; omitted when unknown. */
  badge?: number;
}

export interface PushSendResult {
  ok: boolean;
  error?: string;
  /** The token is permanently invalid — the device row should be disabled. */
  tokenGone?: boolean;
}

export interface PushTransport {
  readonly id: string;
  readonly live: boolean;
  send(payload: PushPayload): Promise<PushSendResult>;
}

const INVALID_FCM_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/** Records sends in memory so tests and the admin surface can assert on them. */
export class StubPushTransport implements PushTransport {
  readonly id = "stub";
  readonly live = false;
  readonly sent: PushPayload[] = [];

  async send(payload: PushPayload): Promise<PushSendResult> {
    this.sent.push(payload);
    if (this.sent.length > 200) {
      this.sent.splice(0, this.sent.length - 200);
    }
    return { ok: true };
  }

  reset() {
    this.sent.length = 0;
  }
}

/**
 * Firebase handles both platforms: the iOS app registers its APNs token
 * through the Firebase SDK, so one transport covers ios and android.
 */
export class FirebasePushTransport implements PushTransport {
  readonly id = "firebase";
  readonly live = true;

  async send(payload: PushPayload): Promise<PushSendResult> {
    try {
      // Required lazily: importing the admin SDK initialises an app, which is
      // pointless (and noisy) in the configurations that never reach here.
      const admin = require("../../config/firebase").default;
      await admin.messaging().send({
        token: payload.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: {
          priority: "high",
          notification: { sound: payload.sound ? "default" : undefined },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound ? "default" : undefined,
              badge: payload.badge,
              "content-available": 1,
            },
          },
        },
      });
      return { ok: true };
    } catch (error: any) {
      const code = error?.errorInfo?.code || error?.code;
      return {
        ok: false,
        error: String(code || error?.message || "push_failed"),
        tokenGone: INVALID_FCM_CODES.has(code),
      };
    }
  }
}

const firebaseConfigured = (): boolean =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );

let cached: PushTransport | null = null;

/**
 * Resolve the transport once per process. `YAYS_PUSH_TRANSPORT=stub` forces the
 * stub even where Firebase is configured, which is how staging avoids waking
 * real devices.
 */
export const pushTransport = (): PushTransport => {
  if (cached) {
    return cached;
  }
  const forced = String(process.env.YAYS_PUSH_TRANSPORT || "").toLowerCase();
  if (forced === "stub") {
    cached = new StubPushTransport();
  } else if (forced === "firebase" || firebaseConfigured()) {
    cached = new FirebasePushTransport();
  } else {
    cached = new StubPushTransport();
  }
  return cached;
};

/** Test hook — drops the cached transport and any recorded sends. */
export const resetPushTransport = (transport?: PushTransport) => {
  cached = transport ?? null;
};

export const pushTransportStatus = () => {
  const transport = pushTransport();
  return {
    id: transport.id,
    live: transport.live,
    note: transport.live
      ? "Push notifications are delivered to real devices."
      : "No push credentials configured — notifications reach the in-app inbox only.",
  };
};
