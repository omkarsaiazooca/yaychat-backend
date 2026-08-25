/** Token/cost helpers shared by every provider adapter. */

export interface ProviderPricing {
  /** USD per million input tokens. */
  inPerMTok: number;
  /** USD per million output tokens. */
  outPerMTok: number;
}

/**
 * Published list prices, keyed by `<provider>:<model>`.
 *
 * Free-tier entries are priced at 0 so the cost column reads honestly today
 * while still exercising the accounting path when a paid model is swapped in.
 */
export const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  "stub:yaysapp-offline-v1": { inPerMTok: 0, outPerMTok: 0 },

  // Google AI Studio free tier.
  "gemini:gemini-2.0-flash": { inPerMTok: 0, outPerMTok: 0 },
  "gemini:gemini-2.0-flash-lite": { inPerMTok: 0, outPerMTok: 0 },

  // Groq free tier.
  "groq:llama-3.3-70b-versatile": { inPerMTok: 0, outPerMTok: 0 },
  "groq:llama-3.1-8b-instant": { inPerMTok: 0, outPerMTok: 0 },

  // OpenRouter `:free` model slugs.
  "openrouter:meta-llama/llama-3.3-70b-instruct:free": { inPerMTok: 0, outPerMTok: 0 },

  // Paid upgrade paths, priced so the cost column stays correct if enabled.
  "openai:gpt-4o-mini": { inPerMTok: 0.15, outPerMTok: 0.6 },
  "anthropic:claude-haiku-4-5": { inPerMTok: 1, outPerMTok: 5 },
  "anthropic:claude-sonnet-5": { inPerMTok: 3, outPerMTok: 15 },
  "anthropic:claude-opus-5": { inPerMTok: 5, outPerMTok: 25 },
};

const DEFAULT_PRICING: ProviderPricing = { inPerMTok: 0, outPerMTok: 0 };

export const pricingFor = (provider: string, model: string): ProviderPricing =>
  PROVIDER_PRICING[`${provider}:${model}`] || DEFAULT_PRICING;

/** USD cost of one completion, rounded to sub-cent precision. */
export const costOf = (
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number => {
  const price = pricingFor(provider, model);
  const cost =
    (tokensIn / 1_000_000) * price.inPerMTok +
    (tokensOut / 1_000_000) * price.outPerMTok;
  return Math.round(cost * 1_000_000) / 1_000_000;
};

/**
 * Rough token estimate used when a provider omits usage metadata.
 * ~4 characters per token is close enough for quota and cost dashboards.
 */
export const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil((text || "").length / 4));
