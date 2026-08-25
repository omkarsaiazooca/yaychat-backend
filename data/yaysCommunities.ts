import { IModel } from "./base";

/**
 * Module 3 — Communities & Announcements.
 *
 * The gather-and-broadcast layer. Everything here is YaysApp-owned: the shared
 * Indexx backend has chat groups (M2) but no notion of a community, a role, an
 * announcement, or a moderation decision.
 *
 * Two joins matter and are used consistently:
 *   - `communityId` — a uuid minted at creation, never the Mongo `_id`, so it
 *     can be embedded in invite links and deep links without leaking storage ids.
 *   - `userLower` — the lower-cased account email, the join key the rest of this
 *     backend already uses for a person.
 */

export type CommunityPrivacy = "public" | "private";

/**
 * Roles are ordered: every capability check is "at least this rank".
 * `owner` is the creator and cannot be demoted or removed by anyone else.
 */
export type CommunityRole = "owner" | "admin" | "moderator" | "member";

export type MemberStatus = "active" | "banned" | "left" | "removed";

export interface Community extends IModel {
  communityId: string;
  name: string;
  /** Lower-cased name, unique-indexed — blocks two "BTCY Learners". */
  nameLower: string;
  /** URL-safe handle used in invite links: `yay.chat/c/<slug>`. */
  slug: string;
  category: string;
  description: string;
  privacy: CommunityPrivacy;
  /** Invite-only communities are discoverable but cannot be joined or requested. */
  inviteOnly: boolean;
  createdByLower: string;
  /** Denormalised active-member count; recomputed on every membership write. */
  memberCount: number;
  rules: string[];
  /** M2 chat group backing this community's real-time chat. */
  chatGroupId: string;
  /** Official product account — set by an admin, never by the creator. */
  verified: boolean;
  officialProduct?: string | null;
  /**
   * Non-staff accounts allowed to publish announcements without approval.
   * Staff (owner/admin) always may; moderators may submit for approval.
   */
  approvedPublisherLowers: string[];
  archived: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunityMember extends IModel {
  communityId: string;
  userLower: string;
  role: CommunityRole;
  status: MemberStatus;
  joinedAt: Date;
  /** Who banned/removed them, for the audit trail on an appeal. */
  actionedByLower?: string | null;
  actionedAt?: Date | null;
  banReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface CommunityJoinRequest extends IModel {
  requestId: string;
  communityId: string;
  userLower: string;
  userName: string;
  message?: string;
  status: JoinRequestStatus;
  decidedByLower?: string | null;
  decidedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunityInvite extends IModel {
  /** The opaque code that appears in the link. */
  code: string;
  communityId: string;
  createdByLower: string;
  /** null = unlimited. */
  maxUses?: number | null;
  uses: number;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunityPost extends IModel {
  postId: string;
  communityId: string;
  authorLower: string;
  authorName: string;
  body: string;
  likes: string[];
  removed: boolean;
  removedByLower?: string | null;
  removedReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunityPollOption {
  label: string;
  votes: number;
}

export interface CommunityPoll extends IModel {
  pollId: string;
  communityId: string;
  createdByLower: string;
  question: string;
  options: CommunityPollOption[];
  /** One row per voter — the server, not the client, decides "already voted". */
  voters: { userLower: string; optionIndex: number }[];
  closesAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunityEvent extends IModel {
  eventId: string;
  communityId: string;
  createdByLower: string;
  title: string;
  description?: string;
  startsAt: Date;
  location?: string;
  attendeeLowers: string[];
  cancelled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AnnouncementStatus =
  | "pending_approval"
  | "scheduled"
  | "published"
  | "rejected";

export type AnnouncementAudience = "all" | "members" | "region";

export interface CommunityAnnouncement extends IModel {
  announcementId: string;
  communityId: string;
  publisherLower: string;
  publisherName: string;
  /** Snapshot of the community's verified flag at publish time. */
  publisherVerified: boolean;
  title: string;
  body: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  region?: string | null;
  /** Set while `status === "scheduled"`; the sweep publishes at this instant. */
  scheduledFor?: Date | null;
  publishedAt?: Date | null;
  /** One primary action link, minted through the link service in M4. */
  actionLabel?: string | null;
  actionUrl?: string | null;
  approvedByLower?: string | null;
  approvedAt?: Date | null;
  rejectedReason?: string | null;
  /** Denormalised unique-reader count; the source of truth is the read rows. */
  readCount: number;
  /** How many members the delivery fan-out actually targeted. */
  deliveredCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** One row per (announcement, reader) — makes read analytics idempotent. */
export interface AnnouncementRead extends IModel {
  announcementId: string;
  communityId: string;
  userLower: string;
  /** True when the reader also tapped the primary action. */
  actioned: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ReportTargetType =
  | "community"
  | "post"
  | "member"
  | "announcement"
  | "message";

export type ReportStatus = "open" | "approved" | "removed" | "dismissed";

export interface CommunityReport extends IModel {
  reportId: string;
  communityId: string;
  targetType: ReportTargetType;
  targetId?: string | null;
  reporterLower: string;
  reporterName: string;
  /** Lower-cased email of the person being reported, when there is one. */
  subjectLower?: string | null;
  reason: string;
  excerpt?: string;
  status: ReportStatus;
  assignedToLower?: string | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * A suspected impersonation of an official/verified community, raised at
 * creation and rename time. Advisory: it never blocks the write, it queues a
 * case for a human — a false positive must not stop someone naming their
 * community "BTCY Study Group".
 */
export interface ImpersonationFlag {
  /** The verified community this name collides with. */
  matchedCommunityId: string;
  matchedName: string;
  /** 0–1; how close the two names are after normalisation. */
  score: number;
  reason: "exact" | "normalized" | "confusable" | "official_term";
}
