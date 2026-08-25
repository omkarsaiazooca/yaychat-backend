import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityEvent } from "../data/yaysCommunities";

export interface YaysCommunityEventModel
  extends IDocumentModel<CommunityEvent>,
    CommunityEvent {}

const yaysCommunityEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    createdByLower: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    location: { type: String, default: "" },
    attendeeLowers: { type: [String], default: [] },
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Upcoming events for one community, soonest first.
yaysCommunityEventSchema.index({ communityId: 1, startsAt: 1 });

export default yaysCommunityEventSchema;
