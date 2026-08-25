/**
 * Module 6 — the analytics event catalogue.
 *
 * Every event the app may send is declared here with the properties it is
 * allowed to carry. Anything not on the list is rejected at ingest and counted
 * as `rejected` so a client sending garbage is visible rather than silent.
 *
 * Two reasons for an allowlist rather than a free-form bag:
 *  - queryability — a warehouse where every release invents new names is not a
 *    warehouse, it is a log file;
 *  - privacy — an open property bag is how message text, emails, and tokens end
 *    up in analytics. Free-text properties are not permitted here at all.
 */

export interface EventSpec {
  /** Properties this event may carry. Everything else is dropped. */
  props: string[];
  description: string;
}

export const EVENT_CATALOG: Record<string, EventSpec> = {
  // --- lifecycle -----------------------------------------------------------
  app_open: { props: ["cold", "source"], description: "App brought to the foreground" },
  session_start: { props: [], description: "New analytics session" },
  screen_view: { props: ["name"], description: "A screen became visible" },

  // --- identity ------------------------------------------------------------
  signup_started: { props: ["method"], description: "Sign-up flow entered" },
  signup_completed: { props: ["method"], description: "Account created" },
  signin_completed: { props: ["method"], description: "Session established" },
  signout: { props: [], description: "Session ended by the user" },

  // --- chat (the MVP surface) ---------------------------------------------
  chat_opened: { props: ["kind"], description: "A conversation was opened" },
  message_sent: {
    props: ["kind", "hasAttachment", "isReply", "conversationKind"],
    description: "A message left the composer",
  },
  message_send_failed: { props: ["reason"], description: "A send did not reach the server" },
  message_retry: { props: ["attempt"], description: "A queued message was retried" },
  media_uploaded: { props: ["fileType", "sizeBucket"], description: "Attachment upload finished" },
  voice_note_sent: { props: ["durationBucket"], description: "Voice note sent" },

  // --- notifications -------------------------------------------------------
  push_permission_prompted: { props: [], description: "OS permission sheet shown" },
  push_permission_result: { props: ["granted"], description: "User answered the sheet" },
  push_token_registered: { props: ["platform"], description: "Device token stored server-side" },
  push_opened: { props: ["category", "route"], description: "A notification was tapped" },
  notification_settings_changed: {
    props: ["setting", "value"],
    description: "A notification switch was toggled",
  },

  // --- other modules -------------------------------------------------------
  community_opened: { props: ["communityId"], description: "Community detail opened" },
  ai_prompt_sent: { props: ["tool"], description: "A prompt was sent to the assistant" },
  deep_link_opened: { props: ["route"], description: "App entered via a link" },
  error_shown: { props: ["code", "surface"], description: "An error state was rendered" },
};

export const isKnownEvent = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(EVENT_CATALOG, name);

/** Value types that survive to storage — objects and arrays never do. */
const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/**
 * Keep only declared properties with scalar values, truncating strings. The
 * cap exists so a mis-wired call site cannot smuggle a message body through a
 * declared property.
 */
export const sanitizeProps = (
  name: string,
  props: Record<string, unknown> | undefined
): Record<string, string | number | boolean> => {
  const spec = EVENT_CATALOG[name];
  if (!spec || !props) {
    return {};
  }
  const out: Record<string, string | number | boolean> = {};
  for (const key of spec.props) {
    const value = props[key];
    if (!isScalar(value)) {
      continue;
    }
    out[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  return out;
};

/** `YYYY-MM-DD` in UTC — the partition key for every rollup. */
export const utcDay = (at: Date = new Date()): string =>
  at.toISOString().slice(0, 10);

/** Mongo rejects map keys containing `.` or `$`. */
export const safeCountKey = (name: string): string =>
  name.replace(/[.$]/g, "_");
