import { Document, Schema } from "mongoose";
import { SocialCampaignSubmission } from "../data/socialCampaign";

export interface SocialCampaignSubmissionDocument extends Document, SocialCampaignSubmission {}

const SocialCampaignSubmissionSchema = new Schema<SocialCampaignSubmissionDocument>({
  email: { type: String, required: true, index: true },
  bitcoinyayImageKeys: { type: [String], required: true, default: [] },
  emmmImageKeys: { type: [String], required: true, default: [] },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true,
  },
  rejectionReason: { type: String },
  submittedAt: { type: Date, default: Date.now, index: true },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  rewardGranted: { type: Boolean, default: false },
  rewardDays: { type: Number },
});

SocialCampaignSubmissionSchema.index({ email: 1, submittedAt: -1 });
SocialCampaignSubmissionSchema.index({ status: 1, submittedAt: -1 });

export default SocialCampaignSubmissionSchema;
