import { IDocumentModel, IModel } from "./base";

export interface BtcyChatGroupBonus extends IModel, IDocumentModel<BtcyChatGroupBonus> {
  ownerEmail: string;
  groupId: string;
  groupName?: string;
  rewardType: string;
  plan: string;
  durationDays: number;
  source: string;
  status: "active" | "failed" | "cancelled";
  effectiveFrom: Date;
  expiresAt: Date;
  grantedAt: Date;
  groupCreatedAt?: Date;
  memberCountAtGrant: number;
  metadata?: Record<string, any>;
  failureReason?: string;
  updatedAt?: Date;
}
