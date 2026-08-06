import { MiningService } from "../services/mining.service";
import {
  LinkedAccountService,
  getLinkedAccountBonusPercentage,
} from "../services/linkedAccount.service";
import { LinkedAccountBonusLogService } from "../services/linkedAccountBonusLog.service";
import { UserService } from "../services/user.service";

type BonusDeps = {
  miningService: MiningService;
  linkedAccountService: LinkedAccountService;
  linkedAccountBonusLogService: LinkedAccountBonusLogService;
  userService: UserService;
};

type BonusContext = BonusDeps & {
  secondaryEmail: string;
  coinSymbol: string;
  secondaryRewards: number;
  source?: string;
  earnedAt?: Date;
};

/**
 * Credits the linked-account bonus (percentage of the secondary user's rewards)
 * to the main account, updates the linked-account record, and logs the payout.
 * Returns true if a bonus was credited, otherwise false.
 */
export async function creditLinkedAccountBonus({
  miningService,
  linkedAccountService,
  linkedAccountBonusLogService,
  userService,
  secondaryEmail,
  coinSymbol,
  secondaryRewards,
  source = "mining_stop",
  earnedAt = new Date(),
}: BonusContext): Promise<boolean> {
  const lowerSecondary = String(secondaryEmail || "").toLowerCase();
  if (!lowerSecondary || secondaryRewards <= 0) {
    return false;
  }

  const linkedRecord = await linkedAccountService.findActiveForSecondary(lowerSecondary);
  if (!linkedRecord?.mainEmail) {
    return false;
  }

  const normalizedMain = String(linkedRecord.mainEmail || "").toLowerCase();
  const normalizedSecondary = String(linkedRecord.secondaryEmail || "").toLowerCase();
  if (!normalizedMain || !normalizedSecondary) {
    return false;
  }

  const [mainAccount, activeLinkedCount] = await Promise.all([
    userService.findOneSelect(
      { email: linkedRecord.mainEmail },
      { email: 1, kycStatus: 1, isKYCPass: 1 }
    ),
    linkedAccountService.countActive(linkedRecord.mainEmail),
  ]);

  const fallbackPercentage = getLinkedAccountBonusPercentage(
    activeLinkedCount > 0 ? activeLinkedCount : 1
  );
  const effectivePercentage =
    typeof linkedRecord.percentage === "number" && linkedRecord.percentage > 0
      ? linkedRecord.percentage
      : fallbackPercentage;
  if (!mainAccount?.email || effectivePercentage <= 0) {
    return false;
  }

  const bonusRate = effectivePercentage / 100;
  const linkedBonus = secondaryRewards * bonusRate;
  if (linkedBonus <= 0) {
    return false;
  }

  const mainKycVerified =
    mainAccount.kycStatus === "Completed" && mainAccount.isKYCPass === true;

  await miningService.updateUserBalanceWhenMiningStopped(
    mainAccount.email,
    coinSymbol,
    linkedBonus,
    mainKycVerified
  );

  const updatePayload: any = {
    $inc: { totalBonusEarned: linkedBonus },
  };
  const shouldUpdatePercentage =
    typeof linkedRecord.percentage !== "number" ||
    linkedRecord.percentage !== effectivePercentage;
  if (shouldUpdatePercentage) {
    updatePayload.$set = { percentage: effectivePercentage };
  }

  await linkedAccountService.updatePart(
    {
      mainEmail: normalizedMain,
      secondaryEmail: normalizedSecondary,
      status: "active",
    },
    updatePayload
  );

  await linkedAccountBonusLogService.create({
    mainEmail: mainAccount.email,
    secondaryEmail: lowerSecondary,
    coinSymbol: String(coinSymbol || "").toUpperCase(),
    amount: linkedBonus,
    source,
    earnedAt,
    metadata: {
      percentageApplied: effectivePercentage,
      activeLinkedCount,
    },
  });

  console.log(
    `Linked account bonus (${effectivePercentage.toFixed(2)}%) of ${linkedBonus} credited to ${mainAccount.email} from ${lowerSecondary}`
  );

  return true;
}
