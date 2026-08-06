import { LinkedAccountBonusLog } from "../data/linkedAccountBonusLog";
import LinkedAccountBonusLogSchema, {
  LinkedAccountBonusLogModel,
} from "../models/LinkedAccountBonusLog";
import { ServiceBase } from "./base";

export class LinkedAccountBonusLogService extends ServiceBase<
  LinkedAccountBonusLog,
  LinkedAccountBonusLogModel
> {
  constructor() {
    super(LinkedAccountBonusLogSchema, "LinkedAccountBonusLog");
  }

  async findRecentForPair(
    mainEmail: string,
    secondaryEmail: string,
    limit = 10
  ) {
    return this.findPaginated(
      limit,
      { earnedAt: -1 },
      {
        mainEmail: mainEmail.toLowerCase(),
        secondaryEmail: secondaryEmail.toLowerCase(),
      },
      {}
    );
  }

  async sumTotalsByMain(mainEmail: string) {
    const lowercaseMain = mainEmail.toLowerCase();
    const logs = await this.findSelect(
      { mainEmail: lowercaseMain },
      { secondaryEmail: 1, amount: 1 }
    );
    const totals: Record<string, number> = {};
    for (const log of logs) {
      const secondary = String(log?.secondaryEmail || "").toLowerCase();
      if (!secondary) continue;
      const amount = Number(log?.amount || 0);
      if (!totals[secondary]) {
        totals[secondary] = 0;
      }
      totals[secondary] += amount;
    }
    return totals;
  }
}
