import { ProfitLog } from "../data/profitLog";
import profitLogSchema, { ProfitLogModel } from "../models/profitLog";
import { ServiceBase } from "./base";

// ProfitLogService extends the base service to handle ProfitLog operations
export class ProfitLogService extends ServiceBase<ProfitLog, ProfitLogModel> {
    constructor() {
        super(profitLogSchema, "ProfitLog");
    }

    // You can add any specific methods related to ProfitLog operations here
}
