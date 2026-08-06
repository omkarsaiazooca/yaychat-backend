import { IDocumentModel, IModel } from "./base";

export interface ChatUserReport extends IModel, IDocumentModel<ChatUserReport> {
  reporterEmail: string;
  reporterLower: string;
  reportedEmail: string;
  reportedLower: string;
  reason?: string | null;
  messageId?: string | null;
  groupId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
