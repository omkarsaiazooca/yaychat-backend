import { ServiceBase } from "./base";
import ErrorLogSchema, { ErrorLogModel } from "../models/errorLog";
import { ErrorLog } from "../data/errorLog";
import { ensureMongoConnected } from "../db/connection";

export class ErrorLogService extends ServiceBase<ErrorLog, ErrorLogModel> {
  constructor() {
    super(ErrorLogSchema, "ErrorLog");
  }

  /**
   * Save error log to database (non-blocking)
   * This method is fire-and-forget to not slow down error responses
   * Ensures MongoDB connection before saving
   */
  async saveErrorLog(errorLog: Partial<ErrorLog>): Promise<void> {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        console.error("[ErrorLogService] MongoDB not connected, skipping error log save");
        return;
      }

      await this.create({
        email: errorLog.email || null,
        timestamp: errorLog.timestamp || new Date(),
        apiCalled: errorLog.apiCalled || "Unknown",
        detailedLog: errorLog.detailedLog || "No details",
        statusCode: errorLog.statusCode,
        errorCode: errorLog.errorCode,
        method: errorLog.method,
        url: errorLog.url,
        requestBody: errorLog.requestBody,
        requestQuery: errorLog.requestQuery,
        requestParams: errorLog.requestParams,
        stackTrace: errorLog.stackTrace,
      } as ErrorLog);
    } catch (error) {
      // Silently fail - don't let logging errors break the error handler
      console.error("[ErrorLogService] Failed to save error log:", error);
    }
  }
}

