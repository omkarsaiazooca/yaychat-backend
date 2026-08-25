import axios from "axios";
import {
  AiProvider,
  AiProviderCompletion,
  AiProviderRequest,
} from "../../../data/aiAssistant";
import { estimateTokens } from "../pricing";

const TIMEOUT_MS = 30_000;

interface OpenAiCompatibleConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Extra headers some hosts require (OpenRouter attribution, for example). */
  headers?: Record<string, string>;
}

/**
 * One adapter for every host that speaks the OpenAI `chat/completions` shape:
 * Groq and OpenRouter (both free-tier), DeepSeek, Together, OpenAI itself.
 * Concrete hosts are configured in `providers/index.ts`.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly id: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenAiCompatibleConfig) {
    this.id = config.id;
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.headers = config.headers || {};
  }

  get configured(): boolean {
    return this.apiKey.length > 0 && this.model.length > 0;
  }

  async complete(request: AiProviderRequest): Promise<AiProviderCompletion> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: this.model,
        max_tokens: request.maxOutputTokens,
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((message) => ({
            role: message.role,
            content: message.text,
          })),
        ],
      },
      {
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
      }
    );

    const text = String(
      response.data?.choices?.[0]?.message?.content || ""
    ).trim();
    if (!text) {
      throw new Error(`${this.id} returned an empty completion`);
    }

    const usage = response.data?.usage || {};
    return {
      text,
      tokensIn:
        Number(usage.prompt_tokens) ||
        estimateTokens(request.system + request.messages.map((m) => m.text).join(" ")),
      tokensOut: Number(usage.completion_tokens) || estimateTokens(text),
      provider: this.id,
      model: this.model,
      degraded: false,
    };
  }
}
