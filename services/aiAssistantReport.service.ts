import { ServiceBase } from "./base";
import aiReportSchema, { AiReportModel } from "../models/aiAssistantReport";
import { AiReport } from "../data/aiAssistant";

export class AiAssistantReportService extends ServiceBase<AiReport, AiReportModel> {
  constructor() {
    super(aiReportSchema, "AiAssistantReport");
  }

  /** Moderation queue: open reports, oldest first. */
  async queue(limit = 100): Promise<AiReport[]> {
    return this.findPaginated(limit, { createdAt: 1 }, { status: "open" }, {});
  }
}
