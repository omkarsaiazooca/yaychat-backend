import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityAnnouncementSchema, {
  YaysCommunityAnnouncementModel,
} from "../models/yaysCommunityAnnouncement";
import yaysAnnouncementReadSchema, {
  YaysAnnouncementReadModel,
} from "../models/yaysAnnouncementRead";
import {
  AnnouncementRead,
  AnnouncementStatus,
  CommunityAnnouncement,
} from "../data/yaysCommunities";
import { NormalizedDraft } from "./communities/announcements";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityAnnouncementService extends ServiceBase<
  CommunityAnnouncement,
  YaysCommunityAnnouncementModel
> {
  constructor() {
    super(yaysCommunityAnnouncementSchema, "YaysCommunityAnnouncement");
  }

  async draft(input: {
    communityId: string;
    publisherLower: string;
    publisherName: string;
    publisherVerified: boolean;
    status: AnnouncementStatus;
    draft: NormalizedDraft;
  }): Promise<CommunityAnnouncement> {
    return this.create({
      announcementId: randomUUID(),
      communityId: input.communityId,
      publisherLower: lower(input.publisherLower),
      publisherName: input.publisherName,
      publisherVerified: input.publisherVerified,
      title: input.draft.title,
      body: input.draft.body,
      status: input.status,
      audience: input.draft.audience,
      region: input.draft.region,
      scheduledFor: input.draft.scheduledFor,
      publishedAt: input.status === "published" ? new Date() : null,
      actionLabel: input.draft.actionLabel,
      actionUrl: input.draft.actionUrl,
      approvedByLower: null,
      approvedAt: null,
      rejectedReason: null,
      readCount: 0,
      deliveredCount: 0,
    } as CommunityAnnouncement);
  }

  async byAnnouncementId(
    announcementId: string
  ): Promise<CommunityAnnouncement | null> {
    return this.findOne({ announcementId });
  }

  async listFor(
    communityId: string,
    limit = 30
  ): Promise<CommunityAnnouncement[]> {
    return this.findPaginated(limit, { createdAt: -1 }, { communityId }, {});
  }

  /** Every scheduled announcement whose time has come, oldest first. */
  async due(now: Date = new Date(), limit = 200): Promise<CommunityAnnouncement[]> {
    return this.findPaginated(
      limit,
      { scheduledFor: 1 },
      { status: "scheduled", scheduledFor: { $lte: now } },
      {}
    );
  }

  /**
   * Flip one announcement to published, but only from a state that is allowed
   * to publish. The status guard is in the query so two sweeps racing on the
   * same row cannot both fan out notifications for it.
   */
  async markPublished(
    announcementId: string,
    from: AnnouncementStatus[] = ["scheduled"]
  ): Promise<CommunityAnnouncement | null> {
    return this.findOneUpdate(
      { announcementId, status: { $in: from } },
      { $set: { status: "published", publishedAt: new Date() } },
      { new: true }
    );
  }

  async approve(
    announcementId: string,
    approverLower: string,
    status: AnnouncementStatus
  ): Promise<CommunityAnnouncement | null> {
    return this.findOneUpdate(
      { announcementId, status: "pending_approval" },
      {
        $set: {
          status,
          approvedByLower: lower(approverLower),
          approvedAt: new Date(),
          publishedAt: status === "published" ? new Date() : null,
        },
      },
      { new: true }
    );
  }

  async reject(
    announcementId: string,
    approverLower: string,
    reason: string
  ): Promise<CommunityAnnouncement | null> {
    return this.findOneUpdate(
      { announcementId, status: "pending_approval" },
      {
        $set: {
          status: "rejected",
          approvedByLower: lower(approverLower),
          approvedAt: new Date(),
          rejectedReason: reason || "No reason given.",
        },
      },
      { new: true }
    );
  }

  async setDelivered(announcementId: string, count: number): Promise<void> {
    await this.updatePart(
      { announcementId },
      { $set: { deliveredCount: Math.max(0, count) } }
    );
  }

  async incrementReadCount(announcementId: string): Promise<void> {
    await this.updatePart({ announcementId }, { $inc: { readCount: 1 } });
  }

  async removeAllFor(communityId: string): Promise<void> {
    await this.deleteMany({ communityId });
  }
}

/**
 * Read receipts for announcements — the substance behind "read analytics".
 *
 * A separate collection rather than an array on the announcement: the reader
 * list is unbounded, and the unique index on (announcement, reader) is what
 * makes the count idempotent under retries.
 */
export class YaysAnnouncementReadService extends ServiceBase<
  AnnouncementRead,
  YaysAnnouncementReadModel
> {
  constructor() {
    super(yaysAnnouncementReadSchema, "YaysAnnouncementRead");
  }

  /** Returns true when this is the reader's *first* read. */
  async record(input: {
    announcementId: string;
    communityId: string;
    userLower: string;
    actioned?: boolean;
  }): Promise<boolean> {
    const userLower = lower(input.userLower);
    const existing = await this.findOne({
      announcementId: input.announcementId,
      userLower,
    });
    if (existing) {
      if (input.actioned && !existing.actioned) {
        await this.updatePart(
          { announcementId: input.announcementId, userLower },
          { $set: { actioned: true } }
        );
      }
      return false;
    }
    try {
      await this.create({
        announcementId: input.announcementId,
        communityId: input.communityId,
        userLower,
        actioned: !!input.actioned,
      } as AnnouncementRead);
      return true;
    } catch (error: any) {
      // Lost the race with another device of the same user — still not a new read.
      if (error?.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  async countFor(announcementId: string): Promise<number> {
    return this.findCount({ announcementId });
  }

  async actionedCount(announcementId: string): Promise<number> {
    return this.findCount({ announcementId, actioned: true });
  }

  async hasRead(announcementId: string, userLower: string): Promise<boolean> {
    return (
      (await this.findCount({ announcementId, userLower: lower(userLower) })) > 0
    );
  }

  async readIdsFor(
    communityId: string,
    userLower: string
  ): Promise<string[]> {
    const rows = await this.find({ communityId, userLower: lower(userLower) });
    return rows.map((row) => row.announcementId);
  }
}
