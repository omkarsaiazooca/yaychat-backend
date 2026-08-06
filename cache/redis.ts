// src/lib/redis.ts
import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

export function getRedis(): RedisClientType {
  if (client) return client;
  client = createClient({
    socket: {
      host: process.env.REDIS_HOST,                 // e.g. redis-xxxx.redislabs.com
      port: Number(process.env.REDIS_PORT || 6379),  // e.g. 11678
    },
    password: process.env.REDIS_PASSWORD,            // keep in env
  });
  client.on("error", (e) => console.error("Redis error:", e));
  // fire-and-forget connect (safe to await elsewhere if you prefer)
  (async () => { if (!client!.isOpen) await client!.connect(); })();
  return client!;
}

export async function getJSON<T = unknown>(key: string): Promise<T | null> {
  const r = getRedis();
  const raw = await r.get(key);
  return raw ? JSON.parse(raw) as T : null;
}

export async function setJSON<T = unknown>(
  key: string,
  value: T,
  ttlSec?: number
): Promise<void> {
  const r = getRedis();
  const payload = JSON.stringify(value);
  if (ttlSec && ttlSec > 0) {
    await r.set(key, payload, { EX: ttlSec });
  } else {
    await r.set(key, payload);
  }
}

export async function delKey(key: string): Promise<void> {
  const r = getRedis();
  await r.del(key);
}
