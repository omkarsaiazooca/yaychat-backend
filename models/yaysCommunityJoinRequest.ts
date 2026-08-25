import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityJoinRequest } from "../data/yaysCommunities";

export interface YaysCommunityJoinRequestModel
  extends IDocumentModel<CommunityJoinRequest>,
    CommunityJoinRequest {}

const yaysCommunityJoinRequestSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    userLower: { type: String, required: true },
    userName: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, default: "pending" },
    decidedByLower: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The review queue, oldest first so nobody waits behind a newer request.
yaysCommunityJoinRequestSchema.index({ communityId: 1, status: 1, createdAt: 1 });
// At most one *pending* request per person per community; a rejected request
// may be retried, which is why the constraint is partial rather than flat.
yaysCommunityJoinRequestSchema.index(
  { communityId: 1, userLower: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export default yaysCommunityJoinRequestSchema;
