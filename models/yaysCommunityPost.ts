import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityPost } from "../data/yaysCommunities";

export interface YaysCommunityPostModel
  extends IDocumentModel<CommunityPost>,
    CommunityPost {}

const yaysCommunityPostSchema = new Schema(
  {
    postId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    authorLower: { type: String, required: true },
    authorName: { type: String, default: "" },
    body: { type: String, required: true },
    // Likes are stored as the liker list, not a counter: a counter cannot tell
    // whether *this* reader already liked the post, and double-counts retries.
    likes: { type: [String], default: [] },
    removed: { type: Boolean, default: false },
    removedByLower: { type: String, default: null },
    removedReason: { type: String, default: null },
  },
  { timestamps: true }
);

// The feed: this community, newest first, removed rows filtered in the query.
yaysCommunityPostSchema.index({ communityId: 1, removed: 1, createdAt: -1 });

export default yaysCommunityPostSchema;
