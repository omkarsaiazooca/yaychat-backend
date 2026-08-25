import { ServiceBase } from "./base";
import yaysCommunityMemberSchema, {
  YaysCommunityMemberModel,
} from "../models/yaysCommunityMember";
import {
  CommunityMember,
  CommunityRole,
  MemberStatus,
} from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityMemberService extends ServiceBase<
  CommunityMember,
  YaysCommunityMemberModel
> {
  constructor() {
    super(yaysCommunityMemberSchema, "YaysCommunityMember");
  }

  /**
   * The membership row for one person, whatever its status.
   *
   * Callers must check `status` themselves: a banned or departed person still
   * has a row, and treating "has a row" as "is a member" is the mistake this
   * comment exists to prevent.
   */
  async membership(
    communityId: string,
    userLower: string
  ): Promise<CommunityMember | null> {
    const email = lower(userLower);
    if (!communityId || !email) {
      return null;
    }
    return this.findOne({ communityId, userLower: email });
  }

  /** Join (or re-join). A banned row is left untouched — the ban stands. */
  async join(
    communityId: string,
    userLower: string,
    role: CommunityRole = "member"
  ): Promise<CommunityMember | null> {
    const email = lower(userLower);
    const existing = await this.membership(communityId, email);
    if (existing?.status === "banned") {
      return existing;
    }
    if (existing) {
      await this.updatePart(
        { communityId, userLower: email },
        {
          $set: {
            status: "active",
            joinedAt: new Date(),
            actionedByLower: null,
            actionedAt: null,
          },
        }
      );
      return this.membership(communityId, email);
    }
    await this.create({
      communityId,
      userLower: email,
      role,
      status: "active",
      joinedAt: new Date(),
    } as CommunityMember);
    return this.membership(communityId, email);
  }

  async setStatus(
    communityId: string,
    userLower: string,
    status: MemberStatus,
    options: { byLower?: string; reason?: string } = {}
  ): Promise<void> {
    await this.updatePart(
      { communityId, userLower: lower(userLower) },
      {
        $set: {
          status,
          actionedByLower: options.byLower ? lower(options.byLower) : null,
          actionedAt: new Date(),
          banReason: status === "banned" ? options.reason || null : null,
        },
      }
    );
  }

  async setRole(
    communityId: string,
    userLower: string,
    role: CommunityRole
  ): Promise<void> {
    await this.updatePart(
      { communityId, userLower: lower(userLower) },
      { $set: { role } }
    );
  }

  async activeCount(communityId: string): Promise<number> {
    return this.findCount({ communityId, status: "active" });
  }

  async listActive(
    communityId: string,
    limit = 200,
    skip = 0
  ): Promise<CommunityMember[]> {
    return this.findPaginatedSkip(
      Math.min(Math.max(limit, 1), 500),
      Math.max(skip, 0),
      // Staff first (owner → member is reverse-alphabetical by luck, so sort on
      // an explicit rank field instead: role is sorted in the caller).
      { joinedAt: 1 },
      { communityId, status: "active" },
      {}
    );
  }

  async listBanned(communityId: string): Promise<CommunityMember[]> {
    return this.find({ communityId, status: "banned" });
  }

  /** Every active membership for one person — powers "My communities". */
  async communitiesOf(userLower: string): Promise<CommunityMember[]> {
    return this.find({ userLower: lower(userLower), status: "active" });
  }

  async staffOf(communityId: string): Promise<CommunityMember[]> {
    return this.find({
      communityId,
      status: "active",
      role: { $in: ["owner", "admin", "moderator"] },
    });
  }

  async removeAll(communityId: string): Promise<void> {
    await this.deleteMany({ communityId });
  }
}
