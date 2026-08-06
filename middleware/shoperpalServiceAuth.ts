import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { keys } from "../config/keys";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateShoperPalServiceRequest(req: Request, res: Response, next: NextFunction) {
  const configuredApiKey = keys.ShoperPalRewardApiKey.key;
  const configuredSecret = keys.ShoperPalRewardSecret.key;

  if (!configuredApiKey || !configuredSecret) {
    return res.status(503).json({ status: 503, message: "ShoperPal reward service auth is not configured" });
  }

  const apiKey = String(req.headers["x-shoperpal-api-key"] || "");
  const timestamp = String(req.headers["x-shoperpal-timestamp"] || "");
  const signature = String(req.headers["x-shoperpal-signature"] || "");
  const idempotencyKey = String(req.headers["x-idempotency-key"] || "");

  if (!apiKey || !timestamp || !signature || !idempotencyKey) {
    return res.status(401).json({ status: 401, message: "Missing ShoperPal service auth headers" });
  }

  if (!timingSafeEqual(apiKey, configuredApiKey)) {
    return res.status(401).json({ status: 401, message: "Invalid ShoperPal API key" });
  }

  const requestTime = new Date(timestamp).getTime();
  if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) {
    return res.status(401).json({ status: 401, message: "Invalid ShoperPal request timestamp" });
  }

  const body = JSON.stringify(req.body || {});
  const expectedSignature = crypto
    .createHmac("sha256", configuredSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  if (!timingSafeEqual(signature, expectedSignature)) {
    return res.status(401).json({ status: 401, message: "Invalid ShoperPal request signature" });
  }

  if (req.body?.idempotencyKey && req.body.idempotencyKey !== idempotencyKey) {
    return res.status(400).json({ status: 400, message: "Idempotency key mismatch" });
  }

  next();
}
