import SellConfigSchema, {
  SellConfig,
  SellConfigModel,
} from "../models/sellConfig";
import { AlchemyConfigService } from "./alchemy.service";
import { ServiceBase } from "./base";

const alchemyConfigService = new AlchemyConfigService();

function normalizeSellConfigPayload(payload: any = {}) {
  const normalized: any = {};

  if (payload.status !== undefined) {
    normalized.status = String(payload.status).toUpperCase();
  }

  if (payload.minTokenRequired !== undefined) {
    normalized.minTokenRequired = Number(payload.minTokenRequired);
  }

  if (payload.userDailyLimit !== undefined) {
    normalized.userDailyLimit = Number(payload.userDailyLimit);
  }

  if (payload.totalDailyLimit !== undefined) {
    normalized.totalDailyLimit = Number(payload.totalDailyLimit);
  }

  if (payload.liquidityBalance !== undefined) {
    normalized.liquidityBalance = Number(payload.liquidityBalance);
  }

  if (payload.dailyFeePercent !== undefined) {
    normalized.dailyFeePercent = Number(payload.dailyFeePercent);
  }

  if (payload.unavailableMessage !== undefined) {
    normalized.unavailableMessage = String(payload.unavailableMessage);
  }

  return normalized;
}

function stripInvalidNumbers(payload: any) {
  for (const key of [
    "minTokenRequired",
    "userDailyLimit",
    "totalDailyLimit",
    "liquidityBalance",
    "dailyFeePercent",
  ]) {
    if (
      payload[key] !== undefined &&
      (!Number.isFinite(payload[key]) || payload[key] < 0)
    ) {
      delete payload[key];
    }
  }

  if (payload.status && !["OPEN", "CLOSED"].includes(payload.status)) {
    delete payload.status;
  }

  return payload;
}

export class SellConfigService extends ServiceBase<
  SellConfig,
  SellConfigModel
> {
  constructor() {
    super(SellConfigSchema, "SellConfig");
  }

  async getAdminConfig() {
    let config = await this.findOne({});

    if (!config) {
      const alchemyConfig: any = await alchemyConfigService.findOne({});
      const initialConfig = stripInvalidNumbers(
        normalizeSellConfigPayload({
          status: alchemyConfig?.status ?? "CLOSED",
          minTokenRequired: alchemyConfig?.minTokenRequired ?? 10,
          userDailyLimit: alchemyConfig?.userDailyLimit ?? 1000,
          totalDailyLimit: alchemyConfig?.totalDailyLimit ?? 10000,
          liquidityBalance: alchemyConfig?.liquidityBalance ?? 0,
          dailyFeePercent: alchemyConfig?.dailyFeePercent ?? 3,
          unavailableMessage: "The sell service is temporarily unavailable.",
        })
      );

      config = await this.create(initialConfig as SellConfig);
    }

    return config;
  }

  async updateAdminConfig(payload: any) {
    const normalized = stripInvalidNumbers(normalizeSellConfigPayload(payload));
    let config = await this.findOne({});

    if (!config) {
      config = await this.create(normalized as SellConfig);
    } else {
      Object.assign(config, normalized);
      config.updatedAt = new Date();
      await this.updateOne(String((config as any)._id), config);
      config = await this.findById(String((config as any)._id));
    }

    return config;
  }
}
