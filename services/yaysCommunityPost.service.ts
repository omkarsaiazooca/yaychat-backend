import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityPostSchema, {
  YaysCommunityPostModel,
} from "../models/yaysCommunityPost";
import { CommunityPost } from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const MAX_POST_LENGTH = 4000;

export class YaysCommunityPostService extends ServiceBase<
  CommunityPost,
  YaysCommunityPostModel
> {
  constructor() {
    super(yaysCommunityPostSchema, "YaysCommunityPost");
  }

  async publish(input: {
    communityId: string;
    authorLower: string;
    authorName: string;
    body: string;
  }): Promise<CommunityPost> {
    return this.create({
      postId: randomUUID(),
      communityId: input.communityId,
      authorLower: lower(input.authorLower),
      authorName: input.authorName,
      body: String(input.body).trim().slice(0, MAX_POST_LENGTH),
      likes: [],
      removed: false,
    } as CommunityPost);
  }

  async feed(communityId: string, limit = 50, skip = 0): Promise<CommunityPost[]> {
    return this.findPaginatedSkip(
      Math.min(Math.max(limit, 1), 100),
      Math.max(skip, 0),
      { createdAt: -1 },
      { communityId, removed: { $ne: true } },
      {}
    );
  }

  async byPostId(postId: string): Promise<CommunityPost | null> {
    return this.findOne({ postId });
  }

  /** Toggle this reader's like and report the resulting state. */
  async toggleLike(
    postId: string,
    userLower: string
  ): Promise<{ liked: boolean; likes: number } | null> {
    const email = lower(userLower);
    const post = await this.byPostId(postId);
    if (!post) {
      return null;
    }
    const liked = (post.likes || []).includes(email);
    await this.updatePart(
      { postId },
      liked ? { $pull: { likes: email } } : { $addToSet: { likes: email } }
    );
    const updated = await this.byPostId(postId);
    return { liked: !liked, likes: updated?.likes?.length ?? 0 };
  }

  /** Moderation removal. The row is kept so the decision stays auditable. */
  async remove(
    postId: string,
    byLower: string,
    reason?: string
  ): Promise<void> {
    await this.updatePart(
      { postId },
      {
        $set: {
          removed: true,
          removedByLower: lower(byLower),
          removedReason: reason || null,
        },
      }
    );
  }

  async restore(postId: string): Promise<void> {
    await this.updatePart(
      { postId },
      { $set: { removed: false, removedByLower: null, removedReason: null } }
    );
  }
}
