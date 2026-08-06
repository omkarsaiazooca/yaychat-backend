import { ServiceBase } from "./base";
import KycAuditLogSchema, { KycAuditLogModel } from "../models/kycAuditLog";
import { KycAuditLog } from "../data/kycAuditLog";

export class KycAuditLogService extends ServiceBase<KycAuditLog, KycAuditLogModel> {
  constructor() {
    super(KycAuditLogSchema, "KycAuditLog");
  }
}

