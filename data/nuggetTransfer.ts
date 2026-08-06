import { IModel } from "./base";

export type NuggetTransferStatus = "completed" | "pending" | "failed";
export type NuggetTransferSource = "mined" | "withdrawn";
export type NuggetTransferClient = "mobile" | "web";

export interface NuggetTransfer extends IModel {
  transactionId: string;
  senderEmail: string;
  recipientEmail: string;
  amount: number;
  asset: "BTCY_NUGGET";
  source: NuggetTransferSource;
  client?: NuggetTransferClient;
  status: NuggetTransferStatus;
  idempotencyKey?: string;
  senderSourceBalanceBefore: number;
  senderSourceBalanceAfter: number;
  senderBalanceBefore: number;
  senderBalanceAfter: number;
  recipientBalanceBefore: number;
  recipientBalanceAfter: number;
  senderTotalMinedBefore: number;
  senderTotalMinedAfter: number;
  recipientTotalMinedBefore: number;
  recipientTotalMinedAfter: number;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
}
