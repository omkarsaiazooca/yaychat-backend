import { DeepLink, DeepLinkRoute } from "../../data/yaysNotifications";

/**
 * The notification deep-link registry.
 *
 * Routes live in one table on the server so the destination of a push is a
 * data decision, not an app release. The client has the mirror of this table
 * (`mobile/src/yaychat/services/notifications/deepLinks.ts`) and refuses any
 * route it does not know, so an unrecognised push opens the inbox instead of
 * doing nothing.
 */

const SCHEME = "yaychat://";
const WEB_ORIGIN = process.env.YAYS_WEB_ORIGIN || "https://yay.chat";

type RouteSpec = {
  /** Ordered required params; every one must be present and non-empty. */
  params: string[];
  /** Path template using `:param` placeholders. */
  path: string;
};

const ROUTES: Record<DeepLinkRoute, RouteSpec> = {
  "chat.conversation": { params: ["conversationId"], path: "chat/:conversationId" },
  "chat.list": { params: [], path: "chat" },
  "community.list": { params: [], path: "c" },
  "community.detail": { params: ["communityId"], path: "c/:communityId" },
  "community.chat": { params: ["communityId"], path: "c/:communityId/chat" },
  "rewards.home": { params: [], path: "earn" },
  "rewards.referral": { params: [], path: "invite" },
  "notifications.inbox": { params: [], path: "notifications" },
  "support.ticket": { params: ["ticketId"], path: "support/:ticketId" },
  "calls.incoming": { params: ["callId"], path: "call/:callId" },
  "calls.history": { params: [], path: "calls" },
};

export const isDeepLinkRoute = (value: unknown): value is DeepLinkRoute =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ROUTES, value);

/**
 * Build a deep link, or `null` when the route is unknown or a required param
 * is missing. Callers treat `null` as "send a notification with no target"
 * rather than guessing, because a push that opens the wrong screen is worse
 * than one that opens the inbox.
 */
export const buildDeepLink = (
  route: string,
  params: Record<string, string> = {}
): DeepLink | null => {
  if (!isDeepLinkRoute(route)) {
    return null;
  }
  const spec = ROUTES[route];
  const resolved: Record<string, string> = {};
  for (const key of spec.params) {
    const value = String(params[key] ?? "").trim();
    if (!value) {
      return null;
    }
    resolved[key] = value;
  }
  const path = spec.params.reduce(
    (acc, key) => acc.replace(`:${key}`, encodeURIComponent(resolved[key])),
    spec.path
  );
  return { route, params: resolved, url: `${SCHEME}${path}` };
};

/** The https twin of a deep link, for emails and shared links. */
export const webUrlFor = (link: DeepLink): string =>
  `${WEB_ORIGIN}/${link.url.slice(SCHEME.length)}`;

/** Conversation ids are `dm:<email>` / `group:<id>` — the client's own scheme. */
export const conversationDeepLink = (conversationId: string): DeepLink | null =>
  buildDeepLink("chat.conversation", { conversationId });

export const directConversationId = (peerEmail: string): string =>
  `dm:${String(peerEmail || "").trim().toLowerCase()}`;

export const groupConversationId = (groupId: string): string => `group:${groupId}`;

export const knownRoutes = (): DeepLinkRoute[] =>
  Object.keys(ROUTES) as DeepLinkRoute[];
