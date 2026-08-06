import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DaoProposal } from "../data/dao";

export interface DaoModel extends IDocumentModel<DaoProposal>, DaoProposal { }

var commentsSchema: Schema = new Schema({
  user: String, comment: String, date: Date
});

const daoSchema: Schema = new Schema({
  title: String,
  taskId: String,
  proposalId: String,
  description: String,
  status: String,
  tags: [String],
  startDate: Date,
  endDate: Date,
  attachments: [String],
  comments: [{ type: commentsSchema, default: [] }],
  upvotes: Number,
  downvotes: Number,
  upvotedBy: [String],
  downvotedBy: [String],
  isActive: Boolean,
  isCompleted: Boolean,
  isRejected: Boolean,
  isDraft: Boolean,
  isArchived: Boolean,
  isApproved: Boolean,
  isClaimed: Boolean,
  isSubmitted: Boolean,
  isVoting: Boolean,
  isTask: Boolean,
  isProposal: Boolean,
  summary: String,
  createdBy: String,
  category: String,
  votingDeadline: Date,
  roleRequired: String,
  votes: [{ user: String, vote: String, date: Date }],
  deadline: Date
});

export default daoSchema;