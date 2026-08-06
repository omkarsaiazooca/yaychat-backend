import { Schema } from "mongoose";
import { WallstreetInexAirdropRegistration } from "../data/wallstreetInexAirdropRegistration";
import { IDocumentModel } from "../data/base";

export interface WallstreetInexAirdropRegistrationModel
  extends IDocumentModel<WallstreetInexAirdropRegistration>,
    WallstreetInexAirdropRegistration {}

/**
 * Uses `_id = emailLower` so email registrations are inherently unique.
 */
const WallstreetInexAirdropRegistrationSchema: Schema = new Schema(
  {
    _id: { type: String, required: true }, // emailLower
    email: { type: String, required: true },
    emailLower: { type: String, required: true },
    name: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

WallstreetInexAirdropRegistrationSchema.index({ emailLower: 1 });

export default WallstreetInexAirdropRegistrationSchema;

