import { AiProvider } from "../../../data/aiAssistant";
import { AnthropicProvider } from "./anthropic.provider";
import { GeminiProvider } from "./gemini.provider";
import { OpenAiCompatibleProvider } from "./openaiCompatible.provider";
import { StubProvider } from "./stub.provider";

const env = (name: string, fallback = ""): string =>
  String(process.env[name] || fallback).trim();

const buildGroq = () =>
  new OpenAiCompatibleProvider({
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: env("GROQ_API_KEY"),
    model: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
  });

const buildOpenRouter = () =>
  new OpenAiCompatibleProvider({
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: env("OPENROUTER_API_KEY"),
    model: env("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
    headers: {
      "HTTP-Referer": env("OPENROUTER_SITE_URL", "https://yay.chat"),
      "X-Title": "YaysApp",
    },
  });

const buildOpenAi = () =>
  new OpenAiCompatibleProvider({
    id: "openai",
    baseUrl: env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    apiKey: env("OPENAI_API_KEY"),
    model: env("OPENAI_MODEL", "gpt-4o-mini"),
  });

type ProviderFactory = () => AiProvider;

const FACTORIES: Record<string, ProviderFactory> = {
  gemini: () => new GeminiProvider(),
  groq: buildGroq,
  openrouter: buildOpenRouter,
  openai: buildOpenAi,
  anthropic: () => new AnthropicProvider(),
  stub: () => new StubProvider(),
};

/**
 * Preference order used when `AI_PROVIDER` is unset or `auto`.
 * Free-tier hosts come first; paid hosts are only reached if their key is set
 * and no free provider is configured.
 */
const AUTO_ORDER = ["gemini", "groq", "openrouter", "openai", "anthropic"];

let cached: AiProvider | null = null;

/**
 * Resolve the active provider.
 *
 * `AI_PROVIDER` pins one explicitly; `auto` (the default) picks the first
 * configured provider in {@link AUTO_ORDER}. With no credentials at all the
 * stub is returned, so the API stays functional on a fresh checkout.
 */
export const resolveProvider = (): AiProvider => {
  if (cached) {
    return cached;
  }
  const requested = env("AI_PROVIDER", "auto").toLowerCase();

  if (requested && requested !== "auto") {
    const factory = FACTORIES[requested];
    if (!factory) {
      console.warn(`[ai] unknown AI_PROVIDER "${requested}" — using stub`);
      cached = new StubProvider();
      return cached;
    }
    const provider = factory();
    if (!provider.configured) {
      console.warn(
        `[ai] AI_PROVIDER "${requested}" has no credentials — using stub`
      );
      cached = new StubProvider();
      return cached;
    }
    cached = provider;
    return cached;
  }

  for (const id of AUTO_ORDER) {
    const provider = FACTORIES[id]();
    if (provider.configured) {
      cached = provider;
      return cached;
    }
  }

  cached = new StubProvider();
  return cached;
};

/** Test hook — drops the memoised provider so env changes take effect. */
export const resetProviderCache = () => {
  cached = null;
};

export { StubProvider };
