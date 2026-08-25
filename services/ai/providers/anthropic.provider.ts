import axios from "axios";
import {
  AiProvider,
  AiProviderCompletion,
  AiProviderRequest,
} from "../../../data/aiAssistant";
import { estimateTokens } from "../pricing";

const DEFAULT_MODEL = "claude-opus-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 60_000;

/**
 * Anthropic Messages API adapter — a paid upgrade path, off unless
 * `ANTHROPIC_API_KEY` is set. `ANTHROPIC_MODEL` selects a cheaper tier
 * (`claude-haiku-4-5`, `claude-sonnet-5`) when cost matters more than depth.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  readonly model: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
    this.model = String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim();
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(request: AiProviderRequest): Promise<AiProviderCompletion> {
    const response = await axios.post(
      API_URL,
      {
        model: this.model,
        // Thinking is on by default on current models and shares this budget,
        // so the ceiling is generous and effort is pinned low for chat latency.
        max_tokens: Math.max(request.maxOutputTokens, 4096),
        output_config: { effort: "low" },
        system: request.system,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
      },
      {
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
      }
    );

    // Safety classifiers can decline with HTTP 200 — check before reading content.
    if (response.data?.stop_reason === "refusal") {
      throw new Error("Anthropic declined this request");
    }

    const text = (response.data?.content || [])
      .filter((block: any) => block?.type === "text")
      .map((block: any) => String(block.text || ""))
      .join("")
      .trim();

    if (!text) {
      throw new Error("Anthropic returned an empty completion");
    }

    const usage = response.data?.usage || {};
    return {
      text,
      tokensIn:
        Number(usage.input_tokens) ||
        estimateTokens(request.system + request.messages.map((m) => m.text).join(" ")),
      tokensOut: Number(usage.output_tokens) || estimateTokens(text),
      provider: this.id,
      model: this.model,
      degraded: false,
    };
  }
}
