import mongoose, { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AiAnswer } from "../data/aiAnswer";

export interface AiAnswerModel extends IDocumentModel<AiAnswer>, AiAnswer {}

const aiAnswerSchema = new Schema({
  question: { type: String, required: true, index: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  summary: { type: String, required: true },
  bullets: { type: [String], default: [] },
  chips: { type: [{ label: String, tone: String }], default: [] },
  next_action: {
    product: { type: String },
    suggested: {
      amount: { type: Number },
      risk: { type: Number },
      duration: {
        value: { type: Number },
        unit: { type: String }
      }
    }
  },
  request: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date(), index: true }
});

aiAnswerSchema.index({ question: 1, createdAt: -1 });

export default aiAnswerSchema;
