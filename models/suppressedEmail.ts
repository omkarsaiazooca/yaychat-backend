import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { SuppressedEmail } from "../data/suppressedEmail";

export interface SuppressedEmailModel
  extends IDocumentModel<SuppressedEmail>,
    SuppressedEmail {}

export const SuppressedEmailSchema: Schema = new Schema();

SuppressedEmailSchema.add({
  email: { type: String, index: true, unique: true },
  status: String,
  reason: String,
  source: String,
  eventId: String,
  createdAt: Date,
  lastEventAt: Date,
});

export default SuppressedEmailSchema;
