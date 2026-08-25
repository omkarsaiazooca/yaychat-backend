import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityAnnouncement } from "../data/yaysCommunities";

export interface YaysCommunityAnnouncementModel
  extends IDocumentModel<CommunityAnnouncement>,
    CommunityAnnouncement {}

const yaysCommunityAnnouncementSchema = new Schema(
  {
    announcementId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    publisherLower: { type: String, required: true },
    publisherName: { type: String, default: "" },
    publisherVerified: { type: Boolean, default: false },
    title: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, default: "published" },
    audience: { type: String, default: "members" },
    region: { type: String, default: null },
    scheduledFor: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    actionLabel: { type: String, default: null },
    actionUrl: { type: String, default: null },
    approvedByLower: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
    readCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// The community's announcement list, newest first.
yaysCommunityAnnouncementSchema.index({ communityId: 1, createdAt: -1 });
// The scheduler sweep: every due row across every community, in one scan.
yaysCommunityAnnouncementSchema.index({ status: 1, scheduledFor: 1 });

export default yaysCommunityAnnouncementSchema;
