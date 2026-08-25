import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityInvite } from "../data/yaysCommunities";

export interface YaysCommunityInviteModel
  extends IDocumentModel<CommunityInvite>,
    CommunityInvite {}

const yaysCommunityInviteSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    createdByLower: { type: String, required: true },
    maxUses: { type: Number, default: null },
    uses: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Invite management screen: this community's links, newest first.
yaysCommunityInviteSchema.index({ communityId: 1, createdAt: -1 });

export default yaysCommunityInviteSchema;
