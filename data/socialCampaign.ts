import { IModel } from "./base";

export type SocialCampaignApp = "bitcoinyay" | "emmm";
export type SocialCampaignStatus = "pending" | "approved" | "rejected";

export interface SocialCampaignSubmission extends IModel {
  email: string;
  bitcoinyayImageKeys: string[];
  emmmImageKeys: string[];
  status: SocialCampaignStatus;
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rewardGranted?: boolean;
  rewardDays?: number;
}
