import { ServiceBase } from "./base";
import yaysCommunityInviteSchema, {
  YaysCommunityInviteModel,
} from "../models/yaysCommunityInvite";
import { CommunityInvite } from "../data/yaysCommunities";
import { generateInviteCode } from "./communities/inviteLinks";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityInviteService extends ServiceBase<
  CommunityInvite,
  YaysCommunityInviteModel
> {
  constructor() {
    super(yaysCommunityInviteSchema, "YaysCommunityInvite");
  }

  async mint(input: {
    communityId: string;
    createdByLower: string;
    maxUses?: number | null;
    expiresAt?: Date | null;
  }): Promise<CommunityInvite> {
    // Retry on the (vanishingly unlikely) code collision rather than trusting
    // randomness — the unique index is the real guarantee.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateInviteCode();
      try {
        return await this.create({
          code,
          communityId: input.communityId,
          createdByLower: lower(input.createdByLower),
          maxUses: input.maxUses ?? null,
          uses: 0,
          expiresAt: input.expiresAt ?? null,
          revokedAt: null,
        } as CommunityInvite);
      } catch (error: any) {
        if (error?.code !== 11000) {
          throw error;
        }
      }
    }
    throw new Error("Could not mint an invite code.");
  }

  async byCode(code: string): Promise<CommunityInvite | null> {
    const normalized = lower(code);
    return normalized ? this.findOne({ code: normalized }) : null;
  }

  async listFor(communityId: string): Promise<CommunityInvite[]> {
    return this.findPaginated(50, { createdAt: -1 }, { communityId }, {});
  }

  /**
   * Count one use.
   *
   * The `maxUses` guard is in the *query*, not in code before it, so two people
   * racing on the last slot of a 1-use invite cannot both be admitted.
   */
  async consume(code: string): Promise<boolean> {
    const invite = await this.byCode(code);
    if (!invite) {
      return false;
    }
    const condition: any = { code: lower(code), revokedAt: null };
    if (invite.maxUses !== null && invite.maxUses !== undefined) {
      condition.uses = { $lt: invite.maxUses };
    }
    const updated = await this.findOneUpdate(condition, { $inc: { uses: 1 } }, { new: true });
    return !!updated;
  }

  async revoke(code: string): Promise<void> {
    await this.updatePart({ code: lower(code) }, { $set: { revokedAt: new Date() } });
  }
}
