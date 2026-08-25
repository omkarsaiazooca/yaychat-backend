import {
  AnnouncementAudience,
  AnnouncementStatus,
  CommunityAnnouncement,
  CommunityMember,
} from "../../data/yaysCommunities";

/**
 * Module 3 — announcement scheduling, targeting, and read analytics.
 *
 * Pure: given a draft and who the actor is, decide the status the row should
 * start in; given an announcement and a member, decide whether that member is
 * in its audience. Kept out of the service so both are testable without a
 * database, and so "who gets woken up by this broadcast" has one definition.
 */

export const MAX_TITLE = 120;
export const MAX_BODY = 4000;
export const MAX_ACTION_LABEL = 40;
/** A schedule further out than this is almost always a typo'd year. */
export const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export interface AnnouncementDraft {
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  region?: string;
  scheduledFor?: string | Date | null;
  actionLabel?: string;
  actionUrl?: string;
}

export interface NormalizedDraft {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  region: string | null;
  scheduledFor: Date | null;
  actionLabel: string | null;
  actionUrl: string | null;
}

export class AnnouncementError extends Error {
  constructor(message: string, public code: "validation" = "validation") {
    super(message);
  }
}

/**
 * Validate and normalise a draft.
 *
 * A schedule in the past is not an error — it means "now" — because a client in
 * a slightly-off timezone should not lose the announcement it just wrote.
 */
export const normalizeDraft = (
  draft: AnnouncementDraft,
  now: Date = new Date()
): NormalizedDraft => {
  const title = String(draft.title || "").trim();
  const body = String(draft.body || "").trim();
  if (title.length < 3) {
    throw new AnnouncementError("An announcement needs a title of at least 3 characters.");
  }
  if (body.length < 5) {
    throw new AnnouncementError("An announcement needs a message of at least 5 characters.");
  }
  if (title.length > MAX_TITLE) {
    throw new AnnouncementError(`Titles are limited to ${MAX_TITLE} characters.`);
  }
  if (body.length > MAX_BODY) {
    throw new AnnouncementError(`Announcements are limited to ${MAX_BODY} characters.`);
  }

  const audience: AnnouncementAudience =
    draft.audience === "all" || draft.audience === "region" ? draft.audience : "members";
  const region = audience === "region" ? String(draft.region || "").trim() : "";
  if (audience === "region" && !region) {
    throw new AnnouncementError("Choose a region for a region-targeted announcement.");
  }

  let scheduledFor: Date | null = null;
  if (draft.scheduledFor) {
    const parsed =
      draft.scheduledFor instanceof Date
        ? draft.scheduledFor
        : new Date(String(draft.scheduledFor));
    if (!Number.isFinite(parsed.getTime())) {
      throw new AnnouncementError("The scheduled time is not a valid date.");
    }
    if (parsed.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) {
      throw new AnnouncementError("An announcement cannot be scheduled more than a year ahead.");
    }
    // Past or present means "publish now", represented as no schedule at all.
    scheduledFor = parsed.getTime() > now.getTime() ? parsed : null;
  }

  const actionLabel = String(draft.actionLabel || "").trim();
  const actionUrl = String(draft.actionUrl || "").trim();
  if (actionLabel.length > MAX_ACTION_LABEL) {
    throw new AnnouncementError(
      `Action labels are limited to ${MAX_ACTION_LABEL} characters.`
    );
  }
  if (actionUrl && !actionLabel) {
    throw new AnnouncementError("An action link needs a button label.");
  }
  if (actionLabel && !actionUrl) {
    throw new AnnouncementError("An action button needs a link.");
  }

  return {
    title,
    body,
    audience,
    region: region || null,
    scheduledFor,
    actionLabel: actionLabel || null,
    actionUrl: actionUrl || null,
  };
};

/**
 * Where a new announcement starts.
 *
 * The approval workflow only bites on **official (verified) communities**: an
 * unverified community's announcement is just a post to its own members, while
 * an official one speaks for a product and needs a second pair of eyes unless
 * the publisher is staff.
 */
export const initialStatus = (input: {
  verified: boolean;
  actorIsStaff: boolean;
  scheduledFor: Date | null;
}): AnnouncementStatus => {
  if (input.verified && !input.actorIsStaff) {
    return "pending_approval";
  }
  return input.scheduledFor ? "scheduled" : "published";
};

/** Status after an approver accepts a pending announcement. */
export const statusAfterApproval = (scheduledFor: Date | null): AnnouncementStatus =>
  scheduledFor && scheduledFor.getTime() > Date.now() ? "scheduled" : "published";

/** True when a scheduled announcement is due to go out. */
export const isDue = (
  announcement: Pick<CommunityAnnouncement, "status" | "scheduledFor">,
  now: Date = new Date()
): boolean =>
  announcement.status === "scheduled" &&
  !!announcement.scheduledFor &&
  new Date(announcement.scheduledFor).getTime() <= now.getTime();

/**
 * Whether one member is in an announcement's audience.
 *
 * `all` and `members` differ only once a community has a public surface: both
 * currently fan out to active members, but `region` narrows to the members
 * whose profile region matches. An unknown member region is *excluded* from a
 * region-targeted send — a broadcast about a local promotion must not reach
 * someone the server cannot place.
 */
export const targets = (
  announcement: Pick<CommunityAnnouncement, "audience" | "region">,
  member: Pick<CommunityMember, "status">,
  memberRegion?: string | null
): boolean => {
  if (member.status !== "active") {
    return false;
  }
  if (announcement.audience !== "region") {
    return true;
  }
  const wanted = String(announcement.region || "").trim().toLowerCase();
  const actual = String(memberRegion || "").trim().toLowerCase();
  return !!wanted && !!actual && wanted === actual;
};

/** Announcements a given viewer is allowed to see in the community payload. */
export const visibleTo = (
  announcement: Pick<CommunityAnnouncement, "status">,
  isStaffOrPublisher: boolean
): boolean =>
  announcement.status === "published" ||
  (isStaffOrPublisher &&
    (announcement.status === "scheduled" ||
      announcement.status === "pending_approval" ||
      announcement.status === "rejected"));

/** Read-rate for the analytics row, guarding the divide-by-zero. */
export const readRate = (
  announcement: Pick<CommunityAnnouncement, "readCount" | "deliveredCount">
): number =>
  announcement.deliveredCount > 0
    ? Math.min(1, announcement.readCount / announcement.deliveredCount)
    : 0;
