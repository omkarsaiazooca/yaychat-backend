import { ServiceBase } from "./base";
import adminAuditLogSchema, { AdminAuditLogModel } from "../models/adminAuditLog";
import { AdminAuditLog } from "../data/adminAuditLog";

export class AdminAuditLogService extends ServiceBase<AdminAuditLog, AdminAuditLogModel> {
    constructor() {
        super(adminAuditLogSchema, "AdminAuditLog");
    }

}