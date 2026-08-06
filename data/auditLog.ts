import { IDocumentModel, IModel } from "./base";

export interface AuditLog extends IModel, IDocumentModel<AuditLog> {
  source: string;
  userId: string; //system id or user id who called a third service
  orderId: string;
  status: number; //response status
  message: object; //response from third party
  created: Date;
}
