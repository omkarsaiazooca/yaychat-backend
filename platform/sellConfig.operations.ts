import { Request, Response } from "express";
import { SellConfigService } from "../services/sellConfig.service";

const sellConfigService = new SellConfigService();

export class SellConfigOperations {
  constructor(private req?: Request, private res?: Response) {}

  async getPublicConfig(req: Request, res: Response) {
    try {
      const config = await sellConfigService.getAdminConfig();
      return {
        status: 200,
        message: "Sell config fetched successfully",
        data: {
          status: config.status,
          minTokenRequired: config.minTokenRequired,
          userDailyLimit: config.userDailyLimit,
          totalDailyLimit: config.totalDailyLimit,
          liquidityBalance: config.liquidityBalance,
          dailyFeePercent: config.dailyFeePercent,
          unavailableMessage: config.unavailableMessage,
          updatedAt: config.updatedAt,
        },
      };
    } catch (err) {
      console.error("Error fetching public sell config:", err);
      return { status: 500, message: "Failed to fetch sell config" };
    }
  }

  async getAdminConfig(req: Request, res: Response) {
    try {
      const config = await sellConfigService.getAdminConfig();
      return {
        status: 200,
        message: "Sell config fetched successfully",
        data: config,
      };
    } catch (err) {
      console.error("Error fetching sell config:", err);
      return { status: 500, message: "Failed to fetch sell config" };
    }
  }

  async updateAdminConfig(req: Request, res: Response) {
    try {
      const updatedConfig = await sellConfigService.updateAdminConfig(req.body);
      return {
        status: 200,
        message: "Sell config updated successfully",
        data: updatedConfig,
      };
    } catch (err) {
      console.error("Error updating sell config:", err);
      return { status: 500, message: "Failed to update sell config" };
    }
  }
}
