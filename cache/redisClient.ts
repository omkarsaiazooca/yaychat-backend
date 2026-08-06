import { createClient, RedisClientType } from "redis";
import { keys } from "../config/keys";

let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;

export function getRedisClient(): RedisClientType {
    if (!client) {
        client = createClient({
            password: keys.RedisKey.key,
            socket: {
                host: process.env.REDIS_HOST,                 // e.g. redis-xxxx.redislabs.com
                port: Number(process.env.REDIS_PORT || 6379),  // e.g. 11678
                reconnectStrategy: (retries) => Math.min(50, retries * 50),
            },
        });
        client.on("error", (e) => console.error("[redis] error:", e));
        client.on("end", () => console.warn("[redis] connection ended"));
    }
    return client;
}

export async function ensureRedisConnected(): Promise<RedisClientType> {
    const c = getRedisClient();
    if (c.isOpen) {
        return c;
    }

    if (!connecting) {
        connecting = c
            .connect()
            .then(() => undefined)
            .finally(() => {
                connecting = null;
            });
    }

    await connecting;
    return c;
}

// graceful shutdown per worker
export function setupRedisShutdown() {
    const handler = async () => { try { const c = getRedisClient(); if (c.isOpen) await c.quit(); } finally { process.exit(0); } };
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
}
