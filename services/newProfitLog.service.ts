import { ProfitLog } from "../data/profitLog";
import profitLogSchema, { ProfitLogModel } from "../models/profitLog";
import { ServiceBase } from "./base";

// ProfitLogService extends the base service to handle ProfitLog operations
export class NewProfitLogService extends ServiceBase<ProfitLog, ProfitLogModel> {
    constructor() {
        super(profitLogSchema, "NewProfitLog");
    }

    // You can add any specific methods related to ProfitLog operations here
}
