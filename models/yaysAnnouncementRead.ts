import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AnnouncementRead } from "../data/yaysCommunities";

export interface YaysAnnouncementReadModel
  extends IDocumentModel<AnnouncementRead>,
    AnnouncementRead {}

const yaysAnnouncementReadSchema = new Schema(
  {
    announcementId: { type: String, required: true },
    communityId: { type: String, required: true },
    userLower: { type: String, required: true },
    actioned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One read per person per announcement. This unique index *is* the read
// analytics guarantee: re-opening an announcement cannot inflate its count.
yaysAnnouncementReadSchema.index(
  { announcementId: 1, userLower: 1 },
  { unique: true }
);
yaysAnnouncementReadSchema.index({ communityId: 1, createdAt: -1 });

export default yaysAnnouncementReadSchema;
