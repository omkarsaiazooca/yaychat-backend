import { ServiceBase } from "./base";
import bitcoinyayAdAuditLogSchema, {
  BitcoinyayAdAuditLogModel,
} from "../models/bitcoinyayAdAuditLog";
import { BitcoinyayAdAuditLog } from "../data/bitcoinyayAdAuditLog";

export class BitcoinyayAdAuditLogService extends ServiceBase<
  BitcoinyayAdAuditLog,
  BitcoinyayAdAuditLogModel
> {
  constructor() {
    super(bitcoinyayAdAuditLogSchema, "BitcoinyayAdAuditLog");
  }

  async findWithFilters(
    filters: any,
    limit: number,
    skip: number,
    sort: any
  ): Promise<BitcoinyayAdAuditLog[]> {
    return await this.findPaginatedSkip(limit, skip, sort, filters, undefined);
  }

  async countWithFilters(filters: any): Promise<number> {
    return await this.findCount(filters);
  }
}
