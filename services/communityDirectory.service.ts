import { randomUUID } from "crypto";
import {
  AnnouncementStatus,
  Community,
  CommunityAnnouncement,
  CommunityMember,
  CommunityRole,
  ImpersonationFlag,
  ReportTargetType,
} from "../data/yaysCommunities";
import { User } from "../data/user";
import { YaysCommunityService, COMMUNITY_CATEGORIES } from "./yaysCommunity.service";
import { YaysCommunityMemberService } from "./yaysCommunityMember.service";
import { YaysCommunityJoinRequestService } from "./yaysCommunityJoinRequest.service";
import { YaysCommunityInviteService } from "./yaysCommunityInvite.service";
import { YaysCommunityPostService } from "./yaysCommunityPost.service";
import { YaysCommunityPollService } from "./yaysCommunityPoll.service";
import { YaysCommunityEventService } from "./yaysCommunityEvent.service";
import {
  YaysAnnouncementReadService,
  YaysCommunityAnnouncementService,
} from "./yaysCommunityAnnouncement.service";
import { YaysCommunityReportService } from "./yaysCommunityReport.service";
import { ChatGroupService } from "./chatgroups.service";
import { UserService } from "./user.service";
import { notificationDelivery } from "./notificationDelivery.service";
import { buildDeepLink } from "./notifications/deepLinks";
import {
  Capability,
  Viewer,
  can,
  canActOnMember,
  canAssignRole,
  canReadContent,
  joinability,
  rankOf,
  viewerFor,
} from "./communities/permissions";
import {
  AnnouncementDraft,
  AnnouncementError,
  initialStatus,
  normalizeDraft,
  statusAfterApproval,
  targets,
  visibleTo,
} from "./communities/announcements";
import {
  communityUrl,
  inviteAppUrl,
  inviteRejection,
  inviteUrl,
  parseInviteCode,
  rejectionMessage,
} from "./communities/inviteLinks";
import { detectImpersonation, impersonationSummary } from "./communities/impersonation";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

/** Errors the controller turns into 4xx responses instead of 500s. */
export class CommunityError extends Error {
  constructor(
    message: string,
    public code:
      | "validation"
      | "unauthorized"
      | "not_found"
      | "conflict" = "validation"
  ) {
    super(message);
  }
}

export interface Actor {
  userLower: string;
  name: string;
  platformAdmin: boolean;
  /** From `user.country`; used for region-targeted announcements. */
  region?: string | null;
}

/**
 * Module 3 — the communities orchestrator.
 *
 * Every write that touches more than one collection lives here so the
 * invariants hold in one place:
 *
 *   - membership and the M2 chat group's member list never drift apart;
 *   - `memberCount` is recomputed from the membership rows, never incremented
 *     blindly;
 *   - an announcement fan-out and its delivered-count are written together;
 *   - a report reaches both the community's own queue and M6's unified queue.
 *
 * The permission decisions themselves are in `communities/permissions.ts`, and
 * the announcement rules in `communities/announcements.ts`, so they stay
 * testable without a database.
 */
export class CommunityDirectoryService {
  private communities = new YaysCommunityService();
  private members = new YaysCommunityMemberService();
  private requests = new YaysCommunityJoinRequestService();
  private invites = new YaysCommunityInviteService();
  private posts = new YaysCommunityPostService();
  private polls = new YaysCommunityPollService();
  private events = new YaysCommunityEventService();
  private announcements = new YaysCommunityAnnouncementService();
  private reads = new YaysAnnouncementReadService();
  private reports = new YaysCommunityReportService();
  private chatGroups = new ChatGroupService();
  private users = new UserService();

  categories(): string[] {
    return [...COMMUNITY_CATEGORIES];
  }

  // -------------------------------------------------------------------------
  // Lookup helpers
  // -------------------------------------------------------------------------

  async requireCommunity(communityId: string): Promise<Community> {
    const community = await this.communities.byId(communityId);
    if (!community || community.archived) {
      throw new CommunityError("Community not found.", "not_found");
    }
    return community;
  }

  async viewer(community: Community, actor: Actor): Promise<Viewer> {
    const membership = await this.members.membership(
      community.communityId,
      actor.userLower
    );
    return viewerFor(community, membership, actor.userLower, actor.platformAdmin);
  }

  private require(viewer: Viewer, capability: Capability, message: string): void {
    if (!can(viewer, capability)) {
      throw new CommunityError(message, "unauthorized");
    }
  }

  private async displayName(userLower: string): Promise<string> {
    const user = (await this.users
      .findOneSelect({ email: userLower }, { firstName: 1, lastName: 1, username: 1 })
      .catch(() => null)) as Partial<User> | null;
    const full = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    return full || user?.username || userLower.split("@")[0];
  }

  // -------------------------------------------------------------------------
  // Creation and settings
  // -------------------------------------------------------------------------

  async create(
    actor: Actor,
    input: {
      name: string;
      category: string;
      description: string;
      privacy: "public" | "private";
      inviteOnly?: boolean;
      rules?: string[];
    }
  ): Promise<{ community: Community; impersonationFlags: ImpersonationFlag[] }> {
    const name = String(input.name || "").trim();
    if (name.length < 3) {
      throw new CommunityError("Community name must be at least 3 characters.");
    }
    if (name.length > 60) {
      throw new CommunityError("Community name must be 60 characters or fewer.");
    }
    const nameLower = name.toLowerCase();
    if (await this.communities.byName(nameLower)) {
      throw new CommunityError("A community with that name already exists.", "conflict");
    }

    const communityId = randomUUID();
    const slug = await this.communities.uniqueSlug(name);

    // The community's real-time chat is a plain M2 chat group. Reusing it means
    // community chat gets sockets, history, receipts, and push for free, and
    // there is exactly one message store in the product.
    const chatGroup = await this.chatGroups.createCustomGroup(
      actor.userLower,
      name,
      []
    );

    const community = await this.communities.create({
      communityId,
      name,
      nameLower,
      slug,
      category: input.category || "Other",
      description: String(input.description || "").trim().slice(0, 1000),
      privacy: input.privacy === "private" ? "private" : "public",
      inviteOnly: !!input.inviteOnly,
      createdByLower: actor.userLower,
      memberCount: 1,
      rules: (input.rules || []).map((rule) => String(rule).trim()).filter(Boolean),
      chatGroupId: chatGroup.groupId,
      verified: false,
      officialProduct: null,
      // The creator can publish from day one; `owner` already implies it, and
      // listing them keeps the publisher screen honest.
      approvedPublisherLowers: [actor.userLower],
      archived: false,
    } as Community);

    await this.members.join(communityId, actor.userLower, "owner");

    const impersonationFlags = await this.flagImpersonation(actor, community);

    return { community, impersonationFlags };
  }

  /**
   * Compare a name against the verified communities and, on a hit, open a
   * moderation report. Advisory only — the community is already created.
   */
  private async flagImpersonation(
    actor: Actor,
    community: Community
  ): Promise<ImpersonationFlag[]> {
    if (community.verified) {
      return [];
    }
    const verified = await this.communities.verifiedNames().catch(() => []);
    const flags = detectImpersonation(
      community.name,
      verified.map((row) => ({
        communityId: row.communityId,
        name: row.name,
        officialProduct: row.officialProduct,
      })),
      community.communityId
    );
    if (!flags.length) {
      return [];
    }
    await this.reports
      .file({
        communityId: community.communityId,
        targetType: "community",
        targetId: community.communityId,
        reporterLower: "system:impersonation",
        reporterName: "Impersonation detector",
        subjectLower: actor.userLower,
        reason: "Possible impersonation of an official community",
        excerpt: impersonationSummary(community.name, flags[0]),
      })
      .catch(() => null);
    return flags;
  }

  async update(
    actor: Actor,
    communityId: string,
    input: {
      name?: string;
      description?: string;
      rules?: string[];
      category?: string;
      privacy?: "public" | "private";
      inviteOnly?: boolean;
    }
  ): Promise<{ community: Community; impersonationFlags: ImpersonationFlag[] }> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "edit_community", "Only admins can edit this community.");

    const changes: any = {};
    let renamed = false;
    if (typeof input.name === "string" && input.name.trim()) {
      const name = input.name.trim();
      if (name.length < 3 || name.length > 60) {
        throw new CommunityError("Community name must be 3–60 characters.");
      }
      const nameLower = name.toLowerCase();
      if (nameLower !== community.nameLower) {
        const clash = await this.communities.byName(nameLower);
        if (clash) {
          throw new CommunityError(
            "A community with that name already exists.",
            "conflict"
          );
        }
        changes.name = name;
        changes.nameLower = nameLower;
        renamed = true;
      }
    }
    if (typeof input.description === "string") {
      changes.description = input.description.trim().slice(0, 1000);
    }
    if (Array.isArray(input.rules)) {
      changes.rules = input.rules
        .map((rule) => String(rule).trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    if (typeof input.category === "string" && input.category.trim()) {
      changes.category = input.category.trim();
    }
    if (input.privacy === "public" || input.privacy === "private") {
      changes.privacy = input.privacy;
    }
    if (typeof input.inviteOnly === "boolean") {
      changes.inviteOnly = input.inviteOnly;
    }

    if (Object.keys(changes).length) {
      await this.communities.updatePart({ communityId }, { $set: changes });
    }
    if (renamed) {
      // Keep the chat group's title in step, or the conversation list shows the
      // community's old name forever.
      await this.chatGroups
        .updateGroupMetadata(community.chatGroupId, { name: changes.name })
        .catch(() => null);
    }

    const updated = await this.requireCommunity(communityId);
    const impersonationFlags = renamed
      ? await this.flagImpersonation(actor, updated)
      : [];
    return { community: updated, impersonationFlags };
  }

  /** Platform-admin only: mark a community as an official product account. */
  async setVerified(
    actor: Actor,
    communityId: string,
    verified: boolean,
    officialProduct?: string
  ): Promise<Community> {
    if (!actor.platformAdmin) {
      throw new CommunityError(
        "Only YaysApp admins can verify a community.",
        "unauthorized"
      );
    }
    const community = await this.requireCommunity(communityId);
    await this.communities.updatePart(
      { communityId: community.communityId },
      {
        $set: {
          verified,
          officialProduct: verified ? officialProduct || community.name : null,
        },
      }
    );
    return this.requireCommunity(communityId);
  }

  async setPublisher(
    actor: Actor,
    communityId: string,
    targetLower: string,
    approved: boolean
  ): Promise<Community> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "manage_publishers",
      "Only admins can manage approved publishers."
    );
    const email = lower(targetLower);
    const membership = await this.members.membership(communityId, email);
    if (!membership || membership.status !== "active") {
      throw new CommunityError(
        "Only active members can be approved publishers.",
        "validation"
      );
    }
    await this.communities.updatePart(
      { communityId },
      approved
        ? { $addToSet: { approvedPublisherLowers: email } }
        : { $pull: { approvedPublisherLowers: email } }
    );
    return this.requireCommunity(communityId);
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  async discover(
    actor: Actor,
    options: { category?: string; query?: string; limit?: number; skip?: number }
  ): Promise<any[]> {
    const rows = await this.communities.discover(options);
    return this.summaries(rows, actor);
  }

  async mine(actor: Actor): Promise<any[]> {
    const memberships = await this.members.communitiesOf(actor.userLower);
    const communities = await this.communities.byIds(
      memberships.map((row) => row.communityId)
    );
    return this.summaries(
      communities.filter((community) => !community.archived),
      actor
    );
  }

  /**
   * Summaries for a list, with the caller's membership and pending requests
   * fetched in two queries rather than two per row — discovery renders 50 cards
   * and an N+1 here is felt on every tab open.
   */
  private async summaries(rows: Community[], actor: Actor): Promise<any[]> {
    if (!rows.length) {
      return [];
    }
    const ids = rows.map((row) => row.communityId);
    const [memberships, pending] = await Promise.all([
      this.members.find({ communityId: { $in: ids }, userLower: actor.userLower }),
      this.requests.find({
        communityId: { $in: ids },
        userLower: actor.userLower,
        status: "pending",
      }),
    ]);
    const membershipById = new Map(
      memberships.map((row) => [row.communityId, row])
    );
    const pendingIds = new Set(pending.map((row) => row.communityId));
    return rows.map((community) =>
      this.summaryFrom(
        community,
        actor,
        membershipById.get(community.communityId) || null,
        pendingIds.has(community.communityId)
      )
    );
  }

  /** The list-row shape: enough to render a card, nothing heavier. */
  private async summary(community: Community, actor: Actor): Promise<any> {
    const row = await this.members.membership(
      community.communityId,
      actor.userLower
    );
    const pending =
      row?.status === "active"
        ? null
        : await this.requests.pendingFor(community.communityId, actor.userLower);
    return this.summaryFrom(community, actor, row, !!pending);
  }

  private summaryFrom(
    community: Community,
    actor: Actor,
    row: CommunityMember | null,
    joinRequested: boolean
  ): any {
    const viewer = viewerFor(community, row, actor.userLower, actor.platformAdmin);
    return {
      id: community.communityId,
      slug: community.slug,
      name: community.name,
      category: community.category,
      description: community.description,
      memberCount: community.memberCount,
      privacy: community.privacy,
      inviteOnly: community.inviteOnly,
      verified: community.verified,
      officialProduct: community.officialProduct || undefined,
      joined: row?.status === "active",
      banned: row?.status === "banned",
      joinRequested,
      role: this.clientRole(viewer.role),
      chatGroupId: community.chatGroupId,
      inviteLink: communityUrl(community.slug),
    };
  }

  /**
   * The client's role vocabulary is admin/moderator/member — it has no `owner`.
   * Mapping here keeps the app's permission chips correct without teaching the
   * whole client a fourth role.
   */
  private clientRole(role: CommunityRole | null): string | undefined {
    if (!role) {
      return undefined;
    }
    return role === "owner" ? "admin" : role;
  }

  // -------------------------------------------------------------------------
  // The full community payload
  // -------------------------------------------------------------------------

  async detail(actor: Actor, communityId: string): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    const base = await this.summary(community, actor);

    // Publishing a due announcement on read keeps schedules honest even when
    // the background sweep is not running (single-process deploys, tests).
    await this.publishDue(community.communityId).catch(() => null);

    if (!canReadContent(community, viewer)) {
      // Private-community cover: enough to decide whether to ask to join.
      return {
        ...base,
        restricted: true,
        rules: community.rules,
        announcements: [],
        events: [],
        polls: [],
        feed: [],
        joinRequests: [],
        moderationReports: [],
        bannedUserIds: [],
        approvedPublisherIds: [],
      };
    }

    const isStaff = rankOf(viewer.role) >= rankOf("moderator") || viewer.platformAdmin;
    const isPublisher = can(viewer, "publish_announcement");

    const [announcements, events, polls, feed, readIds] = await Promise.all([
      this.announcements.listFor(community.communityId),
      this.events.listFor(community.communityId),
      this.polls.listFor(community.communityId),
      this.posts.feed(community.communityId),
      this.reads.readIdsFor(community.communityId, actor.userLower),
    ]);

    const [joinRequests, moderationReports, banned] = isStaff
      ? await Promise.all([
          this.requests.pending(community.communityId),
          this.reports.queue(community.communityId),
          this.members.listBanned(community.communityId),
        ])
      : [[], [], []];

    const readSet = new Set(readIds);

    return {
      ...base,
      restricted: false,
      rules: community.rules,
      approvedPublisherIds: isStaff ? community.approvedPublisherLowers : [],
      canPublishAnnouncement: isPublisher,
      canModerate: can(viewer, "moderate_content"),
      announcements: announcements
        .filter((row) => visibleTo(row, isStaff || row.publisherLower === viewer.userLower))
        .map((row) => this.announcementPayload(row, readSet.has(row.announcementId))),
      events: events.map((event) => ({
        id: event.eventId,
        title: event.title,
        description: event.description || undefined,
        date: new Date(event.startsAt).toISOString(),
        location: event.location || undefined,
        attending: (event.attendeeLowers || []).length,
        going: (event.attendeeLowers || []).includes(actor.userLower),
      })),
      polls: polls.map((poll) => {
        const mine = (poll.voters || []).find(
          (voter) => voter.userLower === actor.userLower
        );
        return {
          id: poll.pollId,
          question: poll.question,
          options: poll.options,
          votedIndex: mine ? mine.optionIndex : undefined,
          closesAt: new Date(poll.closesAt).toISOString(),
        };
      }),
      feed: feed.map((post) => ({
        id: post.postId,
        authorName: post.authorName,
        authorId: post.authorLower,
        body: post.body,
        postedAt: new Date(post.createdAt || Date.now()).toISOString(),
        likes: (post.likes || []).length,
        liked: (post.likes || []).includes(actor.userLower),
        mine: post.authorLower === actor.userLower,
      })),
      joinRequests: joinRequests.map((request) => ({
        id: request.requestId,
        userName: request.userName,
        userEmail: request.userLower,
        requestedAt: new Date(request.createdAt || Date.now()).toISOString(),
        status: request.status,
      })),
      moderationReports: moderationReports.map((report) => ({
        id: report.reportId,
        targetType: report.targetType,
        targetId: report.targetId || undefined,
        reporterName: report.reporterName,
        reason: report.reason,
        excerpt: report.excerpt || "",
        createdAt: new Date(report.createdAt || Date.now()).toISOString(),
        status: report.status,
        assignedTo: report.assignedToLower || undefined,
      })),
      bannedUserIds: banned.map((row) => row.userLower),
    };
  }

  private announcementPayload(
    row: CommunityAnnouncement,
    readByMe: boolean
  ): any {
    return {
      id: row.announcementId,
      title: row.title,
      body: row.body,
      postedAt: new Date(
        row.publishedAt || row.createdAt || Date.now()
      ).toISOString(),
      status: row.status,
      scheduledFor: row.scheduledFor
        ? new Date(row.scheduledFor).toISOString()
        : undefined,
      audience: row.audience,
      region: row.region || undefined,
      actionLabel: row.actionLabel || undefined,
      actionUrl: row.actionUrl || undefined,
      readCount: row.readCount,
      deliveredCount: row.deliveredCount,
      readByMe,
      publisherName: row.publisherName,
      publisherVerified: row.publisherVerified,
      approvedBy: row.approvedByLower || undefined,
      rejectedReason: row.rejectedReason || undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  /** Recompute the denormalised count from the rows that define it. */
  private async syncMemberCount(communityId: string): Promise<void> {
    const count = await this.members.activeCount(communityId);
    await this.communities.setMemberCount(communityId, count);
  }

  private async addToChat(community: Community, userLower: string): Promise<void> {
    await this.chatGroups
      .addMembers(community.chatGroupId, [userLower])
      .catch(() => null);
  }

  private async removeFromChat(
    community: Community,
    userLower: string
  ): Promise<void> {
    await this.chatGroups
      .removeMembers(community.chatGroupId, [userLower])
      .catch(() => null);
  }

  async join(actor: Actor, communityId: string): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    if (viewer.role) {
      return this.detail(actor, communityId);
    }

    const decision = joinability(community, viewer);
    if (!decision.ok) {
      throw new CommunityError(decision.reason || "You cannot join this community.", "unauthorized");
    }

    if (decision.mode === "request") {
      await this.requests.request({
        communityId,
        userLower: actor.userLower,
        userName: actor.name,
      });
      await this.notifyStaff(community, {
        title: `Join request · ${community.name}`,
        body: `${actor.name} asked to join ${community.name}.`,
        dedupeKey: `join-request:${communityId}:${actor.userLower}`,
      });
      return this.detail(actor, communityId);
    }

    await this.members.join(communityId, actor.userLower, "member");
    await this.addToChat(community, actor.userLower);
    await this.syncMemberCount(communityId);
    return this.detail(actor, communityId);
  }

  async leave(actor: Actor, communityId: string): Promise<void> {
    const community = await this.requireCommunity(communityId);
    const membership = await this.members.membership(communityId, actor.userLower);
    if (!membership || membership.status !== "active") {
      return;
    }
    if (membership.role === "owner") {
      throw new CommunityError(
        "The owner cannot leave. Transfer ownership or archive the community first.",
        "validation"
      );
    }
    await this.members.setStatus(communityId, actor.userLower, "left");
    await this.removeFromChat(community, actor.userLower);
    await this.communities.updatePart(
      { communityId },
      { $pull: { approvedPublisherLowers: actor.userLower } }
    );
    await this.syncMemberCount(communityId);
  }

  async decideJoinRequest(
    actor: Actor,
    communityId: string,
    requestId: string,
    approve: boolean
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "review_join_requests",
      "Only admins and moderators can review join requests."
    );

    const request = await this.requests.byRequestId(requestId);
    if (!request || request.communityId !== communityId) {
      throw new CommunityError("Join request not found.", "not_found");
    }
    if (request.status !== "pending") {
      return this.detail(actor, communityId);
    }

    await this.requests.decide(
      requestId,
      approve ? "approved" : "rejected",
      actor.userLower
    );

    if (approve) {
      await this.members.join(communityId, request.userLower, "member");
      await this.addToChat(community, request.userLower);
      await this.syncMemberCount(communityId);
    }

    const link = buildDeepLink("community.detail", { communityId });
    await notificationDelivery
      .deliver({
        userLower: request.userLower,
        category: "communities",
        title: approve ? `Welcome to ${community.name}` : `Request declined`,
        body: approve
          ? `Your request to join ${community.name} was approved.`
          : `Your request to join ${community.name} was not approved.`,
        deepLink: link ?? undefined,
        dedupeKey: `join-decision:${requestId}`,
      })
      .catch(() => null);

    return this.detail(actor, communityId);
  }

  async members_list(
    actor: Actor,
    communityId: string,
    options: { query?: string; limit?: number; skip?: number } = {}
  ): Promise<any[]> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    if (!canReadContent(community, viewer)) {
      throw new CommunityError(
        "Join this community to see its members.",
        "unauthorized"
      );
    }
    const rows = await this.members.listActive(
      communityId,
      options.limit ?? 200,
      options.skip ?? 0
    );
    const banned = can(viewer, "ban_member")
      ? await this.members.listBanned(communityId)
      : [];
    const all = [...rows, ...banned];
    const emails = all.map((row) => row.userLower);
    const users = emails.length
      ? ((await this.users
          .findSelect(
            { email: { $in: emails } },
            { email: 1, firstName: 1, lastName: 1, username: 1, profilePhoto: 1, country: 1 }
          )
          .catch(() => [])) as Partial<User>[])
      : [];
    const byEmail = new Map(
      users.map((user) => [lower(user.email), user])
    );

    const query = String(options.query || "").trim().toLowerCase();
    const rank: Record<CommunityRole, number> = {
      owner: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };

    return all
      .map((row) => {
        const user = byEmail.get(row.userLower);
        const name =
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          user?.username ||
          row.userLower.split("@")[0];
        return {
          id: row.userLower,
          email: row.userLower,
          name,
          username: user?.username || row.userLower.split("@")[0],
          profilePic: (user as any)?.profilePhoto || undefined,
          role: this.clientRole(row.role),
          /** Kept for ordering; the client only ever renders `role`. */
          rank: rank[row.role],
          status: row.status,
          joinedAt: new Date(row.joinedAt || row.createdAt || Date.now()).toISOString(),
          banReason: row.banReason || undefined,
        };
      })
      .filter((member) =>
        query
          ? member.name.toLowerCase().includes(query) ||
            member.username.toLowerCase().includes(query) ||
            member.email.includes(query)
          : true
      )
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }

  async setRole(
    actor: Actor,
    communityId: string,
    targetLower: string,
    role: CommunityRole
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "manage_roles", "Only admins can change roles.");

    const email = lower(targetLower);
    const target = await this.members.membership(communityId, email);
    if (!target || target.status !== "active") {
      throw new CommunityError("That person is not a member.", "not_found");
    }
    if (!canActOnMember(viewer, target.role, email)) {
      throw new CommunityError(
        "You cannot change that member's role.",
        "unauthorized"
      );
    }
    if (!canAssignRole(viewer, role)) {
      throw new CommunityError("You cannot assign that role.", "unauthorized");
    }
    await this.members.setRole(communityId, email, role);
    return this.detail(actor, communityId);
  }

  async removeMember(
    actor: Actor,
    communityId: string,
    targetLower: string,
    options: { ban?: boolean; reason?: string } = {}
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      options.ban ? "ban_member" : "moderate_content",
      "Only admins and moderators can remove members."
    );

    const email = lower(targetLower);
    const target = await this.members.membership(communityId, email);
    if (!target) {
      throw new CommunityError("That person is not a member.", "not_found");
    }
    if (!canActOnMember(viewer, target.role, email)) {
      throw new CommunityError(
        "You cannot act on that member.",
        "unauthorized"
      );
    }

    await this.members.setStatus(
      communityId,
      email,
      options.ban ? "banned" : "removed",
      { byLower: actor.userLower, reason: options.reason }
    );
    await this.removeFromChat(community, email);
    if (options.ban) {
      // Belt and braces: even if the person is re-added to the chat group by
      // some other path, the group's own block list keeps them silent.
      await this.chatGroups.blockMember(community.chatGroupId, email).catch(() => null);
    }
    await this.communities.updatePart(
      { communityId },
      { $pull: { approvedPublisherLowers: email } }
    );
    await this.syncMemberCount(communityId);
    return this.detail(actor, communityId);
  }

  async unban(actor: Actor, communityId: string, targetLower: string): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "ban_member", "Only admins and moderators can lift a ban.");
    const email = lower(targetLower);
    await this.members.setStatus(communityId, email, "left", {
      byLower: actor.userLower,
    });
    await this.chatGroups.unblockMember(community.chatGroupId, email).catch(() => null);
    return this.detail(actor, communityId);
  }

  // -------------------------------------------------------------------------
  // Invites
  // -------------------------------------------------------------------------

  async mintInvite(
    actor: Actor,
    communityId: string,
    options: { maxUses?: number | null; expiresInHours?: number | null } = {}
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "invite", "Join this community before inviting others.");

    const expiresAt =
      options.expiresInHours && options.expiresInHours > 0
        ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000)
        : null;
    const invite = await this.invites.mint({
      communityId,
      createdByLower: actor.userLower,
      maxUses: options.maxUses ?? null,
      expiresAt,
    });
    return this.invitePayload(community, invite);
  }

  private invitePayload(community: Community, invite: any): any {
    return {
      code: invite.code,
      url: inviteUrl(community.slug, invite.code),
      appUrl: inviteAppUrl(community.slug, invite.code),
      maxUses: invite.maxUses ?? null,
      uses: invite.uses,
      expiresAt: invite.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
      revoked: !!invite.revokedAt,
    };
  }

  async listInvites(actor: Actor, communityId: string): Promise<any[]> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "invite", "Join this community to see its invites.");
    const rows = await this.invites.listFor(communityId);
    return rows.map((invite) => this.invitePayload(community, invite));
  }

  async revokeInvite(actor: Actor, communityId: string, code: string): Promise<void> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    const invite = await this.invites.byCode(code);
    if (!invite || invite.communityId !== community.communityId) {
      throw new CommunityError("Invite not found.", "not_found");
    }
    // Your own link is always yours to kill; anyone else's needs moderator rank.
    if (
      invite.createdByLower !== actor.userLower &&
      !can(viewer, "moderate_content")
    ) {
      throw new CommunityError("You cannot revoke that invite.", "unauthorized");
    }
    await this.invites.revoke(code);
  }

  /** Preview an invite without consuming it — what the landing screen shows. */
  async previewInvite(actor: Actor, rawCode: string): Promise<any> {
    const code = parseInviteCode(rawCode);
    if (!code) {
      throw new CommunityError("That invite link is not valid.", "validation");
    }
    const invite = await this.invites.byCode(code);
    if (!invite) {
      throw new CommunityError("That invite link is not valid.", "not_found");
    }
    const community = await this.requireCommunity(invite.communityId);
    const rejection = inviteRejection(invite);
    return {
      community: await this.summary(community, actor),
      valid: !rejection,
      reason: rejection ? rejectionMessage(rejection) : undefined,
    };
  }

  /**
   * Redeem an invite.
   *
   * An invite bypasses `inviteOnly` and private approval — that is its whole
   * purpose — but never bypasses a ban.
   */
  async acceptInvite(actor: Actor, rawCode: string): Promise<any> {
    const code = parseInviteCode(rawCode);
    if (!code) {
      throw new CommunityError("That invite link is not valid.", "validation");
    }
    const invite = await this.invites.byCode(code);
    if (!invite) {
      throw new CommunityError("That invite link is not valid.", "not_found");
    }
    const community = await this.requireCommunity(invite.communityId);
    const membership = await this.members.membership(
      community.communityId,
      actor.userLower
    );
    if (membership?.status === "banned") {
      throw new CommunityError("You are banned from this community.", "unauthorized");
    }
    if (membership?.status === "active") {
      return this.detail(actor, community.communityId);
    }
    const rejection = inviteRejection(invite);
    if (rejection) {
      throw new CommunityError(rejectionMessage(rejection), "validation");
    }
    if (!(await this.invites.consume(code))) {
      throw new CommunityError(
        rejectionMessage("exhausted"),
        "validation"
      );
    }
    await this.members.join(community.communityId, actor.userLower, "member");
    await this.addToChat(community, actor.userLower);
    await this.syncMemberCount(community.communityId);
    return this.detail(actor, community.communityId);
  }

  // -------------------------------------------------------------------------
  // Feed, polls, events
  // -------------------------------------------------------------------------

  async post(actor: Actor, communityId: string, body: string): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "post", "Join this community to post.");
    if (!String(body || "").trim()) {
      throw new CommunityError("Post cannot be empty.");
    }
    await this.posts.publish({
      communityId,
      authorLower: actor.userLower,
      authorName: actor.name,
      body,
    });
    return this.detail(actor, communityId);
  }

  async likePost(actor: Actor, communityId: string, postId: string): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "comment", "Join this community to react to posts.");
    const result = await this.posts.toggleLike(postId, actor.userLower);
    if (!result) {
      throw new CommunityError("Post not found.", "not_found");
    }
    return result;
  }

  async removePost(
    actor: Actor,
    communityId: string,
    postId: string,
    reason?: string
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    const existing = await this.posts.byPostId(postId);
    if (!existing || existing.communityId !== communityId) {
      throw new CommunityError("Post not found.", "not_found");
    }
    const mine = existing.authorLower === actor.userLower;
    if (!mine && !can(viewer, "moderate_content")) {
      throw new CommunityError("You cannot remove that post.", "unauthorized");
    }
    await this.posts.remove(postId, actor.userLower, reason);
    return this.detail(actor, communityId);
  }

  async createPoll(
    actor: Actor,
    communityId: string,
    input: { question: string; options: string[]; closesInHours?: number }
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "create_poll", "Only admins and moderators can create polls.");
    const options = (input.options || [])
      .map((option) => String(option || "").trim())
      .filter(Boolean);
    if (!String(input.question || "").trim()) {
      throw new CommunityError("A poll needs a question.");
    }
    if (options.length < 2) {
      throw new CommunityError("A poll needs at least two options.");
    }
    const hours = Math.min(Math.max(input.closesInHours ?? 48, 1), 24 * 30);
    await this.polls.open({
      communityId,
      createdByLower: actor.userLower,
      question: input.question,
      options,
      closesAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    });
    return this.detail(actor, communityId);
  }

  async vote(
    actor: Actor,
    communityId: string,
    pollId: string,
    optionIndex: number
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "vote", "Join this community to vote.");
    const result = await this.polls.vote(pollId, actor.userLower, optionIndex);
    if (!result.ok) {
      const message =
        result.reason === "closed"
          ? "This poll has closed."
          : result.reason === "voted"
          ? "You already voted in this poll."
          : result.reason === "option"
          ? "That poll option does not exist."
          : "Poll not found.";
      throw new CommunityError(
        message,
        result.reason === "missing" ? "not_found" : "validation"
      );
    }
    return this.detail(actor, communityId);
  }

  async createEvent(
    actor: Actor,
    communityId: string,
    input: {
      title: string;
      description?: string;
      startsAt: string;
      location?: string;
    }
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "create_event",
      "Only admins and moderators can create events."
    );
    const startsAt = new Date(input.startsAt);
    if (!String(input.title || "").trim()) {
      throw new CommunityError("An event needs a title.");
    }
    if (!Number.isFinite(startsAt.getTime())) {
      throw new CommunityError("That event date is not valid.");
    }
    await this.events.schedule({
      communityId,
      createdByLower: actor.userLower,
      title: input.title,
      description: input.description,
      startsAt,
      location: input.location,
    });
    return this.detail(actor, communityId);
  }

  async rsvp(
    actor: Actor,
    communityId: string,
    eventId: string,
    attending: boolean
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(viewer, "vote", "Join this community to RSVP.");
    const event = await this.events.byEventId(eventId);
    if (!event || event.communityId !== communityId) {
      throw new CommunityError("Event not found.", "not_found");
    }
    await this.events.setAttending(eventId, actor.userLower, attending);
    return this.detail(actor, communityId);
  }

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------

  async publishAnnouncement(
    actor: Actor,
    communityId: string,
    draft: AnnouncementDraft
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "publish_announcement",
      "Only approved publishers can post official announcements."
    );

    let normalized;
    try {
      normalized = normalizeDraft(draft);
    } catch (error) {
      if (error instanceof AnnouncementError) {
        throw new CommunityError(error.message, "validation");
      }
      throw error;
    }

    const actorIsStaff = rankOf(viewer.role) >= rankOf("admin") || viewer.platformAdmin;
    const status = initialStatus({
      verified: community.verified,
      actorIsStaff,
      scheduledFor: normalized.scheduledFor,
    });

    const row = await this.announcements.draft({
      communityId,
      publisherLower: actor.userLower,
      publisherName: actor.name,
      publisherVerified: community.verified,
      status,
      draft: normalized,
    });

    if (status === "published") {
      await this.fanOut(community, row);
    }

    return this.detail(actor, communityId);
  }

  async approveAnnouncement(
    actor: Actor,
    communityId: string,
    announcementId: string,
    approve: boolean,
    reason?: string
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "approve_announcement",
      "Only admins can approve official announcements."
    );
    const existing = await this.announcements.byAnnouncementId(announcementId);
    if (!existing || existing.communityId !== communityId) {
      throw new CommunityError("Announcement not found.", "not_found");
    }
    if (existing.status !== "pending_approval") {
      throw new CommunityError(
        "That announcement is not awaiting approval.",
        "conflict"
      );
    }
    if (existing.publisherLower === actor.userLower && !viewer.platformAdmin) {
      // Self-approval would make the workflow decorative.
      throw new CommunityError(
        "An announcement must be approved by someone other than its publisher.",
        "unauthorized"
      );
    }

    if (!approve) {
      await this.announcements.reject(
        announcementId,
        actor.userLower,
        String(reason || "").slice(0, 200)
      );
      return this.detail(actor, communityId);
    }

    const nextStatus: AnnouncementStatus = statusAfterApproval(
      existing.scheduledFor ? new Date(existing.scheduledFor) : null
    );
    const updated = await this.announcements.approve(
      announcementId,
      actor.userLower,
      nextStatus
    );
    if (updated && nextStatus === "published") {
      await this.fanOut(community, updated);
    }
    return this.detail(actor, communityId);
  }

  /**
   * Deliver a published announcement to its audience and record how many
   * members it reached — the denominator of the read rate.
   */
  private async fanOut(
    community: Community,
    announcement: CommunityAnnouncement
  ): Promise<number> {
    const link = buildDeepLink("community.detail", {
      communityId: community.communityId,
    });
    const pageSize = 500;
    let skip = 0;
    let delivered = 0;

    // Paged rather than capped: a broadcast that silently stopped at the
    // five-hundredth member would report a delivered-count that looks fine and
    // a read rate that is quietly wrong.
    for (;;) {
      const members = await this.members.listActive(
        community.communityId,
        pageSize,
        skip
      );
      if (!members.length) {
        break;
      }
      const regions =
        announcement.audience === "region"
          ? await this.regionsFor(members.map((row) => row.userLower))
          : new Map<string, string | null>();

      for (const member of members) {
        if (!targets(announcement, member, regions.get(member.userLower))) {
          continue;
        }
        delivered += 1;
        if (member.userLower === announcement.publisherLower) {
          // The publisher does not need a push about their own announcement.
          continue;
        }
        await notificationDelivery
          .deliver({
            userLower: member.userLower,
            category: "communities",
            title: `${community.name}${community.verified ? " ✓" : ""}`,
            body: announcement.title,
            deepLink: link ?? undefined,
            // One push per announcement per member, however many sweeps run.
            dedupeKey: `announcement:${announcement.announcementId}`,
            data: {
              type: "community_announcement",
              communityId: community.communityId,
              announcementId: announcement.announcementId,
            },
          })
          .catch(() => null);
      }

      if (members.length < pageSize) {
        break;
      }
      skip += pageSize;
    }

    await this.announcements.setDelivered(announcement.announcementId, delivered);
    return delivered;
  }

  private async regionsFor(
    emails: string[]
  ): Promise<Map<string, string | null>> {
    if (!emails.length) {
      return new Map();
    }
    const users = (await this.users
      .findSelect({ email: { $in: emails } }, { email: 1, country: 1 })
      .catch(() => [])) as Partial<User>[];
    return new Map(
      users.map((user) => [lower(user.email), (user.country as string) || null])
    );
  }

  /**
   * Publish every scheduled announcement whose time has come.
   *
   * Called by the background sweep *and* on every community read, so a
   * deployment without the sweep still publishes on schedule the moment
   * somebody looks. The status guard inside `markPublished` makes the double
   * call harmless.
   */
  async publishDue(communityId?: string, now: Date = new Date()): Promise<number> {
    const due = await this.announcements.due(now);
    let published = 0;
    for (const row of due) {
      if (communityId && row.communityId !== communityId) {
        continue;
      }
      const claimed = await this.announcements.markPublished(row.announcementId);
      if (!claimed) {
        continue;
      }
      const community = await this.communities.byId(row.communityId);
      if (!community) {
        continue;
      }
      await this.fanOut(community, claimed);
      published += 1;
    }
    return published;
  }

  /** Record that this reader opened (and optionally actioned) an announcement. */
  async readAnnouncement(
    actor: Actor,
    communityId: string,
    announcementId: string,
    actioned = false
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    if (!canReadContent(community, viewer)) {
      throw new CommunityError(
        "Join this community to read its announcements.",
        "unauthorized"
      );
    }
    const announcement = await this.announcements.byAnnouncementId(announcementId);
    if (!announcement || announcement.communityId !== communityId) {
      throw new CommunityError("Announcement not found.", "not_found");
    }
    const first = await this.reads.record({
      announcementId,
      communityId,
      userLower: actor.userLower,
      actioned,
    });
    if (first) {
      await this.announcements.incrementReadCount(announcementId);
    }
    return this.detail(actor, communityId);
  }

  /** Read analytics for one announcement — the publisher's view. */
  async announcementStats(
    actor: Actor,
    communityId: string,
    announcementId: string
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    const announcement = await this.announcements.byAnnouncementId(announcementId);
    if (!announcement || announcement.communityId !== communityId) {
      throw new CommunityError("Announcement not found.", "not_found");
    }
    if (
      !can(viewer, "publish_announcement") &&
      announcement.publisherLower !== actor.userLower
    ) {
      throw new CommunityError(
        "Only publishers can see announcement analytics.",
        "unauthorized"
      );
    }
    const [reads, actionedCount] = await Promise.all([
      this.reads.countFor(announcementId),
      this.reads.actionedCount(announcementId),
    ]);
    return {
      announcementId,
      status: announcement.status,
      audience: announcement.audience,
      region: announcement.region || undefined,
      delivered: announcement.deliveredCount,
      reads,
      actioned: actionedCount,
      readRate:
        announcement.deliveredCount > 0
          ? Number(Math.min(1, reads / announcement.deliveredCount).toFixed(3))
          : 0,
      scheduledFor: announcement.scheduledFor
        ? new Date(announcement.scheduledFor).toISOString()
        : undefined,
      publishedAt: announcement.publishedAt
        ? new Date(announcement.publishedAt).toISOString()
        : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Reporting and moderation
  // -------------------------------------------------------------------------

  async report(
    actor: Actor,
    communityId: string,
    input: {
      reason: string;
      targetType?: ReportTargetType;
      targetId?: string;
      excerpt?: string;
    }
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const targetType = input.targetType || "community";
    let subjectLower: string | null = null;
    let excerpt = input.excerpt || "";

    if (targetType === "post" && input.targetId) {
      const post = await this.posts.byPostId(input.targetId);
      if (post && post.communityId === communityId) {
        subjectLower = post.authorLower;
        excerpt = excerpt || post.body.slice(0, 200);
      }
    } else if (targetType === "member" && input.targetId) {
      subjectLower = lower(input.targetId);
    } else if (targetType === "community") {
      excerpt = excerpt || `Reported ${community.name}`;
    }

    await this.reports.file({
      communityId,
      targetType,
      targetId: input.targetId || null,
      reporterLower: actor.userLower,
      reporterName: actor.name,
      subjectLower,
      reason: input.reason || "Reported",
      excerpt,
    });

    await this.notifyStaff(community, {
      title: `New report · ${community.name}`,
      body: `${actor.name} reported ${targetType === "community" ? "the community" : `a ${targetType}`}.`,
      dedupeKey: `report:${communityId}:${actor.userLower}:${targetType}:${input.targetId || "-"}`,
    });

    return this.detail(actor, communityId);
  }

  async resolveReport(
    actor: Actor,
    communityId: string,
    reportId: string,
    resolution: "approved" | "removed" | "dismissed"
  ): Promise<any> {
    const community = await this.requireCommunity(communityId);
    const viewer = await this.viewer(community, actor);
    this.require(
      viewer,
      "moderate_content",
      "Only admins and moderators can resolve reports."
    );
    const report = await this.reports.byReportId(reportId);
    if (!report || report.communityId !== communityId) {
      throw new CommunityError("Report not found.", "not_found");
    }

    // "Removed" is a decision, not a label: carry it through to the content.
    if (resolution === "removed" && report.targetType === "post" && report.targetId) {
      await this.posts.remove(report.targetId, actor.userLower, report.reason);
    }
    if (resolution === "approved" && report.targetType === "post" && report.targetId) {
      await this.posts.restore(report.targetId);
    }

    await this.reports.resolve(reportId, resolution, actor.userLower);
    return this.detail(actor, communityId);
  }

  /** Notify the community's staff, deduped per event. */
  private async notifyStaff(
    community: Community,
    input: { title: string; body: string; dedupeKey: string }
  ): Promise<void> {
    const staff = await this.members.staffOf(community.communityId).catch(() => []);
    const link = buildDeepLink("community.detail", {
      communityId: community.communityId,
    });
    for (const member of staff) {
      await notificationDelivery
        .deliver({
          userLower: member.userLower,
          category: "communities",
          title: input.title,
          body: input.body,
          deepLink: link ?? undefined,
          dedupeKey: `${input.dedupeKey}:${member.userLower}`,
        })
        .catch(() => null);
    }
  }
}

export const communityDirectory = new CommunityDirectoryService();
