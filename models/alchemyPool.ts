import { Schema } from "mongoose";
import { AlchemyPool } from "../data/alchemyPool";
import { IDocumentModel } from "../data/base";

export interface AlchemyPoolModel extends IDocumentModel<AlchemyPool>, AlchemyPool { }

export const AlchemyPoolSchema: Schema = new Schema({
    poolId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    durationDays: { type: Number, required: true },
    initialBalanceUsd: { type: Number, required: true },
    remainingBalanceUsd: { type: Number, required: true },
    status: { type: String, enum: ["active", "expired", "closed"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    usages: [
        {
            sessionId: String,
            email: String,
            multiplier: Number,
            deltaUsd: Number,
            inputAmount: Number,
            resultAmount: Number,
            createdAt: { type: Date, default: Date.now },
        }
    ],
});

export default AlchemyPoolSchema;
