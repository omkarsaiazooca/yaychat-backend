import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityMember } from "../data/yaysCommunities";

export interface YaysCommunityMemberModel
  extends IDocumentModel<CommunityMember>,
    CommunityMember {}

const yaysCommunityMemberSchema = new Schema(
  {
    communityId: { type: String, required: true },
    userLower: { type: String, required: true },
    role: { type: String, default: "member" },
    status: { type: String, default: "active" },
    joinedAt: { type: Date, default: Date.now },
    actionedByLower: { type: String, default: null },
    actionedAt: { type: Date, default: null },
    banReason: { type: String, default: null },
  },
  { timestamps: true }
);

// One membership row per person per community. The row survives leaving and
// being banned — a ban that disappeared when someone "left" would be trivially
// escaped by leaving first.
yaysCommunityMemberSchema.index({ communityId: 1, userLower: 1 }, { unique: true });
// Member lists, staff lists, and the announcement fan-out all read this way.
yaysCommunityMemberSchema.index({ communityId: 1, status: 1, role: 1 });
// "My communities".
yaysCommunityMemberSchema.index({ userLower: 1, status: 1 });

export default yaysCommunityMemberSchema;
