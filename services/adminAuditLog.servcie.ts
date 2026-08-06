import { Request, Response, NextFunction } from "express";
import { AdminAuditLogService } from "./adminAuditLogDB.servcie";
import { AdminAuditLog } from "../data/adminAuditLog";
const adminAuditLogService: AdminAuditLogService = new AdminAuditLogService();

export async function recordAuditLog(
  adminEmail: string,
  action: string,
  method: string,
  data?: any
): Promise<void> {
  try {
    let adminLogData = {
      adminEmail,
      action,
      method,
      data,
    } as AdminAuditLog;
    const logEntry = await adminAuditLogService.create(adminLogData);
    console.log(logEntry);
  } catch (error) {
    console.error("Error saving audit log:", error);
  }
}

export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract user ID from the request, adjust according to your authentication setup
    console.log("req.body", req.body);
    const adminEmail = req.body.adminEmail;

    const action = `${req.method} ${req.originalUrl}`;
    const method = req.method;
    const data = req.body;

    recordAuditLog(adminEmail, action, method, data)
      .then(() => next())
      .catch((error) => {
        console.error("Audit Log Error:", error);
        next();
      });
  } catch (err) {
    console.log("Caught an error in auditLogMiddleware", err);
  }
}
