import { IDocumentModel, IModel } from "./base";

export interface SuppressedEmail extends IModel, IDocumentModel<SuppressedEmail> {
  email: string;
  status: string;
  reason?: string;
  source?: string;
  eventId?: string;
  createdAt: Date;
  lastEventAt?: Date;
}
