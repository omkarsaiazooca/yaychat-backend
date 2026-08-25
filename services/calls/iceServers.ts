import crypto from "crypto";
import { CallConfig, IceServer } from "../../data/yaysCalls";
import { RING_TIMEOUT_SECONDS } from "../yaysCall.service";

/**
 * ICE server configuration for WebRTC.
 *
 * STUN alone gets a call connected between most home networks. TURN is what
 * makes calls work on carrier-grade NAT and restrictive corporate Wi-Fi —
 * roughly 10–20% of real calls — by relaying the media. Without a TURN server
 * those calls simply fail to connect, so `relayConfigured` is reported to the
 * client rather than hidden: an operator needs to know that gap exists.
 *
 * TURN credentials use the standard ephemeral scheme (RFC 7635 style, as
 * implemented by coturn's `use-auth-secret`): the username is an expiry
 * timestamp and the password is an HMAC of it under a shared secret. The
 * long-lived secret therefore never ships inside the app, and a credential
 * lifted off a device stops working within the hour.
 */

const TURN_CREDENTIAL_TTL_SECONDS = 60 * 60;

const list = (value: string | undefined): string[] =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** Public STUN fallback so calls still work out of the box in development. */
const DEFAULT_STUN = ["stun:stun.l.google.com:19302"];

const turnCredentials = (
  secret: string,
  userLower: string
): { username: string; credential: string } => {
  const expiry = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
  const username = `${expiry}:${userLower}`;
  const credential = crypto
    .createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  return { username, credential };
};

export const iceServersFor = (userLower: string): IceServer[] => {
  const stunUrls = list(process.env.YAYS_STUN_URLS);
  const turnUrls = list(process.env.YAYS_TURN_URLS);
  const secret = String(process.env.YAYS_TURN_SECRET || "").trim();
  const staticUser = String(process.env.YAYS_TURN_USERNAME || "").trim();
  const staticPassword = String(process.env.YAYS_TURN_PASSWORD || "").trim();

  const servers: IceServer[] = [
    { urls: stunUrls.length ? stunUrls : DEFAULT_STUN },
  ];

  if (turnUrls.length) {
    if (secret) {
      servers.push({ urls: turnUrls, ...turnCredentials(secret, userLower) });
    } else if (staticUser && staticPassword) {
      // Static credentials work but are shared by every user and never expire.
      // Supported for smaller TURN deployments; prefer the HMAC secret.
      servers.push({ urls: turnUrls, username: staticUser, credential: staticPassword });
    }
  }

  return servers;
};

export const relayConfigured = (): boolean =>
  list(process.env.YAYS_TURN_URLS).length > 0 &&
  Boolean(
    String(process.env.YAYS_TURN_SECRET || "").trim() ||
      (String(process.env.YAYS_TURN_USERNAME || "").trim() &&
        String(process.env.YAYS_TURN_PASSWORD || "").trim())
  );

/**
 * Whether calling is offered at all.
 *
 * Defaults to on: STUN alone connects the majority of calls, and an operator
 * who wants calling dark can set `YAYS_CALLS_ENABLED=false`.
 */
export const callsEnabled = (): boolean =>
  String(process.env.YAYS_CALLS_ENABLED ?? "true").toLowerCase() !== "false";

export const callConfigFor = (userLower: string): CallConfig => ({
  enabled: callsEnabled(),
  iceServers: iceServersFor(userLower),
  ringTimeoutSeconds: RING_TIMEOUT_SECONDS,
  relayConfigured: relayConfigured(),
});
