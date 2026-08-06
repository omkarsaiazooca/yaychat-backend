import { IDocumentModel, IModel } from "./base";

export interface Notification extends IModel, IDocumentModel<Notification> {
  userId: string;
  notificationId: string;
  email: string;
  type: string;
  title: string;
  body: string;
  dedupeKey?: string | null;
  read: boolean;
  pushed: boolean;
  createdAt: Date;
  pushedLottoAirdropDate?: Date;
  pushedLottoAirdrop?: boolean;
}

export interface NotificationTemplate extends IModel, IDocumentModel<NotificationTemplate> {
    type: string;
    title: string;
    body: string;
    createdAt?: Date;
    imageUrl?: string;
}
