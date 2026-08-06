import { Schema } from "mongoose";
import { TutorialWatch } from "../data/tutorialWatch";
import { IDocumentModel } from "../data/base";

export interface TutorialWatchModel
  extends IDocumentModel<TutorialWatch>,
    TutorialWatch {}

const tutorialWatchSchema = new Schema(
  {
    email: { type: String, required: true },
    emailLower: { type: String, required: true, index: true },
    app: { type: String, required: true, default: "BTCY" },
    watched: { type: Boolean, default: false },
    watchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tutorialWatchSchema.index({ emailLower: 1, app: 1 }, { unique: true });

export default tutorialWatchSchema;
