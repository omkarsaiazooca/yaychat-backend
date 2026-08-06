import { Schema } from "mongoose";
import { Whitelist, WhitelistModel } from "../data/whitelist";
import { IDocumentModel } from "../data/base";

export interface WhitelistModelInterface extends IDocumentModel<Whitelist>, Whitelist {}

export const whitelistSchema: Schema = new Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  addedBy: { 
    type: String,
    default: null
  },
  addedAt: { 
    type: Date, 
    default: Date.now 
  },
  notes: { 
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Create index on email for faster lookups
whitelistSchema.index({ email: 1 });

export default whitelistSchema;


