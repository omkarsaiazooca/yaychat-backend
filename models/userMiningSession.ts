import mongoose, { Schema, Document } from "mongoose";
import { UserMiningSession } from "../data/userMiningSession";

export interface UserMiningSessionDocument
  extends Document,
  UserMiningSession { }
const UserMiningSessionSchema: Schema = new Schema({
  sessionId: { type: String },
  userId: { type: String },
  email: { type: String },
  startedAt: { type: Date },
  endedAt: { type: Date },
  durationInSeconds: { type: Number },
  minedTokens: { type: Number },
  isActive: { type: Boolean },
  deviceInfo: { type: String },
  boosted: { type: Boolean },
  miningRate: { type: Number, default: 0 },
  miningPlan: { type: String, default: "Free" },
});

UserMiningSessionSchema.index({ email: 1, startedAt: -1 });

export default UserMiningSessionSchema;
