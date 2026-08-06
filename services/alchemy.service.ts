import { AlchemySession } from "../data/alchemy";
import { OrderStatus } from "../data/order";
import AlchemySessionSchema, {
  AlchemyConfigData,
  AlchemySessionModel,
} from "../models/alchemy";
import { ServiceBase } from "./base";
import { v1 as uuidv1 } from "uuid";
import { UserService } from "./user.service";
import { TransactionService } from "./transaction.service";
import { OrderService } from "./order.service";
import { MiningService } from "./mining.service";
import { UserMiningBalanceService } from "./userMiningBalance.service";
import { SendEmail } from "../platform/email.operations";
import {
  AlchemyPoolService,
  ALLOWED_POOL_DURATIONS,
} from "./alchemyPool.service";
import {
  addToAirdropWhitelist,
  finalizeAirdropRecipient,
  setAirdropAllocations,
} from "../platform/bitcoinyayAdmin";
import {
  ALCHEMY_COOLDOWN_MINUTES,
  ALCHEMY_DISABLED_MESSAGE,
  ALCHEMY_TOTAL_LIQUIDITY_SEED,
} from "../helpers/alchemyHelper";
import { getBtcyToStablecoinRate } from "./sell.service";
const userService: UserService = new UserService();
const txservice: TransactionService = new TransactionService();
const orderService: OrderService = new OrderService();
const miningService: MiningService = new MiningService();
const userMiningBalanceService = new UserMiningBalanceService();
const sendEmail: SendEmail = new SendEmail();
const alchemyPoolService = new AlchemyPoolService();
const ADMIN_EMAIL = "wallet@azooca.com";
const ALCHEMY_INPUT_COIN_SYMBOL = "BTCY";
const ALCHEMY_INPUT_COIN_NETWORK = "Stellar";
const ALCHEMY_TRANSACTION_SUMMARY_EXCLUDED_EMAILS = new Set<string>(
  [
    "omkar@azooca.com",
    "sunkuomkarsai@gmail",
    "sunkuomkarsai@gmail.com",
    "sunkuomkarsai5@gmail.com",
    "sunkuomkarsai12121@gmail.com",
    "issaumer125@gmail.com",
  ].map((email) => email.toLowerCase())
);
const MINIMUM_V2_MINED_DEFAULT = 50_000;
const MINIMUM_V2_MINED_SPECIAL = 10_000;
const V2_INPUT_AMOUNT = 1000;
const DEFAULT_POOL_USD = Number(process.env.ALCHEMY_POOL_DEFAULT_USD) || 500;
const configuredDuration = Number(
  process.env.ALCHEMY_POOL_DEFAULT_DURATION_DAYS
);
const DEFAULT_POOL_DURATION_DAYS = ALLOWED_POOL_DURATIONS.includes(
  configuredDuration
)
  ? configuredDuration
  : ALLOWED_POOL_DURATIONS[0];
const DEFAULT_POOL_NAME =
  process.env.ALCHEMY_POOL_DEFAULT_NAME ?? "Alchemy v2 Pool";

interface StartAlchemyOptions {
  paymentCoin?: string;
  networkType?: string;
  inputUnit?: string;
  versionTag?: string;
  skipBalanceCheck?: boolean;
}

interface CompleteAlchemyOptions {
  withdrawalType?: string;
  withdrawalAddress?: string;
}

import { AlchemyConfigModel } from "../models/alchemy";
import { AlchemyConfigSchema } from "../models/alchemy";
export class AlchemyConfigService extends ServiceBase<
  AlchemyConfigData,
  AlchemyConfigModel
> {
  constructor() {
    super(AlchemyConfigSchema, "AlchemyConfig");
  }
}

const alchemyConfigService = new AlchemyConfigService();
export class AlchemyService extends ServiceBase<
  AlchemySession,
  AlchemySessionModel
> {
  constructor() {
    super(AlchemySessionSchema, "AlchemySessions");
  }

  async createSession(
    sessionData: AlchemySession
  ): Promise<AlchemySessionModel> {
    return await this.create(sessionData);
  }

  async getAllSessions() {
    return await this.find({});
  }

  async getUserSessions(email: string) {
    return await this.find({ email });
  }

  async getUserSessionById(email: string, sessionId: string) {
    return await this.findOne({
      email: email,
      sessionId: sessionId,
    });
  }

  private toNonNegativeNumber(value: any, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  private getRemainingLiquidity(config: any): number {
    return this.toNonNegativeNumber(
      config?.totalLiquidity ?? config?.liquidityBalance,
      0
    );
  }

  private getInitialTotalLiquidity(config: any, fallback = 0): number {
    return this.toNonNegativeNumber(
      config?.initialTotalLiquidity,
      this.toNonNegativeNumber(fallback, 0)
    );
  }

  private getBaseInputLimit(config: any): number {
    return this.toNonNegativeNumber(
      config?.inputLimit ?? config?.defaultInputLimit,
      0
    );
  }

  private async normalizeLiquidityConfig(config: any) {
    if (!config) {
      return config;
    }

    const hasTotalLiquidity = Number.isFinite(Number(config?.totalLiquidity));
    const hasInitialLiquidity = Number.isFinite(
      Number(config?.initialTotalLiquidity)
    );
    const hasLegacyLiquidity = Number.isFinite(Number(config?.liquidityBalance));
    const shouldSeedMissingLiquidity = !hasTotalLiquidity && !hasInitialLiquidity;
    const normalizedRemainingLiquidity = shouldSeedMissingLiquidity
      ? this.toNonNegativeNumber(
          config?.liquidityBalance,
          ALCHEMY_TOTAL_LIQUIDITY_SEED
        ) || ALCHEMY_TOTAL_LIQUIDITY_SEED
      : this.getRemainingLiquidity(config);
    const normalizedInitialLiquidity = shouldSeedMissingLiquidity
      ? normalizedRemainingLiquidity
      : this.getInitialTotalLiquidity(config, normalizedRemainingLiquidity);

    const shouldPersist =
      !hasTotalLiquidity ||
      !hasInitialLiquidity ||
      !hasLegacyLiquidity ||
      Number(config.totalLiquidity) !== normalizedRemainingLiquidity ||
      Number(config.initialTotalLiquidity) !== normalizedInitialLiquidity ||
      Number(config.liquidityBalance) !== normalizedRemainingLiquidity;

    if (!shouldPersist) {
      return config;
    }

    config.totalLiquidity = normalizedRemainingLiquidity;
    config.initialTotalLiquidity = normalizedInitialLiquidity;
    config.liquidityBalance = normalizedRemainingLiquidity;
    config.updatedAt = new Date();

    await alchemyConfigService.updateOne(String((config as any)._id), config);
    return await alchemyConfigService.findById(String((config as any)._id));
  }

  async getAdminConfig() {
    let config = await alchemyConfigService.findOne({});

    if (!config) {
      config = await alchemyConfigService.create({
        liquidityBalance: ALCHEMY_TOTAL_LIQUIDITY_SEED,
        totalLiquidity: ALCHEMY_TOTAL_LIQUIDITY_SEED,
        initialTotalLiquidity: ALCHEMY_TOTAL_LIQUIDITY_SEED,
      } as any);
    }

    return await this.normalizeLiquidityConfig(config);
  }

  async updateAdminConfig(payload: any) {
    const nextPayload: any = { ...(payload || {}) };
    const hasInputLimitUpdate = nextPayload.inputLimit !== undefined;
    const hasLegacyMaxInputLimitUpdate = nextPayload.maxInputLimit !== undefined;
    const hasDefaultInputLimitUpdate = nextPayload.defaultInputLimit !== undefined;
    const hasTotalLiquidityUpdate = nextPayload.totalLiquidity !== undefined;
    const hasLegacyLiquidityUpdate = nextPayload.liquidityBalance !== undefined;
    const hasLiquidityUsdUpdate =
      nextPayload.totalLiquidityUsd !== undefined ||
      nextPayload.liquidityBalanceUsd !== undefined;
    const hasInitialLiquidityUpdate =
      nextPayload.initialTotalLiquidity !== undefined;

    if (hasInputLimitUpdate || hasLegacyMaxInputLimitUpdate || hasDefaultInputLimitUpdate) {
      const normalizedInputLimit = this.toNonNegativeNumber(
        nextPayload.inputLimit ??
          nextPayload.maxInputLimit ??
          nextPayload.defaultInputLimit,
        0
      );
      nextPayload.inputLimit = normalizedInputLimit;
      nextPayload.defaultInputLimit = normalizedInputLimit;
      delete nextPayload.maxInputLimit;
    }

    if (hasTotalLiquidityUpdate) {
      nextPayload.totalLiquidity = this.toNonNegativeNumber(
        nextPayload.totalLiquidity,
        0
      );
      nextPayload.liquidityBalance = nextPayload.totalLiquidity;
      if (!hasInitialLiquidityUpdate) {
        nextPayload.initialTotalLiquidity = nextPayload.totalLiquidity;
      }
    } else if (hasLiquidityUsdUpdate) {
      const targetUsdLiquidity = this.toNonNegativeNumber(
        nextPayload.totalLiquidityUsd ?? nextPayload.liquidityBalanceUsd,
        0
      );
      const btcyUsdRate = await getBtcyToStablecoinRate();
      if (!Number.isFinite(btcyUsdRate) || btcyUsdRate <= 0) {
        throw new Error("Unable to resolve BTCY rate for liquidity conversion");
      }

      nextPayload.liquidityBalanceUsd = targetUsdLiquidity;
      nextPayload.liquidityConversionRateUsd = btcyUsdRate;
      nextPayload.totalLiquidity = this.toNonNegativeNumber(
        targetUsdLiquidity / btcyUsdRate,
        0
      );
      nextPayload.liquidityBalance = nextPayload.totalLiquidity;
      if (!hasInitialLiquidityUpdate) {
        nextPayload.initialTotalLiquidity = nextPayload.totalLiquidity;
      }
    } else if (hasLegacyLiquidityUpdate) {
      nextPayload.liquidityBalance = this.toNonNegativeNumber(
        nextPayload.liquidityBalance,
        0
      );
      nextPayload.totalLiquidity = nextPayload.liquidityBalance;
      if (!hasInitialLiquidityUpdate) {
        nextPayload.initialTotalLiquidity = nextPayload.totalLiquidity;
      }
    }

    if (hasInitialLiquidityUpdate) {
      nextPayload.initialTotalLiquidity = this.toNonNegativeNumber(
        nextPayload.initialTotalLiquidity,
        0
      );
    }

    delete nextPayload.totalLiquidityUsd;

    let config = await alchemyConfigService.findOne({});

    if (!config) {
      config = await alchemyConfigService.create(nextPayload);
    } else {
      Object.assign(config, nextPayload);

      config.updatedAt = new Date();

      await alchemyConfigService.updateOne(String((config as any)._id), config);
      config = await alchemyConfigService.findById(String((config as any)._id));
    }

    return await this.normalizeLiquidityConfig(config);
  }

  async startAlchemy(
    email: string,
    inputAmount: number,
    userType: string,
    referralCodeUsed = "",
    nftBoostApplied = false,
    options: StartAlchemyOptions = {}
  ) {
    let reservedLiquidityAmount = 0;
    let reservedLiquidityUsd = 0;
    let reservedLiquidityConfigId = "";
    try {
      const normalizedEmail = String(email || "").toLowerCase();
      if (!email || !normalizedEmail) {
        return { status: 400, message: "Email is required to start alchemy" };
      }

      const sanitizedUserType = String(userType || "").toLowerCase();
      if (!sanitizedUserType) {
        return { status: 400, message: "User type is required" };
      }

      const parsedInputAmount = Number(inputAmount);

      const config = await this.getAdminConfig();
      const configAny: any = config;
      const configId = String((configAny as any)?._id ?? "");

      if (configAny.disabled) {
        return {
          status: 503,
          message: configAny.disabledMessage || ALCHEMY_DISABLED_MESSAGE,
        };
      }

      // 1. Check System Status
      if (config.status === "CLOSED") {
        return {
          status: 403,
          message: "Alchemy system is currently closed by administration.",
        };
      }

      // 2. Minimum Token Validation
      if (parsedInputAmount < config.minTokenRequired) {
        return {
          status: 400,
          message: `Minimum ${config.minTokenRequired} tokens required to start.`,
        };
      }

      const restrictedLimitEmails = new Set(
        ((configAny.restrictedLimitEmails || []) as string[]).map((email) =>
          String(email).toLowerCase()
        )
      );
      const baseInputLimit = this.getBaseInputLimit(configAny);
      const maxInputLimit = restrictedLimitEmails.has(normalizedEmail)
        ? Number(configAny.restrictedInputLimit || 0)
        : baseInputLimit;

      if (maxInputLimit > 0 && parsedInputAmount > maxInputLimit) {
        return {
          status: 400,
          message: `Maximum ${maxInputLimit} tokens allowed per Alchemy session.`,
        };
      }

      // 3. Cooldown Validation
      // Use ALCHEMY_COOLDOWN_MINUTES as fallback — config.cooldownMinutes may be 0/null/undefined,
      // which would make the comparison always false and bypass the cooldown entirely.
      const cooldownMinutes =
        Number(config.cooldownMinutes) || ALCHEMY_COOLDOWN_MINUTES;
      const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
      const recentSession = await this.findOne({
        email: normalizedEmail,
        startedAt: { $gte: cooldownCutoff },
      });
      if (recentSession) {
        const diffMins =
          (Date.now() - recentSession.startedAt.getTime()) / 60000;
        return {
          status: 429,
          message: `Cooldown active. Please wait ${Math.ceil(
            cooldownMinutes - diffMins
          )} minutes.`,
        };
      }

      // Get start of today to calculate daily totals
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // 4. User Daily Limit
      const userSessionsToday = await this.find({
        email: normalizedEmail,
        startedAt: { $gte: startOfDay },
      });
      const userTotalToday = userSessionsToday.reduce(
        (sum, s) => sum + (s.inputAmount || 0),
        0
      );

      if (userTotalToday + parsedInputAmount > config.userDailyLimit) {
        return {
          status: 400,
          message: `Your daily limit of ${config.userDailyLimit} tokens exceeded.`,
        };
      }

      const remainingLiquidity = this.getRemainingLiquidity(configAny);
      const initialTotalLiquidity = this.getInitialTotalLiquidity(
        configAny,
        remainingLiquidity
      );
      const liquidityCapEnabled =
        initialTotalLiquidity > 0 || remainingLiquidity > 0;

      const paymentCoin = options.paymentCoin ?? "BTCY";
      const networkType = options.networkType ?? "Stellar";
      const inputUnit = options.inputUnit ?? paymentCoin;
      const versionTag = options.versionTag ?? "v1";
      const skipBalanceCheck = options.skipBalanceCheck ?? false;
      const isV2 = versionTag === "v2";
      let btcyUsdRate = 0;
      let liveLiquidityFromUsd = 0;

      const v2AllowedEmails = new Set(
        (configAny.v2AllowedEmails || []).map((email: string) =>
          String(email).toLowerCase()
        )
      );
      const v2SpecialMinimumEmails = new Set(
        (configAny.v2SpecialMinimumEmails || []).map((email: string) =>
          String(email).toLowerCase()
        )
      );

      if (isV2 && v2AllowedEmails.size > 0 && !v2AllowedEmails.has(normalizedEmail)) {
        return {
          status: 403,
          message: "Alchemy is currently limited to selected users only",
        };
      }

      if (isV2) {
        const minedNuggets = await this.getBtcyMinedNuggets(
          normalizedEmail
        );
        const requiredMinimum = v2SpecialMinimumEmails.has(normalizedEmail)
          ? Number(configAny.v2MinimumMinedSpecial || MINIMUM_V2_MINED_SPECIAL)
          : Number(configAny.v2MinimumMinedDefault || MINIMUM_V2_MINED_DEFAULT);
        console.log(
          `Alchemy start check: ${normalizedEmail} has mined ${minedNuggets} BTCY Nuggets (requires ${requiredMinimum})`
        );
        if (minedNuggets < requiredMinimum) {
          return {
            status: 403,
            message: `You must have at least ${requiredMinimum.toLocaleString(
              "en-US"
            )} BTCY Nuggets mined to unlock Alchemy`,
          };
        }

        const lastSession = await this.findLatest({
          email: normalizedEmail,
          version: "v2",
        });
        if (lastSession?.startedAt) {
          const cooldownMinutes =
            Number(config.cooldownMinutes) || ALCHEMY_COOLDOWN_MINUTES;
          const nextAvailable = new Date(
            lastSession.startedAt.getTime() + cooldownMinutes * 60 * 1000
          );
          if (Date.now() < nextAvailable.getTime()) {
            return {
              status: 429,
              message: `Alchemy sessions are locked for ${cooldownMinutes} minutes. Next session available on ${nextAvailable.toISOString()}.`,
            };
          }
        }
      }

      let activePool: any = null;
      if (isV2) {
        activePool = await this.ensureV2Pool();
        const poolLiquidity = Math.max(0, activePool?.remainingBalanceUsd ?? 0);
        if (poolLiquidity <= 0) {
          return {
            status: 503,
            message: "Alchemy liquidity pool has insufficient funds",
          };
        }

        btcyUsdRate = await getBtcyToStablecoinRate();
        if (!Number.isFinite(btcyUsdRate) || btcyUsdRate <= 0) {
          return {
            status: 503,
            message: "Unable to resolve BTCY price for live liquidity conversion",
          };
        }

        const configuredUsdLiquidity = this.toNonNegativeNumber(
          configAny?.liquidityBalanceUsd,
          0
        );
        if (configuredUsdLiquidity > 0) {
          liveLiquidityFromUsd = this.toNonNegativeNumber(
            configuredUsdLiquidity / btcyUsdRate,
            0
          );
        }
      }

      if (!skipBalanceCheck) {
        const userWallet = await userService.findOne({
          email: normalizedEmail,
          userWallets: {
            $elemMatch: { coinSymbol: paymentCoin, coinNetwork: networkType },
          },
        });

        if (!userWallet) {
          return { status: 500, message: "User wallet not found" };
        }

        const userCoinWallet = userWallet.userWallets.find(
          (w: any) =>
            w.coinSymbol === paymentCoin && w.coinNetwork === networkType
        );

        if (!userCoinWallet || userCoinWallet.coinBalance < parsedInputAmount) {
          return {
            status: 500,
            message: "Insufficient balance to start alchemy",
          };
        }
      }

      let multiplier: number;
      let multiplierRange = { min: 0, max: 0 };

      if (isV2) {
        multiplier = this.pickV2Multiplier(configAny);
        const configuredV2Multipliers = this.getV2MultiplierValues(configAny);
        multiplierRange = {
          min: Math.min(...configuredV2Multipliers),
          max: Math.max(...configuredV2Multipliers),
        };
      } else {
        const { minMultiplier, maxMultiplier } = this.getMultiplierRange(
          sanitizedUserType,
          parsedInputAmount,
          configAny
        );
        multiplierRange = { min: minMultiplier, max: maxMultiplier };

        const isGreaterThanOne = Math.random() > 0.9;
        if (isGreaterThanOne) {
          const min = Math.max(1.01, minMultiplier);
          multiplier = Number(
            (Math.random() * (maxMultiplier - min) + min).toFixed(2)
          );
        } else {
          const cappedMax = Math.min(1.0, maxMultiplier);
          multiplier = Number(
            (
              Math.random() * (cappedMax - minMultiplier) +
              minMultiplier
            ).toFixed(2)
          );
        }
      }

      let resultAmount = Math.floor(parsedInputAmount * multiplier);
      let resultAmountUsd = 0;
      if (isV2 && activePool) {
        const poolLiquidityUsd = Math.max(0, activePool.remainingBalanceUsd ?? 0);
        const inputAmountUsd = this.toNonNegativeNumber(
          parsedInputAmount * btcyUsdRate,
          0
        );
        resultAmountUsd = this.toNonNegativeNumber(resultAmount * btcyUsdRate, 0);
        const maxPoolBackedResultUsd = inputAmountUsd + poolLiquidityUsd;
        if (resultAmountUsd > maxPoolBackedResultUsd) {
          resultAmount = Math.floor(maxPoolBackedResultUsd / btcyUsdRate);
          resultAmountUsd = this.toNonNegativeNumber(resultAmount * btcyUsdRate, 0);
          multiplier = Number((resultAmount / parsedInputAmount).toFixed(2));
        }
      } else if (isV2) {
        resultAmountUsd = this.toNonNegativeNumber(resultAmount * btcyUsdRate, 0);
      }

      const requiredLiquidityAmount = isV2 ? resultAmount : parsedInputAmount;
      let effectiveRemainingLiquidity = remainingLiquidity;
      if (isV2 && liveLiquidityFromUsd > 0) {
        effectiveRemainingLiquidity = Math.min(
          remainingLiquidity,
          liveLiquidityFromUsd
        );
      }
      const requiredLiquidityUsd = isV2
        ? resultAmountUsd
        : this.toNonNegativeNumber(requiredLiquidityAmount, 0);
      const effectiveRemainingLiquidityUsd = isV2
        ? this.toNonNegativeNumber(effectiveRemainingLiquidity * btcyUsdRate, 0)
        : this.toNonNegativeNumber(effectiveRemainingLiquidity, 0);

      if (
        liquidityCapEnabled &&
        ((isV2 && effectiveRemainingLiquidityUsd < requiredLiquidityUsd) ||
          (!isV2 && effectiveRemainingLiquidity < requiredLiquidityAmount))
      ) {
        return {
          status: 503,
          message: isV2
            ? `Alchemy liquidity exhausted. Remaining liquidity (USD): ${effectiveRemainingLiquidityUsd}. Required (USD): ${requiredLiquidityUsd}.`
            : `Alchemy liquidity exhausted. Remaining liquidity: ${effectiveRemainingLiquidity}. Required: ${requiredLiquidityAmount}.`,
        };
      }

      if (liquidityCapEnabled) {
        if (!configId) {
          return {
            status: 500,
            message: "Alchemy configuration is unavailable",
          };
        }

        const reservationQuery: any = {
          _id: configId,
          totalLiquidity: { $gte: requiredLiquidityAmount },
        };
        const reservationInc: any = {
          totalLiquidity: -requiredLiquidityAmount,
          liquidityBalance: -requiredLiquidityAmount,
        };
        if (isV2) {
          reservationQuery.liquidityBalanceUsd = { $gte: requiredLiquidityUsd };
          reservationInc.liquidityBalanceUsd = -requiredLiquidityUsd;
        }

        const updatedConfig = await alchemyConfigService.findOneUpdate(
          reservationQuery,
          {
            $inc: reservationInc,
            $set: { updatedAt: new Date() },
          },
          { new: true }
        );

        if (!updatedConfig) {
          const latestConfig: any = await this.getAdminConfig();
          const latestRemaining = this.getRemainingLiquidity(latestConfig);
          const latestRemainingUsd = this.toNonNegativeNumber(
            latestConfig?.liquidityBalanceUsd,
            0
          );
          return {
            status: 503,
            message: isV2
              ? `Alchemy liquidity exhausted. Remaining liquidity (USD): ${latestRemainingUsd}.`
              : `Alchemy liquidity exhausted. Remaining liquidity: ${latestRemaining}.`,
          };
        }

        reservedLiquidityAmount = requiredLiquidityAmount;
        reservedLiquidityUsd = isV2 ? requiredLiquidityUsd : 0;
        reservedLiquidityConfigId = configId;
      }

      const isJackpot = multiplier >= multiplierRange.max * 0.95;

      const session: any = {
        sessionId: uuidv1(),
        email,
        coinName: paymentCoin,
        userType: sanitizedUserType,
        category: sanitizedUserType,
        inputAmount: parsedInputAmount,
        inputUnit,
        multiplier,
        resultAmount,
        version: versionTag,
        status: "pending",
        startedAt: new Date(),
        completedAt: undefined,
        durationMinutes: undefined,
        notes: "",
        isJackpot,
        streakCount: 0,
        referralCodeUsed,
        poolId: activePool?.poolId,
      };

      const createdSession = await this.create(session);

      try {
        await txservice.create({
          orderId: uuidv1(),
          extRef: createdSession.sessionId,
          txId: "",
          from: email,
          to: ADMIN_EMAIL,
          amount: parsedInputAmount,
          info: "Pending Alchemy deposit",
          status: OrderStatus.Pending,
          currencyRef: paymentCoin,
          walletType: "ASSET_WALLET",
          transactionType: "USER_ALCHEMY_START",
          exchangeName: "CEX",
          email,
          txDate: new Date(),
          benificaryAddress: "",
          notes: "Alchemy session start (pending)",
        });
      } catch (err) {
        console.error(
          "Failed to record start transaction for Alchemy session:",
          err
        );
      }

      return {
        status: 200,
        data: createdSession,
        message: "Alchemy session started successfully",
      };
    } catch (err) {
      if (reservedLiquidityAmount > 0 && reservedLiquidityConfigId) {
        const rollbackInc: any = {
          totalLiquidity: reservedLiquidityAmount,
          liquidityBalance: reservedLiquidityAmount,
        };
        if (reservedLiquidityUsd > 0) {
          rollbackInc.liquidityBalanceUsd = reservedLiquidityUsd;
        }
        try {
          await alchemyConfigService.updatePart(
            { _id: reservedLiquidityConfigId },
            {
              $inc: rollbackInc,
              $set: { updatedAt: new Date() },
            }
          );
        } catch (rollbackErr) {
          console.error(
            "Failed to rollback reserved Alchemy liquidity after start failure:",
            rollbackErr
          );
        }
      }
      console.error("Error while starting alchemy session:", err);
      return { status: 500, message: "Unable to start alchemy session" };
    }
  }

  async startAlchemyV2(
    email: string,
    nuggetTokens: number,
    userType: string,
    referralCodeUsed = "",
    nftBoostApplied = false
  ) {
    return this.startAlchemy(
      email,
      nuggetTokens,
      userType,
      referralCodeUsed,
      nftBoostApplied,
      {
        versionTag: "v2",
        inputUnit: "nugget",
      }
    );
  }

  async completeAlchemy(
    sessionId: string,
    options: CompleteAlchemyOptions = {}
  ): Promise<{ status: number; data?: AlchemySessionModel; message: string }> {
    try {
      const config: any = await this.getAdminConfig();
      if (config.disabled) {
        return {
          status: 503,
          message: config.disabledMessage || ALCHEMY_DISABLED_MESSAGE,
        };
      }
      if (config.status === "CLOSED") {
        return {
          status: 403,
          message: "Alchemy system is currently closed by administration.",
        };
      }

      const session = await this.findOne({
        sessionId: sessionId,
        status: "pending",
      });
      if (!session) {
        return { status: 500, message: "Session not found" };
      }

      const completedAt = new Date();
      const durationMinutes = Math.floor(
        (completedAt.getTime() - session.startedAt.getTime()) / 60000
      );

      const userEmail = session.email;
      const inputAmount = session.inputAmount;
      const resultAmount = session.resultAmount;
      const paymentCoin = ALCHEMY_INPUT_COIN_SYMBOL;
      const networkType = ALCHEMY_INPUT_COIN_NETWORK;
      const adminEmail = ADMIN_EMAIL;

      const withdrawalType = String(
        options.withdrawalType || "indexx"
      ).toLowerCase();
      const withdrawalAddressInput = options.withdrawalAddress ?? "";
      const withdrawalAddress = String(withdrawalAddressInput).trim();
      const { targetNetwork, isExternal } =
        this.resolveWithdrawalTarget(withdrawalType);

      if (isExternal && !withdrawalAddress) {
        return {
          status: 400,
          message:
            "Withdrawal address is required when selecting an external network",
        };
      }

      const adminReceives = inputAmount - resultAmount;
      if (session.version === "v2" && session.poolId) {
        const netPoolImpactUsd = resultAmount - inputAmount; // positive when payout exceeds the deposit
        try {
          await alchemyPoolService.recordUsage(session.poolId, {
            sessionId,
            email: userEmail,
            multiplier: session.multiplier,
            deltaUsd: -netPoolImpactUsd,
            inputAmount,
            resultAmount,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error("Failed to record Alchemy pool usage:", err);
        }
      }

      // Step 1: Check user balance
      const userWallet = await userService.findOne({
        email: userEmail,
        userWallets: {
          $elemMatch: { coinSymbol: paymentCoin, coinNetwork: networkType },
        },
      });

      const userCoinWallet = userWallet?.userWallets.find(
        (w: any) =>
          w.coinSymbol === paymentCoin && w.coinNetwork === networkType
      );

      if (!userCoinWallet) {
        return { status: 500, message: "User wallet not found" };
      }

      if (userCoinWallet.coinBalance < inputAmount) {
        return { status: 500, message: "Insufficient balance for alchemy" };
      }

      // Step 2: Subtract inputAmount from user's withdrawable BTCY Stellar wallet.
      const debitResult: any = await userService.updatePartWithOptions(
        { email: userEmail.toLowerCase() }, // normalize email to avoid case mismatches
        {
          $inc: { "userWallets.$[stellar].coinBalance": -inputAmount },
          $set: { "userWallets.$[stellar].coinLastUsedOn": new Date() },
        },
        {
          arrayFilters: [
            {
              "stellar.coinSymbol": "BTCY",
              "stellar.coinNetwork": "Stellar",
              "stellar.coinBalance": { $gte: inputAmount },
            },
          ],
        }
      );
      const debitedCount =
        debitResult?.modifiedCount ?? debitResult?.nModified ?? debitResult?.n ?? 0;
      if (!debitedCount) {
        return {
          status: 500,
          message: `Unable to debit ${inputAmount} ${paymentCoin} from ${networkType} wallet`,
        };
      }

      const debitSourceNote = `Debited ${inputAmount} ${paymentCoin} from user ${networkType} wallet`;
      // Step 3: Add winning amount to the targeted wallet
      let getToUser = await userService.findOne({
        email: String(userEmail).toLowerCase(),
      });

      if (!isExternal) {
        await this.ensureUserWalletForNetwork(
          userEmail,
          paymentCoin,
          targetNetwork
        );

        await userService.updatePartWithOptions(
          { email: userEmail.toLowerCase() },
          {
            $inc: { "userWallets.$[yy].coinBalance": resultAmount },
            $set: { "userWallets.$[yy].coinLastUsedOn": new Date() },
          },
          {
            arrayFilters: [
              { "yy.coinSymbol": "BTCY", "yy.coinNetwork": targetNetwork },
            ],
          }
        );
      } else {
        console.log(
          `Alchemy external withdrawal (${withdrawalType}) recorded for ${userEmail}, destination ${withdrawalAddress}, amount ${resultAmount}`
        );
        await this.scheduleExternalAirdropClaim(
          withdrawalAddress,
          resultAmount
        );
        try {
          await sendEmail.sendAlchemyExternalWalletRequest({
            userEmail,
            amount: resultAmount,
            network: targetNetwork,
            withdrawalAddress,
            sessionId,
            withdrawalType,
          });
        } catch (err) {
          console.error(
            "Failed to notify admin about external Alchemy withdrawal:",
            err
          );
        }
      }

      const payoutTargetNote = isExternal
        ? `Alchemy payout ${resultAmount} ${paymentCoin} scheduled to external ${targetNetwork} wallet`
        : `Credited ${resultAmount} ${paymentCoin} to user ${targetNetwork} wallet`;

      // Step 4: Add adminReceives to admin wallet
      const adminSelectorEmail = adminEmail.toLowerCase();

      let up = await userService.updatePartWithOptions(
        { email: adminSelectorEmail },
        {
          $inc: { "userWallets.$[w].coinBalance": adminReceives },
          $set: { "userWallets.$[w].coinLastUsedOn": new Date() },
        },
        {
          arrayFilters: [
            { "w.coinSymbol": paymentCoin, "w.coinNetwork": networkType },
          ],
        }
      );

      // Step 5: Create transaction record
      await txservice.create({
        email: adminEmail,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: userEmail,
        to: adminEmail,
        amount: adminReceives,
        exchangeName: "CEX",
        info: "Alchemy session admin share",
        status: OrderStatus.Completed,
        currencyRef: paymentCoin,
        walletType: "ASSET_WALLET",
        transactionType: "USER_ALCHEMY_TRANSACTION",
        txDate: new Date(),
        benificaryAddress: "",
      });

      try {
        await txservice.updatePart(
          {
            extRef: sessionId,
            transactionType: "USER_ALCHEMY_START",
          },
          {
            $set: {
              status: OrderStatus.Completed,
              txDate: new Date(),
              notes: "Alchemy session settled",
            },
          }
        );
      } catch (err) {
        console.error("Failed to finalize Alchemy start transaction:", err);
      }

      // Step 6: Mark session completed
      await this.updatePart(
        { sessionId: sessionId },
        {
          $set: {
            status: "completed",
            completedAt,
            durationMinutes,
            withdrawalType,
            withdrawalAddress,
            targetNetwork,
            notes: `${debitSourceNote}; ${payoutTargetNote}`,
          },
        }
      );

      const completedSession = await this.findOne({ sessionId: sessionId });

      try {
        await sendEmail.sendAlchemySessionCompletedEmail({
          toEmail: String(userEmail).toLowerCase(),
          sessionId,
          inputAmount,
          resultAmount,
          inputUnit: session.inputUnit || paymentCoin,
          paymentCoin,
          userType: session.userType,
          multiplier: session.multiplier,
          version: session.version,
          startedAt: session.startedAt,
          completedAt,
          durationMinutes,
          withdrawalType,
          targetNetwork,
          withdrawalAddress,
        });
      } catch (emailErr) {
        console.error(
          "Failed to send Alchemy session completion email:",
          emailErr
        );
      }

      return {
        status: 200,
        data: completedSession,
        message: "Alchemy session completed successfully",
      };
    } catch (err) {
      console.error("Error in completeAlchemy:", err);
      return {
        status: 500,
        message: "Failed to complete alchemy session due to server error",
      };
    }
  }

  async finalizeExternalAirdrop(
    sessionId: string
  ): Promise<{ status: number; message: string }> {
    try {
      const config: any = await this.getAdminConfig();
      if (config.disabled) {
        return {
          status: 503,
          message: config.disabledMessage || ALCHEMY_DISABLED_MESSAGE,
        };
      }

      if (!sessionId) {
        return { status: 400, message: "Session Id is required" };
      }

      const session = await this.findOne({ sessionId });
      if (!session) {
        return { status: 404, message: "Session not found" };
      }

      const { isExternal } = this.resolveWithdrawalTarget(
        session.withdrawalType ?? ""
      );
      const withdrawalAddress = String(session.withdrawalAddress ?? "").trim();

      if (!isExternal) {
        return {
          status: 400,
          message:
            "External airdrop finalization only applies to TRON/Solana withdrawals",
        };
      }

      if (!withdrawalAddress) {
        return {
          status: 400,
          message: "Withdrawal address is missing for this session",
        };
      }

      await finalizeAirdropRecipient(withdrawalAddress);
      await this.updatePart(
        { sessionId },
        {
          $set: {
            externalClaimFinalizedAt: new Date(),
          },
        }
      );

      return { status: 200, message: "External airdrop allocation cleared" };
    } catch (err) {
      console.error("Error while finalizing external airdrop:", err);
      return {
        status: 500,
        message: "Unable to finalize external airdrop claim",
      };
    }
  }

  private async scheduleExternalAirdropClaim(
    withdrawalAddress: string,
    amount: number
  ) {
    if (!withdrawalAddress || amount <= 0) {
      return;
    }

    try {
      await addToAirdropWhitelist([withdrawalAddress]);
      await setAirdropAllocations([withdrawalAddress], [amount]);
    } catch (err) {
      console.error(
        "Failed to schedule external airdrop claim for",
        withdrawalAddress,
        err
      );
    }
  }

  private async getBtcyMinedNuggets(email: string): Promise<number> {
    const normalizedEmail = String(email || "").toLowerCase();
    const [user] = await Promise.all([
      userService.findOneSelect(
        { email: normalizedEmail },
        { userWallets: 1 }
      ),
    ]);
    const stellarBtcyWallet = (user as any)?.userWallets?.find(
      (wallet: any) =>
        String(wallet?.coinSymbol || "").toUpperCase() === "BTCY" &&
        String(wallet?.coinNetwork || "").toLowerCase() === "stellar"
    );
    const withdrawableWalletBalance = Number(
      stellarBtcyWallet?.coinBalance ?? 0
    );

    return withdrawableWalletBalance;
  }

  private async ensureV2Pool() {
    let pool = await alchemyPoolService.getActivePool();
    if (!pool) {
      pool = await alchemyPoolService.createPool({
        name: DEFAULT_POOL_NAME,
        amountUsd: DEFAULT_POOL_USD,
        durationDays: DEFAULT_POOL_DURATION_DAYS,
        description: "Auto-created Alchemy liquidity pool",
      });
    }
    return pool;
  }

  private resolveWithdrawalTarget(withdrawalType: string) {
    const normalized = (withdrawalType || "").trim().toLowerCase();
    const mapping: Record<
      string,
      { targetNetwork: string; isExternal: boolean }
    > = {
      indexx: { targetNetwork: "Ying Yang Chain", isExternal: false },
      indexx_asset_wallet: {
        targetNetwork: "Ying Yang Chain",
        isExternal: false,
      },
      solana: { targetNetwork: "Solana", isExternal: true },
      tron: { targetNetwork: "Tron", isExternal: true },
    };
    return (
      mapping[normalized] ?? {
        targetNetwork: "Ying Yang Chain",
        isExternal: false,
      }
    );
  }

  private async ensureUserWalletForNetwork(
    email: string,
    coinSymbol: string,
    network: string
  ) {
    const normalizedEmail = String(email || "").toLowerCase();
    const user = await userService.findOneSelect(
      { email: normalizedEmail },
      { userWallets: 1 }
    );
    if (!user) {
      throw new Error("User not found while ensuring wallet");
    }

    const walletExists = (user.userWallets || []).some(
      (wallet: any) =>
        String(wallet?.coinSymbol || "").toUpperCase() ===
          coinSymbol.toUpperCase() &&
        String(wallet?.coinNetwork || "") === network
    );

    if (!walletExists) {
      await userService.updatePart(
        { email: normalizedEmail },
        {
          $push: {
            userWallets: this.generateWalletTemplate(coinSymbol, network),
          },
        }
      );
    }
  }

  private generateWalletTemplate(coinSymbol: string, network: string) {
    const now = new Date();
    return {
      userId: "",
      coinType: coinSymbol,
      coinWalletAddress: "",
      coinPrivateKey: "",
      coinNetwork: network,
      coinName: coinSymbol,
      coinSymbol,
      coinDecimals: 7,
      coinStakedBalance: 0,
      coinBalance: 0,
      coinBalanceInUSD: 0,
      coinBalanceInBTC: 0,
      coinCreatedOn: now,
      coinLastUsedOn: now,
      coinPrice: 0,
      coinPrevPrice: 0,
      isCoinActive: true,
      isImported: 0,
      notes: "",
      specialNotes: "",
      amountInvested: 0,
    };
  }

  private pickRandomMultiplier(min: number, max: number) {
    if (min === max) {
      return Number(min.toFixed(2));
    }
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }

  private getV2MultiplierValues(config?: any): number[] {
    const configuredMultipliers = Array.isArray(config?.v2FallbackMultipliers)
      ? config.v2FallbackMultipliers
      : [];
    const values = configuredMultipliers
      .map(Number)
      .filter((value: number) => Number.isFinite(value) && value > 0);

    if (values.length) {
      return values;
    }

    const singleMultiplier = Number(config?.multiplier);
    if (Number.isFinite(singleMultiplier) && singleMultiplier > 0) {
      return [singleMultiplier];
    }

    throw new Error("Alchemy v2 multipliers are not configured");
  }

  private pickV2Multiplier(config?: any) {
    const multipliers = this.getV2MultiplierValues(config);
    const index = Math.floor(Math.random() * multipliers.length);
    return multipliers[index];
  }

  getMultiplierRange(userType: string, input: number, adminConfig?: any) {
    const config = adminConfig?.multiplierRanges;
    if (!config) throw new Error("Alchemy multiplier ranges are not configured");
    if (!config[userType]) throw new Error("Invalid user type");

    const idx = config[userType].inputs.findIndex((val: number) => input <= val);
    if (idx === -1) throw new Error("Invalid input for user type");

    const [minMultiplier, maxMultiplier] = config[userType].ranges[idx];
    return { minMultiplier, maxMultiplier };
  }

  async getAlchemyTransactionTotals(options?: {
    version?: string;
    status?: string;
  }) {
    const match: any = {};
    const statusFilter = String(options?.status ?? "completed")
      .trim()
      .toLowerCase();
    if (statusFilter && statusFilter !== "all") {
      match.status = statusFilter;
    }
    if (options?.version) {
      match.version = options.version;
    }

    const config: any = await this.getAdminConfig();
    const excludedEmails = (
      config.transactionSummaryExcludedEmails ||
      Array.from(ALCHEMY_TRANSACTION_SUMMARY_EXCLUDED_EMAILS)
    ).map((email: string) => String(email).toLowerCase());
    const pipeline: any[] = [{ $match: match }];
    if (excludedEmails.length) {
      pipeline.push({
        $match: {
          $expr: {
            $not: {
              $in: [{ $toLower: "$email" }, excludedEmails],
            },
          },
        },
      });
    }
    pipeline.push({
      $group: {
        _id: null,
        totalInputAmount: { $sum: { $ifNull: ["$inputAmount", 0] } },
        totalResultAmount: { $sum: { $ifNull: ["$resultAmount", 0] } },
        totalSessions: { $sum: 1 },
      },
    });

    const [aggregated] = await this.findAggregate<{
      totalInputAmount: number;
      totalResultAmount: number;
      totalSessions: number;
    }>(pipeline);

    return {
      totalInputAmount: aggregated?.totalInputAmount ?? 0,
      totalResultAmount: aggregated?.totalResultAmount ?? 0,
      totalSessions: aggregated?.totalSessions ?? 0,
    };
  }
}
