import { Request, Response } from "express";
import { AlchemyPoolService, ALLOWED_POOL_DURATIONS } from "../services/alchemyPool.service";

const alchemyPoolService = new AlchemyPoolService();

export class AlchemyPoolController {
    async listPools(req: Request, res: Response) {
        try {
            const pools = await alchemyPoolService.listPools();
            return res.status(200).json({ status: 200, data: pools });
        } catch (err: any) {
            console.error("Failed to list Alchemy pools:", err);
            return res.status(500).json({ status: 500, message: "Unable to list pools" });
        }
    }

    async getActivePool(req: Request, res: Response) {
        try {
            const activePool = await alchemyPoolService.getActivePool();
            if (!activePool) {
                return res.status(404).json({ status: 404, message: "No active Alchemy pool found" });
            }
            return res.status(200).json({ status: 200, data: activePool });
        } catch (err: any) {
            console.error("Failed to fetch active Alchemy pool:", err);
            return res.status(500).json({ status: 500, message: "Unable to fetch active pool" });
        }
    }

    async getPoolById(req: Request, res: Response) {
        try {
            const poolId = req.params.poolId;
            if (!poolId) {
                return res.status(400).json({ status: 400, message: "Pool id is required" });
            }
            const pool = await alchemyPoolService.getPoolById(poolId);
            if (!pool) {
                return res.status(404).json({ status: 404, message: "Pool not found" });
            }
            return res.status(200).json({ status: 200, data: pool });
        } catch (err: any) {
            console.error("Failed to fetch Alchemy pool:", err);
            return res.status(500).json({ status: 500, message: "Unable to fetch pool" });
        }
    }

    async createPool(req: Request, res: Response) {
        try {
            const { name, amountUsd, durationDays, description } = req.body;
            const parsedAmount = Number(amountUsd);
            const parsedDuration = Number(durationDays);

            if (!name || Number.isNaN(parsedAmount) || parsedAmount <= 0 || Number.isNaN(parsedDuration)) {
                return res.status(400).json({ status: 400, message: "Invalid pool payload" });
            }

            if (!ALLOWED_POOL_DURATIONS.includes(parsedDuration)) {
                return res.status(400).json({
                    status: 400,
                    message: `Pool duration must be one of: ${ALLOWED_POOL_DURATIONS.join(", ")} days`,
                });
            }

            const pool = await alchemyPoolService.createPool({
                name,
                amountUsd: parsedAmount,
                durationDays: parsedDuration,
                description,
            });

            return res.status(201).json({ status: 201, data: pool, message: "Alchemy pool created" });
        } catch (err: any) {
            console.error("Failed to create Alchemy pool:", err);
            return res.status(500).json({ status: 500, message: "Unable to create pool" });
        }
    }
}
