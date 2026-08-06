import { Request, Response } from "express";
import {
  AlchemyPoolService,
  ALLOWED_POOL_DURATIONS,
} from "../services/alchemyPool.service";
import { AlchemyOperations } from "../platform/alchemy.operations";

const alchemyPoolService = new AlchemyPoolService();

export class AlchemyController {
  async createAlchemySession(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const session = await alchemyOps.startAlchemySession(req, res);
      res.status(session?.status ?? 200).json(session);
    } catch (err) {
      console.error("Unhandled error in createAlchemySession:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async completeAlchemySession(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const session = await alchemyOps.completeAlchemySession(req, res);
      res.status(session?.status ?? 200).json(session);
    } catch (err) {
      console.error("Unhandled error in completeAlchemySession:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async finalizeAlchemyExternalAirdrop(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const result = await alchemyOps.finalizeExternalAirdrop(req, res);
      res.status(result?.status ?? 200).json(result);
    } catch (err) {
      console.error("Unhandled error in finalizeAlchemyExternalAirdrop:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async listAlchemySessions(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const sessions = await alchemyOps.listAlchemySessions(req, res);
      res.status(sessions?.status ?? 200).json(sessions);
    } catch (err) {
      console.error("Unhandled error in listAlchemySessions:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAlchemyTransactionSummary(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const summary = await alchemyOps.getAlchemyTransactionSummary(req, res);
      res.status(summary?.status ?? 200).json(summary);
    } catch (err) {
      console.error("Unhandled error in getAlchemyTransactionSummary:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUserAlchemySessions(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const sessions = await alchemyOps.getUserAlchemySessions(req, res);
      res.status(sessions?.status ?? 200).json(sessions);
    } catch (err) {
      console.error("Unhandled error in getUserAlchemySessions:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getUserAlchemySessionById(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const session = await alchemyOps.getUserAlchemySessionById(req, res);
      res.status(session?.status ?? 200).json(session);
    } catch (err) {
      console.error("Unhandled error in getUserAlchemySessionById:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAlchemyConfig(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const config = await alchemyOps.getAlchemyConfig(req, res);
      res.status(config?.status ?? 200).json(config);
    } catch (err) {
      console.error("Unhandled error in getAlchemyConfig:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async processAlchemySessionV2(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const session = await alchemyOps.startAlchemySessionV2(req, res);
      res.status(session?.status ?? 200).json(session);
    } catch (err) {
      console.error("Unhandled error in processAlchemySessionV2:", err);
      res
        .status(500)
        .json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async listLiquidityPools(req: Request, res: Response) {
    try {
      const pools = await alchemyPoolService.listPools();
      return res.status(200).json({ status: 200, data: pools });
    } catch (err: any) {
      console.error("Failed to list Alchemy pools:", err);
      return res
        .status(500)
        .json({ status: 500, message: "Unable to list pools" });
    }
  }

  async getActiveLiquidityPool(req: Request, res: Response) {
    try {
      const activePool = await alchemyPoolService.getActivePool();
      if (!activePool) {
        return res
          .status(404)
          .json({ status: 404, message: "No active Alchemy pool found" });
      }
      return res.status(200).json({ status: 200, data: activePool });
    } catch (err: any) {
      console.error("Failed to fetch active Alchemy pool:", err);
      return res
        .status(500)
        .json({ status: 500, message: "Unable to fetch active pool" });
    }
  }

  async createLiquidityPool(req: Request, res: Response) {
    try {
      const { name, amountUsd, durationDays, description } = req.body;
      const parsedAmount = Number(amountUsd);
      const parsedDuration = Number(durationDays);

      if (
        !name ||
        Number.isNaN(parsedAmount) ||
        parsedAmount <= 0 ||
        Number.isNaN(parsedDuration)
      ) {
        return res
          .status(400)
          .json({ status: 400, message: "Invalid pool payload" });
      }

      if (!ALLOWED_POOL_DURATIONS.includes(parsedDuration)) {
        return res.status(400).json({
          status: 400,
          message: `Pool duration must be one of: ${ALLOWED_POOL_DURATIONS.join(
            ", "
          )} days`,
        });
      }

      const pool = await alchemyPoolService.createPool({
        name,
        amountUsd: parsedAmount,
        durationDays: parsedDuration,
        description,
      });

      return res
        .status(201)
        .json({ status: 201, data: pool, message: "Alchemy pool created" });
    } catch (err: any) {
      console.error("Failed to create Alchemy pool:", err);
      return res
        .status(500)
        .json({ status: 500, message: "Unable to create pool" });
    }
  }

  async getAdminConfig(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const configResponse = await alchemyOps.getAdminConfig(req, res);
      res.status(configResponse.status).json(configResponse.data);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }

  async updateAdminConfig(req: Request, res: Response) {
    try {
      const alchemyOps = new AlchemyOperations(req, res);
      const configResponse = await alchemyOps.updateAdminConfig(req, res);
      res.status(configResponse.status).json(configResponse.data);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
}
