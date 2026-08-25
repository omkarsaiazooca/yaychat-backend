import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { CallRecord } from "../data/yaysCalls";

export interface CallRecordModel extends IDocumentModel<CallRecord>, CallRecord {}

const callSchema = new Schema(
  {
    callId: { type: String, required: true, unique: true },
    callerLower: { type: String, required: true, index: true },
    calleeLower: { type: String, required: true, index: true },
    media: { type: String, enum: ["audio", "video"], required: true },
    status: {
      type: String,
      enum: ["ringing", "active", "ended", "declined", "missed", "cancelled", "failed"],
      default: "ringing",
    },
    connectedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    endReason: { type: String, default: null },
    endedByLower: { type: String, default: null },
  },
  { timestamps: true }
);

// The signaling room name has to resolve to one call, and the client generates
// it — so a replayed offer cannot open a second call under the same id.
callSchema.index({ callId: 1 }, { unique: true });
// Call history is "calls involving me, newest first"; one index per side keeps
// both halves of that `$or` covered.
callSchema.index({ callerLower: 1, createdAt: -1 });
callSchema.index({ calleeLower: 1, createdAt: -1 });
// Sweeping abandoned rings.
callSchema.index({ status: 1, createdAt: 1 });

export default callSchema;
