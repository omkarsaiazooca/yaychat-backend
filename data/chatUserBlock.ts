import { IDocumentModel, IModel } from "./base";

export interface ChatUserBlock extends IModel, IDocumentModel<ChatUserBlock> {
  blockerEmail: string;
  blockerLower: string;
  blockedEmail: string;
  blockedLower: string;
  groupId?: string | null;
  reason?: string | null;
  preventSending?: boolean;
  blockedByAdmin?: boolean;
  blockScope?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
