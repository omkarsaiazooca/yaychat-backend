import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CommunityPoll } from "../data/yaysCommunities";

export interface YaysCommunityPollModel
  extends IDocumentModel<CommunityPoll>,
    CommunityPoll {}

const pollOptionSchema = new Schema(
  {
    label: { type: String, required: true },
    votes: { type: Number, default: 0 },
  },
  { _id: false }
);

const pollVoterSchema = new Schema(
  {
    userLower: { type: String, required: true },
    optionIndex: { type: Number, required: true },
  },
  { _id: false }
);

const yaysCommunityPollSchema = new Schema(
  {
    pollId: { type: String, required: true, unique: true },
    communityId: { type: String, required: true },
    createdByLower: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [pollOptionSchema], default: [] },
    // Voters are embedded rather than a separate collection: a poll is bounded
    // by its community's membership and is always read whole.
    voters: { type: [pollVoterSchema], default: [] },
    closesAt: { type: Date, required: true },
  },
  { timestamps: true }
);

yaysCommunityPollSchema.index({ communityId: 1, closesAt: -1 });

export default yaysCommunityPollSchema;
