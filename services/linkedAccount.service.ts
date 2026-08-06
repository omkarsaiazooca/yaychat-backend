import { LinkedAccount } from "../data/linkedAccount";
import LinkedAccountSchema, { LinkedAccountModel } from "../models/LinkedAccount";
import { ServiceBase } from "./base";

const BONUS_PERCENTAGE_BY_COUNT = [10, 9, 8, 7, 6];

export function getLinkedAccountBonusPercentage(activeCount: number): number {
  if (activeCount <= 0) {
    return 0;
  }
  const index = Math.min(activeCount, BONUS_PERCENTAGE_BY_COUNT.length) - 1;
  return BONUS_PERCENTAGE_BY_COUNT[index] ?? 0;
}

export class LinkedAccountService extends ServiceBase<LinkedAccount, LinkedAccountModel> {
  constructor() {
    super(LinkedAccountSchema, "LinkedAccount");
  }

  async findByMainEmail(mainEmail: string) {
    return this.find({ mainEmail: mainEmail.toLowerCase() });
  }

  async countActive(mainEmail: string) {
    return this.findCount({ mainEmail: mainEmail.toLowerCase(), status: "active" });
  }

  async recalculatePercentagesForMain(mainEmail: string) {
    const normalizedMain = mainEmail.toLowerCase();
    const activeCount = await this.countActive(normalizedMain);
    const percentage = getLinkedAccountBonusPercentage(activeCount);

    if (activeCount === 0) {
      return { activeCount, percentage };
    }

    await this.updateMany(
      { mainEmail: normalizedMain, status: "active" },
      { $set: { percentage } }
    );

    return { activeCount, percentage };
  }

  async findActiveOrPending(mainEmail: string, secondaryEmail: string) {
    return this.findOne({
      mainEmail: mainEmail.toLowerCase(),
      secondaryEmail: secondaryEmail.toLowerCase(),
      status: { $in: ["pending", "active"] },
    });
  }

  async findActiveForSecondary(secondaryEmail: string) {
    return this.findOne({
      secondaryEmail: secondaryEmail.toLowerCase(),
      status: "active",
    });
  }

  async findPendingForSecondary(secondaryEmail: string) {
    return this.findOne({
      secondaryEmail: secondaryEmail.toLowerCase(),
      status: "pending",
    });
  }
}
