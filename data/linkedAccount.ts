export type LinkedAccountStatus = "pending" | "active" | "removed";

export interface LinkedAccount {
  _id?: any;
  mainEmail: string;
  secondaryEmail: string;
  status: LinkedAccountStatus;
  otpHash?: string;
  otpExpiresAt?: Date;
  linkedAt?: Date;
  removedAt?: Date;
  totalBonusEarned?: number;
  percentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
