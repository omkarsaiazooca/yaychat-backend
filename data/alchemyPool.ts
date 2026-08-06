import { IModel } from "./base";

export interface AlchemyPoolUsage {
    sessionId: string;
    email: string;
    multiplier: number;
    deltaUsd: number;
    inputAmount: number;
    resultAmount: number;
    createdAt?: Date;
}

export interface AlchemyPool extends IModel {
    poolId: string;
    name: string;
    description?: string;
    durationDays: number;
    initialBalanceUsd: number;
    remainingBalanceUsd: number;
    status: "active" | "expired" | "closed";
    createdAt: Date;
    expiresAt: Date;
    usages: AlchemyPoolUsage[];
}
