import axios from "axios";
import { keys } from "../config/keys";

type ZeroBounceValidateOptions = {
  ipAddress?: string;
  accountIndex?: number;
  timeoutMs?: number;
};

export type ZeroBounceValidationResult = {
  status?: string;
  sub_status?: string;
  did_you_mean?: string | null;
  account?: string;
  domain?: string;
  domain_age_days?: string;
  free_email?: boolean;
  mx_found?: string;
  mx_record?: string;
  smtp_provider?: string;
  processed_at?: string;
  [key: string]: any;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function parseKeys(): string[] {
  const raw = String(keys.ZEROBOUNCE_API_KEYS?.key || "");

  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function hashEmail(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickKey(email: string, accountIndex?: number) {
  const keys = parseKeys();
  if (!keys.length) {
    throw new Error("ZeroBounce API keys not configured");
  }

  if (typeof accountIndex === "number" && Number.isFinite(accountIndex)) {
    if (accountIndex < 0 || accountIndex >= keys.length) {
      throw new Error("Invalid ZeroBounce accountIndex");
    }
    return { key: keys[accountIndex], index: accountIndex };
  }

  const idx = hashEmail(email) % keys.length;
  return { key: keys[idx], index: idx };
}

export async function validateEmailWithZeroBounce(
  email: string,
  opts: ZeroBounceValidateOptions = {}
): Promise<{ data: ZeroBounceValidationResult; accountIndex: number }> {
  const endpoint =
    String(keys.ZEROBOUNCE_API_URL?.key || "").trim() ||
    "https://api.zerobounce.net/v2/validate";
  const { key, index } = pickKey(email, opts.accountIndex);

  const { data } = await axios.get(endpoint, {
    params: {
      api_key: key,
      email,
      ip_address: opts.ipAddress || "",
    },
    timeout: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
  });

  return { data, accountIndex: index };
}

type ZeroBounceCreditsResult = {
  index: number;
  credits: number | null;
  ok: boolean;
  error?: string;
};

export async function getZeroBounceCreditsForAllKeys(opts: { timeoutMs?: number } = {}): Promise<ZeroBounceCreditsResult[]> {
  const endpoint =
    String((keys as any).ZEROBOUNCE_CREDITS_URL?.key || "").trim() ||
    "https://api.zerobounce.net/v2/getcredits";
  const apiKeys = parseKeys();
  if (!apiKeys.length) {
    throw new Error("ZeroBounce API keys not configured");
  }

  const timeout = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  const results = await Promise.allSettled(
    apiKeys.map((key, index) =>
      axios.get(endpoint, {
        params: { api_key: key },
        timeout,
      }).then((res) => ({ index, credits: Number(res.data?.Credits ?? 0) }))
    )
  );

  return results.map((item, index) => {
    if (item.status === "fulfilled") {
      return { index: item.value.index, credits: item.value.credits, ok: true };
    }
    const message =
      (item.reason?.response?.data?.error ||
        item.reason?.response?.data?.message ||
        item.reason?.message ||
        String(item.reason)) ?? "unknown error";
    return { index, credits: null, ok: false, error: message };
  });
}
