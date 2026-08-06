// models/dailyAdEvent.ts
import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DailyAdEvent } from "../data/dailyAds";

export interface DailyAdEventModel extends IDocumentModel<DailyAdEvent>, DailyAdEvent {}

const dailyAdEventSchema = new Schema(
  {
    eventId: { type: String, index: true, required: true }, // uuid
    email:   { type: String, index: true, required: true },
    adId:    { type: String, index: true, required: true },
    watchId: { type: String, required: true },              // client-generated unique id per completed view
    secondsWatched: { type: Number, default: 0 },
    watchedAt: { type: Date, default: Date.now },
    date: { type: String, index: true, required: true },    // denormalized "YYYY-MM-DD"
  },
  { versionKey: false, timestamps: true }
);

// Prevent duplicate analytics rows for the same watch submission
dailyAdEventSchema.index({ email: 1, date: 1, watchId: 1 }, { unique: true });

export default dailyAdEventSchema;
