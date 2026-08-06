import { IDocumentModel, IModel } from "./base";

export interface AdminNotificationJob extends IModel, IDocumentModel<AdminNotificationJob> {
  jobId: string;
  title: string;
  body: string;
  imageUrl?: string;
  emails: string[];
  sendToAll: boolean;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessages?: string[];
  adminEmail: string;
}

export interface CreateJobData {
  title: string;
  body: string;
  imageUrl?: string;
  emails: string[];
  sendToAll: boolean;
  type: string;
  adminEmail: string;
  totalRecipients: number;
}

export interface JobProgress {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecipients?: number;
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessages?: string[];
}

export interface BatchResult {
  successCount: number;
  failedCount: number;
  errors: string[];
}

export interface AdminNotificationData {
  title: string;
  body: string;
  imageUrl?: string;
  type: string;
}
