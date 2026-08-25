import { ServiceBase } from "./base";
import yaysCommunitySchema, { YaysCommunityModel } from "../models/yaysCommunity";
import { Community } from "../data/yaysCommunities";
import { slugify } from "./communities/inviteLinks";

/** Categories the client offers at creation time; "All" is a filter, not a category. */
export const COMMUNITY_CATEGORIES = [
  "Crypto & Learning",
  "Design",
  "Markets",
  "Learning",
  "Business",
  "Gaming",
  "Local",
  "Other",
];

export class YaysCommunityService extends ServiceBase<Community, YaysCommunityModel> {
  constructor() {
    super(yaysCommunitySchema, "YaysCommunity");
  }

  async byId(communityId: string): Promise<Community | null> {
    if (!communityId) {
      return null;
    }
    return this.findOne({ communityId });
  }

  async bySlug(slug: string): Promise<Community | null> {
    return this.findOne({ slug: String(slug || "").trim().toLowerCase() });
  }

  async byName(name: string): Promise<Community | null> {
    return this.findOne({ nameLower: String(name || "").trim().toLowerCase() });
  }

  /**
   * A slug nobody else holds. Collisions get a numeric suffix rather than a
   * random one so the link stays readable: `trail-runners-2`.
   */
  async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await this.findOne({ slug: candidate });
      if (!taken) {
        return candidate;
      }
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  /** Discovery. Archived communities are never listed. */
  async discover(options: {
    category?: string;
    query?: string;
    limit?: number;
    skip?: number;
  }): Promise<Community[]> {
    const condition: any = { archived: { $ne: true } };
    if (options.category && options.category !== "All") {
      condition.category = options.category;
    }
    const query = String(options.query || "").trim();
    if (query) {
      // Regex rather than $text: it matches partial words, which is what a
      // search-as-you-type box needs, and the collection is small enough.
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(safe, "i");
      condition.$or = [{ name: pattern }, { description: pattern }, { category: pattern }];
    }
    return this.findPaginatedSkip(
      Math.min(Math.max(options.limit ?? 50, 1), 100),
      Math.max(options.skip ?? 0, 0),
      { memberCount: -1, createdAt: -1 },
      condition,
      {}
    );
  }

  async byIds(communityIds: string[]): Promise<Community[]> {
    if (!communityIds.length) {
      return [];
    }
    return this.find({ communityId: { $in: communityIds } });
  }

  /** Verified communities, for the impersonation detector to compare against. */
  async verifiedNames(): Promise<Community[]> {
    return this.find({ verified: true, archived: { $ne: true } });
  }

  async setMemberCount(communityId: string, count: number): Promise<void> {
    await this.updatePart(
      { communityId },
      { $set: { memberCount: Math.max(0, count) } }
    );
  }
}
