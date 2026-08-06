import { ServiceBase } from "./base";
import { adminNotificationJobSchema, AdminNotificationJobModel } from "../models/adminNotificationJob";
import { AdminNotificationJob, CreateJobData, JobProgress } from "../data/adminNotificationJob";

export class AdminNotificationJobService extends ServiceBase<AdminNotificationJob, AdminNotificationJobModel> {
  constructor() {
    super(adminNotificationJobSchema, "AdminNotificationJob");
  }

  async createJob(data: CreateJobData): Promise<AdminNotificationJob> {
    const jobId = `admin_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return await this.create({
      jobId,
      ...data,
      status: 'pending',
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      createdAt: new Date(),
    } as AdminNotificationJob);
  }

  async updateJobProgress(jobId: string, progress: JobProgress): Promise<AdminNotificationJob> {
    return await this.updatePart({ jobId }, { $set: progress });
  }

  async getJobByJobId(jobId: string): Promise<AdminNotificationJob> {
    return await this.findOne({ jobId });
  }

  async getJobHistory(page: number, limit: number): Promise<{ jobs: AdminNotificationJob[], total: number }> {
    const jobs = await this.findPaginatedSkip(
      limit,
      (page - 1) * limit,
      { createdAt: -1 },
      {},
      {}
    );
    const total = await this.findCount({});
    return { jobs, total };
  }
}
