import { randomBytes } from "crypto";
import { CommunityInvite } from "../../data/yaysCommunities";

/**
 * Module 3 — invite links.
 *
 * A link is `https://yay.chat/c/<slug>?i=<code>` (web) with a `yaychat://`
 * twin for the installed app. The code is the only credential, so it is random
 * rather than derived, single-community, and independently revocable — a
 * leaked link is killed without touching the community or its other invites.
 *
 * Pure: no database, no clock beyond what the caller passes.
 */

const WEB_BASE = process.env.YAYS_WEB_BASE_URL || "https://yay.chat";
const APP_SCHEME = "yaychat";
/** Unambiguous alphabet — no 0/O or 1/l, so a code survives being read aloud. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 12;

export const generateInviteCode = (): string => {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

/**
 * URL-safe handle from a community name. Collisions are resolved by the caller
 * appending a discriminator, because uniqueness needs the database.
 */
export const slugify = (name: string): string => {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "community";
};

/** The community's own shareable page, with no invite credential attached. */
export const communityUrl = (slug: string): string => `${WEB_BASE}/c/${slug}`;

export const inviteUrl = (slug: string, code: string): string =>
  `${WEB_BASE}/c/${slug}?i=${code}`;

export const inviteAppUrl = (slug: string, code: string): string =>
  `${APP_SCHEME}://community/${slug}?i=${code}`;

/** Pull the code out of either link form, or accept a bare code. */
export const parseInviteCode = (input: string): string | null => {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }
  const fromQuery = raw.match(/[?&]i=([a-z0-9]+)/i);
  if (fromQuery) {
    return fromQuery[1].toLowerCase();
  }
  if (/^[a-z0-9]{6,32}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  return null;
};

export type InviteRejection = "revoked" | "expired" | "exhausted";

/** Why this invite cannot be used, or `null` when it can. */
export const inviteRejection = (
  invite: Pick<CommunityInvite, "revokedAt" | "expiresAt" | "maxUses" | "uses">,
  now: Date = new Date()
): InviteRejection | null => {
  if (invite.revokedAt) {
    return "revoked";
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now.getTime()) {
    return "expired";
  }
  if (
    invite.maxUses !== null &&
    invite.maxUses !== undefined &&
    invite.uses >= invite.maxUses
  ) {
    return "exhausted";
  }
  return null;
};

export const rejectionMessage = (rejection: InviteRejection): string => {
  switch (rejection) {
    case "revoked":
      return "This invite link was revoked.";
    case "expired":
      return "This invite link has expired.";
    default:
      return "This invite link has already been used the maximum number of times.";
  }
};
