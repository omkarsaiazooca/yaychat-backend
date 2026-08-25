import {
  Community,
  CommunityMember,
  CommunityRole,
} from "../../data/yaysCommunities";

/**
 * Module 3 — the community permission matrix.
 *
 * Pure and dependency-free so the rules that decide who can delete someone
 * else's post are tested without a database, and so there is exactly one
 * answer to "may this person do this?" for both the API and the client.
 */

/** Higher rank = more capability. A non-member has no rank at all. */
const RANK: Record<CommunityRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

export type Capability =
  | "view_private"
  | "post"
  | "comment"
  | "vote"
  | "create_poll"
  | "create_event"
  | "invite"
  | "publish_announcement"
  | "approve_announcement"
  | "review_join_requests"
  | "moderate_content"
  | "ban_member"
  | "manage_roles"
  | "edit_community"
  | "manage_publishers"
  | "delete_community";

/** Minimum rank each capability needs, before per-capability exceptions. */
const REQUIRED: Record<Capability, number> = {
  view_private: RANK.member,
  post: RANK.member,
  comment: RANK.member,
  vote: RANK.member,
  create_poll: RANK.moderator,
  create_event: RANK.moderator,
  invite: RANK.member,
  publish_announcement: RANK.admin,
  approve_announcement: RANK.admin,
  review_join_requests: RANK.moderator,
  moderate_content: RANK.moderator,
  ban_member: RANK.moderator,
  manage_roles: RANK.admin,
  edit_community: RANK.admin,
  manage_publishers: RANK.admin,
  delete_community: RANK.owner,
};

/** What the caller is, as far as permissions are concerned. */
export interface Viewer {
  userLower: string;
  /** null when the person is not a member (or has left / been removed). */
  role: CommunityRole | null;
  banned: boolean;
  /** Platform admin — the JWT `role` claim, not a community role. */
  platformAdmin: boolean;
  /** Listed in `approvedPublisherLowers`. */
  approvedPublisher: boolean;
}

export const viewerFor = (
  community: Pick<Community, "approvedPublisherLowers">,
  membership: Pick<CommunityMember, "role" | "status"> | null,
  userLower: string,
  platformAdmin = false
): Viewer => {
  const lower = String(userLower || "").trim().toLowerCase();
  const banned = membership?.status === "banned";
  return {
    userLower: lower,
    role: membership && membership.status === "active" ? membership.role : null,
    banned,
    platformAdmin,
    approvedPublisher: (community.approvedPublisherLowers || []).includes(lower),
  };
};

export const rankOf = (role: CommunityRole | null): number =>
  role ? RANK[role] : 0;

/**
 * The single capability check.
 *
 * A banned member can do nothing — not even read a private community — and the
 * ban is checked before the platform-admin escape so a banned admin of one
 * community cannot post through the back door. Platform admins get moderation
 * and read powers everywhere (they work the unified queue from M6), but never
 * membership-shaped powers like `post`: acting *as* a member requires being one.
 */
export const can = (viewer: Viewer, capability: Capability): boolean => {
  if (viewer.banned) {
    return false;
  }
  if (
    capability === "publish_announcement" &&
    viewer.approvedPublisher &&
    rankOf(viewer.role) >= RANK.member
  ) {
    // The publishing-approval workflow: an approved publisher who is not staff
    // may publish. Their posts still carry the community's verified flag, which
    // is why the list is admin-managed.
    return true;
  }
  if (viewer.platformAdmin && PLATFORM_ADMIN_CAPABILITIES.includes(capability)) {
    return true;
  }
  return rankOf(viewer.role) >= REQUIRED[capability];
};

/** What a platform admin may do in a community they are not a member of. */
const PLATFORM_ADMIN_CAPABILITIES: Capability[] = [
  "view_private",
  "moderate_content",
  "ban_member",
  "review_join_requests",
  "approve_announcement",
  "manage_publishers",
];

/**
 * Whether `actor` may change `target`'s role/membership.
 *
 * Staff act strictly downward: an admin cannot demote, ban, or remove another
 * admin, and nobody can touch the owner. Members may always act on themselves
 * (that is how "leave" works).
 */
export const canActOnMember = (
  actor: Viewer,
  targetRole: CommunityRole | null,
  targetUserLower: string
): boolean => {
  if (actor.userLower && actor.userLower === targetUserLower) {
    return true;
  }
  if (targetRole === "owner") {
    return false;
  }
  if (actor.banned) {
    return false;
  }
  if (actor.platformAdmin) {
    return true;
  }
  if (rankOf(actor.role) < RANK.moderator) {
    return false;
  }
  return rankOf(actor.role) > rankOf(targetRole);
};

/** Roles a staff member may assign. Only the owner can mint another admin. */
export const canAssignRole = (
  actor: Viewer,
  nextRole: CommunityRole
): boolean => {
  if (nextRole === "owner") {
    // Ownership transfer is deliberately not an API — it needs a separate,
    // audited flow rather than riding on the role endpoint.
    return false;
  }
  if (actor.platformAdmin) {
    return nextRole !== "admin";
  }
  if (nextRole === "admin") {
    return actor.role === "owner";
  }
  return rankOf(actor.role) >= RANK.admin;
};

/**
 * Whether a non-member may see a community's contents.
 *
 * Public communities are readable by anyone (that is what makes discovery
 * work); private ones show only the "cover" — name, description, member count —
 * until the person is an active member.
 */
export const canReadContent = (
  community: Pick<Community, "privacy">,
  viewer: Viewer
): boolean =>
  !viewer.banned &&
  (community.privacy === "public" ||
    rankOf(viewer.role) >= RANK.member ||
    viewer.platformAdmin);

/** Whether joining is even possible, and why not. */
export const joinability = (
  community: Pick<Community, "privacy" | "inviteOnly" | "archived">,
  viewer: Viewer
): { ok: boolean; mode: "join" | "request"; reason?: string } => {
  if (viewer.banned) {
    return { ok: false, mode: "join", reason: "You are banned from this community." };
  }
  if (community.archived) {
    return { ok: false, mode: "join", reason: "This community is archived." };
  }
  if (community.inviteOnly) {
    return {
      ok: false,
      mode: "join",
      reason: "This community is invite-only. Ask a member for an invite link.",
    };
  }
  return community.privacy === "private"
    ? { ok: true, mode: "request" }
    : { ok: true, mode: "join" };
};
