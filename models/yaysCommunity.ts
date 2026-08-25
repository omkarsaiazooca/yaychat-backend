import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Community } from "../data/yaysCommunities";

export interface YaysCommunityModel
  extends IDocumentModel<Community>,
    Community {}

const yaysCommunitySchema = new Schema(
  {
    communityId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameLower: { type: String, required: true },
    slug: { type: String, required: true },
    category: { type: String, default: "Other" },
    description: { type: String, default: "" },
    privacy: { type: String, default: "public" },
    inviteOnly: { type: Boolean, default: false },
    createdByLower: { type: String, required: true },
    memberCount: { type: Number, default: 1 },
    rules: { type: [String], default: [] },
    chatGroupId: { type: String, required: true },
    verified: { type: Boolean, default: false },
    officialProduct: { type: String, default: null },
    approvedPublisherLowers: { type: [String], default: [] },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One community per name — the first line of defence against a lookalike, and
// the reason `nameLower` exists at all. The fuzzy cases are the impersonation
// detector's job.
yaysCommunitySchema.index({ nameLower: 1 }, { unique: true });
yaysCommunitySchema.index({ slug: 1 }, { unique: true });
// Discovery: filter by category, newest first.
yaysCommunitySchema.index({ archived: 1, category: 1, createdAt: -1 });
// Free-text search over name and description.
yaysCommunitySchema.index({ name: "text", description: "text" });

export default yaysCommunitySchema;
