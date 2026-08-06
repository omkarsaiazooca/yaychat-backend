import { ServiceBase } from "./base";
import kybAuditLogSchema, { KybAuditLogModel } from "../models/kybAuditLog";
import { KybAuditLog } from "../data/kybAuditLog";

export class KybAuditLogService extends ServiceBase<KybAuditLog, KybAuditLogModel> {
  constructor() {
    super(kybAuditLogSchema, "KybAuditLog");
  }
}






