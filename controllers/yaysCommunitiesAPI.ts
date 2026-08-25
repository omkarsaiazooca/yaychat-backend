import { Request, Response } from "express";
import {
  Actor,
  CommunityError,
  communityDirectory,
} from "../services/communityDirectory.service";
import { COMMUNITY_CATEGORIES } from "../services/yaysCommunity.service";
import { UserService } from "../services/user.service";
import { CommunityRole, ReportTargetType } from "../data/yaysCommunities";

const users = new UserService();

const ADMIN_ROLES = ["Admin", "SuperAdmin", "CustomerSupport"];

const REPORT_TARGETS: ReportTargetType[] = [
  "community",
  "post",
  "member",
  "announcement",
  "message",
];

const ASSIGNABLE_ROLES: CommunityRole[] = ["admin", "moderator", "member"];

/**
 * Module 3 — the communities API.
 *
 * Thin by design: it validates shapes, resolves who the caller is, and hands
 * everything else to `communityDirectory`, which owns the rules. Every handler
 * funnels errors through `fail`, so a `CommunityError` becomes the right 4xx
 * and anything else becomes a logged 500 rather than a stack trace on the wire.
 */
const fail = (res: Response, error: any, context: string) => {
  if (error instanceof CommunityError) {
    const status =
      error.code === "unauthorized"
        ? 403
        : error.code === "not_found"
        ? 404
        : error.code === "conflict"
        ? 409
        : 400;
    return res.status(status).json({ message: error.message, code: error.code });
  }
  console.error(`[m3/communities] ${context}`, error);
  return res
    .status(500)
    .json({ message: "Communities are unavailable right now.", code: "server" });
};

const asInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

export class YaysCommunitiesController {
  constructor() {
    // Express drops `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(
      YaysCommunitiesController.prototype
    )) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /**
   * Who is calling.
   *
   * The display name and region come from the account record rather than the
   * request body: a client that could name itself could post an announcement
   * signed "Bitcoin Yay Support".
   */
  private async actor(req: Request): Promise<Actor> {
    const claims = (req as any).user || {};
    const userLower = String(claims.email || "").trim().toLowerCase();
    const profile: any = await users
      .findOneSelect(
        { email: userLower },
        { firstName: 1, lastName: 1, username: 1, country: 1, role: 1 }
      )
      .catch(() => null);
    const name =
      `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
      profile?.username ||
      userLower.split("@")[0];
    return {
      userLower,
      name,
      platformAdmin: ADMIN_ROLES.includes(String(profile?.role || claims.role || "")),
      region: profile?.country || null,
    };
  }

  /** Public: what the client needs before it can render the tab. */
  async getConfig(_req: Request, res: Response) {
    return res.status(200).json({
      data: {
        categories: COMMUNITY_CATEGORIES,
        reportReasons: [
          "Spam",
          "Harassment",
          "Misinformation",
          "Inappropriate content",
          "Impersonation",
          "Other",
        ],
        announcementAudiences: ["all", "members", "region"],
        maxRules: 20,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------

  async discover(req: Request, res: Response) {
    try {
      const actor = await this.actor(req);
      const data = await communityDirectory.discover(actor, {
        category: req.query.category ? String(req.query.category) : undefined,
        query: req.query.q ? String(req.query.q) : undefined,
        limit: asInt(req.query.limit, 50),
        skip: asInt(req.query.skip, 0),
      });
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "discover");
    }
  }

  async mine(req: Request, res: Response) {
    try {
      const data = await communityDirectory.mine(await this.actor(req));
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "mine");
    }
  }

  async detail(req: Request, res: Response) {
    try {
      const data = await communityDirectory.detail(
        await this.actor(req),
        String(req.params.communityId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "detail");
    }
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  async create(req: Request, res: Response) {
    try {
      const actor = await this.actor(req);
      const { community, impersonationFlags } = await communityDirectory.create(
        actor,
        {
          name: String(req.body?.name || ""),
          category: String(req.body?.category || "Other"),
          description: String(req.body?.description || ""),
          privacy: req.body?.privacy === "private" ? "private" : "public",
          inviteOnly: !!req.body?.inviteOnly,
          rules: Array.isArray(req.body?.rules) ? req.body.rules : undefined,
        }
      );
      const data = await communityDirectory.detail(actor, community.communityId);
      return res.status(201).json({ data: { ...data, impersonationFlags } });
    } catch (error) {
      return fail(res, error, "create");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const actor = await this.actor(req);
      const { community, impersonationFlags } = await communityDirectory.update(
        actor,
        String(req.params.communityId),
        {
          name: req.body?.name,
          description: req.body?.description,
          rules: Array.isArray(req.body?.rules) ? req.body.rules : undefined,
          category: req.body?.category,
          privacy: req.body?.privacy,
          inviteOnly: req.body?.inviteOnly,
        }
      );
      const data = await communityDirectory.detail(actor, community.communityId);
      return res.status(200).json({ data: { ...data, impersonationFlags } });
    } catch (error) {
      return fail(res, error, "update");
    }
  }

  async setVerified(req: Request, res: Response) {
    try {
      const actor = await this.actor(req);
      await communityDirectory.setVerified(
        actor,
        String(req.params.communityId),
        req.body?.verified !== false,
        req.body?.officialProduct ? String(req.body.officialProduct) : undefined
      );
      const data = await communityDirectory.detail(
        actor,
        String(req.params.communityId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "setVerified");
    }
  }

  async setPublisher(req: Request, res: Response) {
    try {
      const actor = await this.actor(req);
      await communityDirectory.setPublisher(
        actor,
        String(req.params.communityId),
        String(req.body?.userEmail || ""),
        req.body?.approved !== false
      );
      const data = await communityDirectory.detail(
        actor,
        String(req.params.communityId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "setPublisher");
    }
  }

  // ---------------------------------------------------------------------
  // Membership
  // ---------------------------------------------------------------------

  async join(req: Request, res: Response) {
    try {
      const data = await communityDirectory.join(
        await this.actor(req),
        String(req.params.communityId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "join");
    }
  }

  async leave(req: Request, res: Response) {
    try {
      await communityDirectory.leave(
        await this.actor(req),
        String(req.params.communityId)
      );
      return res.status(200).json({ data: { left: true } });
    } catch (error) {
      return fail(res, error, "leave");
    }
  }

  async listMembers(req: Request, res: Response) {
    try {
      const data = await communityDirectory.members_list(
        await this.actor(req),
        String(req.params.communityId),
        {
          query: req.query.q ? String(req.query.q) : undefined,
          limit: asInt(req.query.limit, 200),
          skip: asInt(req.query.skip, 0),
        }
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "listMembers");
    }
  }

  async setRole(req: Request, res: Response) {
    try {
      const role = String(req.body?.role || "") as CommunityRole;
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res
          .status(400)
          .json({ message: "role must be admin, moderator, or member.", code: "validation" });
      }
      const data = await communityDirectory.setRole(
        await this.actor(req),
        String(req.params.communityId),
        String(req.body?.userEmail || ""),
        role
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "setRole");
    }
  }

  async removeMember(req: Request, res: Response) {
    try {
      const data = await communityDirectory.removeMember(
        await this.actor(req),
        String(req.params.communityId),
        String(req.body?.userEmail || ""),
        { ban: !!req.body?.ban, reason: req.body?.reason ? String(req.body.reason) : undefined }
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "removeMember");
    }
  }

  async unban(req: Request, res: Response) {
    try {
      const data = await communityDirectory.unban(
        await this.actor(req),
        String(req.params.communityId),
        String(req.body?.userEmail || "")
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "unban");
    }
  }

  async decideJoinRequest(req: Request, res: Response) {
    try {
      const data = await communityDirectory.decideJoinRequest(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.requestId),
        req.body?.approve !== false
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "decideJoinRequest");
    }
  }

  // ---------------------------------------------------------------------
  // Invites
  // ---------------------------------------------------------------------

  async mintInvite(req: Request, res: Response) {
    try {
      const data = await communityDirectory.mintInvite(
        await this.actor(req),
        String(req.params.communityId),
        {
          maxUses: req.body?.maxUses === undefined ? null : asInt(req.body.maxUses, 0) || null,
          expiresInHours:
            req.body?.expiresInHours === undefined
              ? null
              : asInt(req.body.expiresInHours, 0) || null,
        }
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "mintInvite");
    }
  }

  async listInvites(req: Request, res: Response) {
    try {
      const data = await communityDirectory.listInvites(
        await this.actor(req),
        String(req.params.communityId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "listInvites");
    }
  }

  async revokeInvite(req: Request, res: Response) {
    try {
      await communityDirectory.revokeInvite(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.code)
      );
      return res.status(200).json({ data: { revoked: true } });
    } catch (error) {
      return fail(res, error, "revokeInvite");
    }
  }

  async previewInvite(req: Request, res: Response) {
    try {
      const data = await communityDirectory.previewInvite(
        await this.actor(req),
        String(req.query.code || req.body?.code || "")
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "previewInvite");
    }
  }

  async acceptInvite(req: Request, res: Response) {
    try {
      const data = await communityDirectory.acceptInvite(
        await this.actor(req),
        String(req.body?.code || "")
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "acceptInvite");
    }
  }

  // ---------------------------------------------------------------------
  // Feed, polls, events
  // ---------------------------------------------------------------------

  async post(req: Request, res: Response) {
    try {
      const data = await communityDirectory.post(
        await this.actor(req),
        String(req.params.communityId),
        String(req.body?.body || "")
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "post");
    }
  }

  async likePost(req: Request, res: Response) {
    try {
      const data = await communityDirectory.likePost(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.postId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "likePost");
    }
  }

  async removePost(req: Request, res: Response) {
    try {
      const data = await communityDirectory.removePost(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.postId),
        req.body?.reason ? String(req.body.reason) : undefined
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "removePost");
    }
  }

  async createPoll(req: Request, res: Response) {
    try {
      const data = await communityDirectory.createPoll(
        await this.actor(req),
        String(req.params.communityId),
        {
          question: String(req.body?.question || ""),
          options: Array.isArray(req.body?.options) ? req.body.options : [],
          closesInHours: req.body?.closesInHours
            ? asInt(req.body.closesInHours, 48)
            : undefined,
        }
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "createPoll");
    }
  }

  async vote(req: Request, res: Response) {
    try {
      const data = await communityDirectory.vote(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.pollId),
        asInt(req.body?.optionIndex, -1)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "vote");
    }
  }

  async createEvent(req: Request, res: Response) {
    try {
      const data = await communityDirectory.createEvent(
        await this.actor(req),
        String(req.params.communityId),
        {
          title: String(req.body?.title || ""),
          description: req.body?.description ? String(req.body.description) : undefined,
          startsAt: String(req.body?.startsAt || ""),
          location: req.body?.location ? String(req.body.location) : undefined,
        }
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "createEvent");
    }
  }

  async rsvp(req: Request, res: Response) {
    try {
      const data = await communityDirectory.rsvp(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.eventId),
        req.body?.attending !== false
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "rsvp");
    }
  }

  // ---------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------

  async publishAnnouncement(req: Request, res: Response) {
    try {
      const data = await communityDirectory.publishAnnouncement(
        await this.actor(req),
        String(req.params.communityId),
        {
          title: String(req.body?.title || ""),
          body: String(req.body?.body || ""),
          audience: req.body?.audience,
          region: req.body?.region ? String(req.body.region) : undefined,
          scheduledFor: req.body?.scheduledFor ? String(req.body.scheduledFor) : null,
          actionLabel: req.body?.actionLabel ? String(req.body.actionLabel) : undefined,
          actionUrl: req.body?.actionUrl ? String(req.body.actionUrl) : undefined,
        }
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "publishAnnouncement");
    }
  }

  async approveAnnouncement(req: Request, res: Response) {
    try {
      const data = await communityDirectory.approveAnnouncement(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.announcementId),
        req.body?.approve !== false,
        req.body?.reason ? String(req.body.reason) : undefined
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "approveAnnouncement");
    }
  }

  async readAnnouncement(req: Request, res: Response) {
    try {
      const data = await communityDirectory.readAnnouncement(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.announcementId),
        !!req.body?.actioned
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "readAnnouncement");
    }
  }

  async announcementStats(req: Request, res: Response) {
    try {
      const data = await communityDirectory.announcementStats(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.announcementId)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "announcementStats");
    }
  }

  /** Publish anything whose schedule has come due. Safe to call repeatedly. */
  async sweepScheduled(_req: Request, res: Response) {
    try {
      const published = await communityDirectory.publishDue();
      return res.status(200).json({ data: { published } });
    } catch (error) {
      return fail(res, error, "sweepScheduled");
    }
  }

  // ---------------------------------------------------------------------
  // Reporting and moderation
  // ---------------------------------------------------------------------

  async report(req: Request, res: Response) {
    try {
      const targetType = String(req.body?.targetType || "community") as ReportTargetType;
      if (!REPORT_TARGETS.includes(targetType)) {
        return res
          .status(400)
          .json({ message: "Unknown report target.", code: "validation" });
      }
      const data = await communityDirectory.report(
        await this.actor(req),
        String(req.params.communityId),
        {
          reason: String(req.body?.reason || "Reported"),
          targetType,
          targetId: req.body?.targetId ? String(req.body.targetId) : undefined,
          excerpt: req.body?.excerpt ? String(req.body.excerpt) : undefined,
        }
      );
      return res.status(201).json({ data });
    } catch (error) {
      return fail(res, error, "report");
    }
  }

  async resolveReport(req: Request, res: Response) {
    try {
      const resolution = String(req.body?.resolution || "dismissed");
      if (!["approved", "removed", "dismissed"].includes(resolution)) {
        return res.status(400).json({
          message: "resolution must be approved, removed, or dismissed.",
          code: "validation",
        });
      }
      const data = await communityDirectory.resolveReport(
        await this.actor(req),
        String(req.params.communityId),
        String(req.params.reportId),
        resolution as "approved" | "removed" | "dismissed"
      );
      return res.status(200).json({ data });
    } catch (error) {
      return fail(res, error, "resolveReport");
    }
  }
}
