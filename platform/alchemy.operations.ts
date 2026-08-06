import {
  ALCHEMY_DEFAULT_INPUT_LIMIT,
  ALCHEMY_RESTRICTED_INPUT_LIMIT,
  formatAlchemyInputLimitLabel,
} from "../helpers/alchemyHelper";
import { AlchemyService } from "../services/alchemy.service";
import { getBtcyToStablecoinRate } from "../services/sell.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
const alchemyService = new AlchemyService();

interface StartAlchemyOverrides {
  inputFieldName?: string;
  versionTag?: string;
  inputUnit?: string;
  skipBalanceCheck?: boolean;
}

function buildAlchemyAdminConfigResponse(config: any, btcyPriceUsd?: number) {
  const rawConfig = (config as any)?.toObject
    ? (config as any).toObject()
    : config;
  const inputLimit = Number(
    rawConfig?.inputLimit ??
      rawConfig?.defaultInputLimit ??
      ALCHEMY_DEFAULT_INPUT_LIMIT
  );
  const defaultInputLimit = inputLimit;
  const restrictedInputLimit = Number(
    rawConfig?.restrictedInputLimit ?? ALCHEMY_RESTRICTED_INPUT_LIMIT
  );
  const maxInputLimit = inputLimit;
  const totalLiquidity = Number(
    rawConfig?.totalLiquidity ?? rawConfig?.liquidityBalance ?? 0
  );
  const initialTotalLiquidity = Number(
    rawConfig?.initialTotalLiquidity ?? totalLiquidity
  );
  const usedLiquidity = Math.max(0, initialTotalLiquidity - totalLiquidity);
  const liquidityBalanceUsd = Number(rawConfig?.liquidityBalanceUsd ?? 0);
  const storedLiquidityConversionRateUsd = Number(
    rawConfig?.liquidityConversionRateUsd ?? 0
  );
  const resolvedBtcyPriceUsd = Number.isFinite(Number(btcyPriceUsd))
    ? Number(btcyPriceUsd)
    : storedLiquidityConversionRateUsd;
  const liquidityConversionRateUsd =
    resolvedBtcyPriceUsd > 0
      ? resolvedBtcyPriceUsd
      : storedLiquidityConversionRateUsd;

  return {
    ...rawConfig,
    inputLimit,
    defaultInputLimit,
    restrictedInputLimit,
    maxInputLimit,
    maxInputLimitLabel: formatAlchemyInputLimitLabel(maxInputLimit),
    totalLiquidity,
    totalLiquidityUsd: liquidityBalanceUsd,
    initialTotalLiquidity,
    usedLiquidity,
    liquidityBalance: totalLiquidity,
    liquidityBalanceUsd,
    liquidityConversionRateUsd,
    btcyPriceUsd: liquidityConversionRateUsd,
    btcyPrice: liquidityConversionRateUsd,
  };
}

function normalizeDateFilter(from?: any, to?: any) {
  const dateFilter: any = {};
  const fromDate = from ? new Date(String(from)) : null;
  const toDate = to ? new Date(String(to)) : null;

  if (fromDate && Number.isFinite(fromDate.getTime())) {
    dateFilter.$gte = fromDate;
  }
  if (toDate && Number.isFinite(toDate.getTime())) {
    dateFilter.$lte = toDate;
  }

  return Object.keys(dateFilter).length ? dateFilter : undefined;
}

function serializeAlchemySession(session: any) {
  const raw = session?.toObject ? session.toObject() : session;
  return {
    id: String(raw?._id || ""),
    sessionId: raw?.sessionId || "",
    email: raw?.email || "",
    coinName: raw?.coinName || "",
    inputUnit: raw?.inputUnit || "",
    userType: raw?.userType || "",
    category: raw?.category || "",
    inputAmount: raw?.inputAmount ?? 0,
    resultAmount: raw?.resultAmount ?? 0,
    multiplier: raw?.multiplier ?? 0,
    version: raw?.version || "",
    status: raw?.status || "",
    startedAt: raw?.startedAt || null,
    completedAt: raw?.completedAt || null,
    durationMinutes: raw?.durationMinutes ?? null,
    notes: raw?.notes || "",
    withdrawalType: raw?.withdrawalType || "",
    withdrawalAddress: raw?.withdrawalAddress || "",
    targetNetwork: raw?.targetNetwork || "",
    externalClaimFinalizedAt: raw?.externalClaimFinalizedAt || null,
    isJackpot: Boolean(raw?.isJackpot),
    streakCount: raw?.streakCount ?? 0,
    referralCodeUsed: raw?.referralCodeUsed || "",
    poolId: raw?.poolId || "",
  };
}

export class AlchemyOperations extends BaseAPIOperations {
  private readonly request: Request;

  constructor(req: Request, res: Response) {
    super(req, res);
    this.request = req;
  }

  private resolveInputAmount(
    body: Record<string, any>,
    overrides?: StartAlchemyOverrides
  ): number | null {
    const preferredFields = [
      overrides?.inputFieldName,
      "inputAmount",
      "tokens",
      "tokenAmount",
      "nuggetTokens",
      "nuggets",
      "amount",
    ].filter(Boolean) as string[];

    for (const field of preferredFields) {
      const rawValue = body?.[field];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  async createAlchemySession(req: Request, res: Response) {
    try {
      const session = await alchemyService.createSession(req.body);
      const data = {
        message: "Alchemy created successfully",
        status: 200,
        session: session,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Alchemy created failed",
        status: 500,
      };
      return data;
    }
  }

  async listAlchemySessions(req: Request, res: Response) {
    try {
      const sessions = await alchemyService.getAllSessions();
      return {
        message: "List Alchemy sessions fetched successfully",
        status: 200,
        session: sessions,
      };
    } catch (err: any) {
      return {
        message: "List Alchemy failed",
        status: 500,
      };
    }
  }

  async listAlchemySessionsForAdmin(req: Request, res: Response) {
    try {
      const limitInput = Number(req.query.limit || 100);
      const pageInput = Number(req.query.page || 1);
      const limit = Number.isFinite(limitInput)
        ? Math.min(Math.max(limitInput, 1), 500)
        : 100;
      const page = Number.isFinite(pageInput) ? Math.max(pageInput, 1) : 1;
      const skip = (page - 1) * limit;

      const filters: Record<string, any> = {};
      const status = String(req.query.status || "").trim();
      const email = String(req.query.email || "").trim().toLowerCase();
      const version = String(req.query.version || "").trim();
      const dateField = String(req.query.dateField || "startedAt").trim();
      const dateFilter = normalizeDateFilter(req.query.from, req.query.to);

      if (status) filters.status = status;
      if (email) filters.email = email;
      if (version) filters.version = version;
      if (dateFilter) {
        filters[dateField === "completedAt" ? "completedAt" : "startedAt"] =
          dateFilter;
      }

      const [sessions, total] = await Promise.all([
        alchemyService.findPaginatedSkip(
          limit,
          skip,
          { startedAt: -1, completedAt: -1 },
          filters,
          undefined
        ),
        alchemyService.findCount(filters),
      ]);

      return {
        status: 200,
        data: {
          total,
          page,
          limit,
          filters,
          sessions: sessions.map(serializeAlchemySession),
        },
      };
    } catch (err: any) {
      console.error("Failed to fetch admin Alchemy sessions:", err);
      return {
        status: 500,
        data: { message: "Unable to fetch Alchemy sessions" },
      };
    }
  }

  async getAlchemyTransactionSummary(req: Request, res: Response) {
    try {
      const version = req.query.version
        ? String(req.query.version).trim()
        : undefined;
      const status = req.query.status
        ? String(req.query.status).trim()
        : undefined;
      const summary = await alchemyService.getAlchemyTransactionTotals({
        version,
        status,
      });
      return {
        message: "Alchemy transaction summary fetched successfully",
        status: 200,
        data: summary,
      };
    } catch (err: any) {
      console.error("Failed to fetch alchemy transaction summary:", err);
      return {
        message: "Alchemy transaction summary fetch failed",
        status: 500,
      };
    }
  }

  async getUserAlchemySessions(req: Request, res: Response) {
    try {
      const email = req.params.email;
      const sessions = await alchemyService.getUserSessions(email);
      const data = {
        message: "Get Alchemy Sessions successfully",
        status: 200,
        session: sessions,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Get Alchemy Sessions failed",
        status: 500,
      };
      return data;
    }
  }

  async getUserAlchemySessionById(req: Request, res: Response) {
    try {
      const email = req.params.email;
      const sessionId = req.params.sessionId;
      const session = await alchemyService.getUserSessionById(email, sessionId);
      const data = {
        message: "Get Alchemy Session by id successfully",
        status: 200,
        session: session,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Get Alchemy Session by id failed",
        status: 500,
      };
      return data;
    }
  }

  async startAlchemySession(
    req: Request,
    res: Response,
    overrides: StartAlchemyOverrides = {}
  ) {
    try {
      const body = req.body ?? {};
      const { email, userType } = body;

      if (!email) {
        return { status: 400, message: "Email is required" };
      }

      if (!userType) {
        return { status: 400, message: "User type is required" };
      }

      const resolvedAmount = this.resolveInputAmount(body, overrides);
      if (!resolvedAmount || resolvedAmount <= 0) {
        return { status: 400, message: "A valid token amount is required" };
      }

      const referralCodeUsed = body?.referralCodeUsed ?? "";
      const nftBoostApplied = Boolean(body?.nftBoostApplied);
      const versionTag =
        overrides.versionTag ?? body?.version ?? body?.apiVersion ?? "v1";
      const inputUnit =
        overrides.inputUnit ??
        body?.inputUnit ??
        (overrides.inputFieldName === "nuggetTokens" ||
        body?.nuggetTokens !== undefined
          ? "nugget"
          : "BTCY");

      return await alchemyService.startAlchemy(
        email,
        resolvedAmount,
        userType,
        referralCodeUsed,
        nftBoostApplied,
        {
          versionTag,
          inputUnit,
          skipBalanceCheck: overrides.skipBalanceCheck ?? false,
        }
      );
    } catch (err) {
      console.error("Error in startAlchemySession:", err);
      return {
        message: "Alchemy process failed due to server error",
        status: 500,
      };
    }
  }

  async startAlchemySessionV2(req: any, res: any) {
    return this.startAlchemySession(req, res, {
      versionTag: "v2",
      inputFieldName: "nuggetTokens",
      inputUnit: req.body?.inputUnit ?? "nugget",
    });
  }

  async completeAlchemySession(req: Request, res: Response) {
    try {
      const sessionId = req.body.sessionId;
      const withdrawalType = req.body.withdrawalType;
      const withdrawalAddress = req.body.withdrawalAddress;
      if (!sessionId) {
        return { status: 400, message: "Session Id is required" };
      }

      return await alchemyService.completeAlchemy(sessionId, {
        withdrawalType,
        withdrawalAddress,
      });
    } catch (err) {
      console.error("Error in completeAlchemySession:", err);
      return {
        message: "Alchemy completion failed due to server error",
        status: 500,
      };
    }
  }

  async finalizeExternalAirdrop(req: Request, res: Response) {
    try {
      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return { status: 400, message: "Session Id is required" };
      }

      return await alchemyService.finalizeExternalAirdrop(sessionId);
    } catch (err) {
      console.error("Error in finalizeExternalAirdrop:", err);
      return {
        message: "External airdrop finalization failed due to server error",
        status: 500,
      };
    }
  }

  async getAlchemyConfig(req: Request, res: Response) {
    try {
      const userEmail = String(this.request?.user?.email ?? "").toLowerCase();
      const adminConfig: any = await alchemyService.getAdminConfig();
      let btcyPriceUsd = Number(adminConfig?.liquidityConversionRateUsd ?? 0);
      try {
        const liveRate = await getBtcyToStablecoinRate();
        if (Number.isFinite(liveRate) && liveRate > 0) {
          btcyPriceUsd = liveRate;
        }
      } catch (err) {
        console.warn("Failed to fetch live BTCY price for Alchemy config", err);
      }
      const normalizedConfig = buildAlchemyAdminConfigResponse(
        adminConfig,
        btcyPriceUsd
      );
      const restrictedEmails = new Set(
        (normalizedConfig.restrictedLimitEmails || []).map((email: string) =>
          String(email).toLowerCase()
        )
      );
      const baseInputLimit = Number(
        normalizedConfig.inputLimit ??
          normalizedConfig.defaultInputLimit ??
          ALCHEMY_DEFAULT_INPUT_LIMIT
      );
      const maxInputLimit = restrictedEmails.has(userEmail)
        ? Number(normalizedConfig.restrictedInputLimit)
        : baseInputLimit;
      const maxInputLimitLabel = formatAlchemyInputLimitLabel(maxInputLimit);
      const data = {
        message: "Alchemy Config fetched successfully",
        status: 200,
        session: normalizedConfig.alchemyTiers,
        config: normalizedConfig,
        selectedUsersOnlyLabel: normalizedConfig.selectedUsersOnlyLabel,
        maxInputLimit,
        maxInputLimitLabel,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Alchemy Config fetch failed",
        status: 500,
      };
      return data;
    }
  }

  async getAdminConfig(req: Request, res: Response) {
    try {
      // Call it directly from alchemyService
      const config = await alchemyService.getAdminConfig();
      let btcyPriceUsd = Number((config as any)?.liquidityConversionRateUsd ?? 0);
      try {
        const liveRate = await getBtcyToStablecoinRate();
        if (Number.isFinite(liveRate) && liveRate > 0) {
          btcyPriceUsd = liveRate;
        }
      } catch (err) {
        console.warn("Failed to fetch live BTCY price for Alchemy admin config", err);
      }
      return {
        status: 200,
        message: "Config fetched successfully",
        data: buildAlchemyAdminConfigResponse(config, btcyPriceUsd),
      };
    } catch (err) {
      console.error("Error fetching config:", err);
      return { status: 500, message: "Failed to fetch config" };
    }
  }

  async updateAdminConfig(req: Request, res: Response) {
    try {
      const payload = req.body;
      // Call it directly from alchemyService
      const updatedConfig = await alchemyService.updateAdminConfig(payload);
      return {
        status: 200,
        message: "Config updated successfully",
        data: buildAlchemyAdminConfigResponse(updatedConfig),
      };
    } catch (err) {
      console.error("Error updating config:", err);
      return { status: 500, message: "Failed to update config" };
    }
  }
}
