import { ServiceBase } from "./base";
import AlchemyPoolSchema, { AlchemyPoolModel } from "../models/alchemyPool";
import { AlchemyPool, AlchemyPoolUsage } from "../data/alchemyPool";
import { v1 as uuidv1 } from "uuid";

export const ALLOWED_POOL_DURATIONS = [7, 15];

interface CreatePoolPayload {
    name: string;
    amountUsd: number;
    durationDays: number;
    description?: string;
}

export class AlchemyPoolService extends ServiceBase<AlchemyPool, AlchemyPoolModel> {
    constructor() {
        super(AlchemyPoolSchema, "AlchemyPools");
    }

    private async expireExpiredPools(now = new Date()) {
        return this.updateMany(
            { status: "active", expiresAt: { $lte: now } },
            { status: "expired" }
        );
    }

    async getActivePool() {
        await this.expireExpiredPools();
        return this.findOne({ status: "active" });
    }

    async getPoolById(poolId: string) {
        return this.findOne({ poolId });
    }

    async listPools(filter: Record<string, any> = {}) {
        return this.find(filter);
    }

    async createPool(payload: CreatePoolPayload) {
        await this.expireExpiredPools();

        const now = new Date();
        const duration = ALLOWED_POOL_DURATIONS.includes(payload.durationDays)
            ? payload.durationDays
            : ALLOWED_POOL_DURATIONS[0];
        return this.create({
            poolId: uuidv1(),
            name: payload.name,
            description: payload.description ?? "",
            durationDays: duration,
            initialBalanceUsd: payload.amountUsd,
            remainingBalanceUsd: payload.amountUsd,
            status: "active",
            createdAt: now,
            expiresAt: new Date(now.getTime() + duration * 24 * 60 * 60 * 1000),
            usages: [],
        });
    }

    async recordUsage(poolId: string, usage: AlchemyPoolUsage) {
        const pool = await this.findOne({ poolId });
        if (!pool) {
            throw new Error("Alchemy pool not found");
        }
        const nextBalance = Math.max(0, (pool.remainingBalanceUsd ?? 0) + usage.deltaUsd);
        await this.updatePart(
            { poolId },
            {
                $set: { remainingBalanceUsd: nextBalance },
                $push: {
                    usages: {
                        ...usage,
                        createdAt: usage.createdAt ?? new Date(),
                    },
                },
            }
        );
        return this.findOne({ poolId });
    }

    async closePool(poolId: string) {
        return this.updatePart({ poolId }, { status: "closed" });
    }
}
